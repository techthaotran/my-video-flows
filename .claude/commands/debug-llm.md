---
description: Extract and print the reasoning (thinking), text, and tool-call history of the current AI coding session, auto-detecting whether it's running in Claude Code or Cursor.
---

# debug-llm

Dumps the full reasoning/text/tool-call trace of an AI coding session to the terminal,
in chronological order, by reading the tool's own local session storage directly —
no hook or live logging needed.

Scripts live in `.claude/commands/references/debug-llm/`:
`.claude/commands/references/debug-llm/extract_claude.py`,
`.claude/commands/references/debug-llm/extract_cursor.py`, and
`.claude/commands/references/debug-llm/detect_env.py`.

## Argument dispatch

The command is invoked as `/debug-llm [arg]`, where `[arg]` (`$ARGUMENTS`) is
optional and, if given, is one of `cl` or `cu`.

**No argument → auto-detect which agent is running this command right now**, and
dump *that* session — this is the default and the common case. Run:

```bash
python3 .claude/commands/references/debug-llm/detect_env.py
```

It prints exactly `cl`, `cu`, or `unknown` (see that script's docstring for how
detection works — env var fast path plus a process-ancestry fallback that
doesn't depend on any particular env var existing). Dispatch on the result:

- `cl` → Claude Code. Run:
  ```bash
  python3 .claude/commands/references/debug-llm/extract_claude.py
  ```
  With no explicit path, this targets the session actually running this
  command (via `$CLAUDE_CODE_SESSION_ID`), not just "whatever session file
  happens to be newest" — that guess breaks the moment a second Claude Code
  window is open on the same repo. Falls back to most-recently-modified only
  if that env var is unset or its transcript file isn't there. Prints
  **every** entry in the transcript — nothing is silently skipped — as one of
  15 tags: the conversation itself (`[USER]`, `[THINKING]`, `[TEXT]`,
  `[TOOL_USE]`, `[TOOL_RESULT]`, `[SKILL_LOAD]`, `[META]`) plus CLI/session
  bookkeeping (`[ATTACHMENT]`, `[SYSTEM]`, `[TITLE]`, `[MODE]`, `[QUEUE]`,
  `[FRAME_LINK]`, `[LAST_PROMPT]`, `[TOKENS]`). `[SKILL_LOAD]`/`[META]` matter
  for debugging skills specifically: a `Skill` tool call (or a slash command's
  own file) causes the CLI to inject the loaded SKILL.md/command body as a
  synthetic ("isMeta") turn — without a distinct tag it prints identically to
  `[USER]` and is easy to mistake for something the person actually typed.
  `[SKILL_LOAD] <name>: ...` marks it as that injection and names the
  skill/command (resolved from the file's own "Base directory for this
  skill:" line, or its first `# Heading` as a fallback); other non-human-typed
  injected content that isn't a recognizable skill body falls back to plain
  `[META]`. `[TOKENS]` prints the real per-turn `in`/`out`/`cache_read`/
  `cache_write`/`total` straight from the API response's `usage` field after
  every assistant turn — not a char-count estimate.

- `cu` → Cursor. Run:
  ```bash
  python3 .claude/commands/references/debug-llm/extract_cursor.py
  ```
  Finds "the current chat window" via Cursor's own per-workspace bookkeeping:
  this repo's `~/.../Cursor/User/workspaceStorage/<hash>/state.vscdb` (matched
  by its `workspace.json` folder path) has an `ItemTable["composer.composerData"]`
  entry whose `lastFocusedComposerIds[0]` is the actually-focused composer.
  Only falls back to the old "highest createdAt among composers whose raw
  JSON mentions the repo path" heuristic if that workspace lookup fails —
  that heuristic is unreliable on its own (createdAt is creation time, not
  last-used time; confirmed on a real machine picking an abandoned composer
  over the one actually open). The transcript's `# composer_id=...` header
  names which path was used. Prints `[TITLE]` (once, the composer's name),
  then the conversation in order: `[USER]`/`[SKILL_LOAD]`, `[THINKING]`,
  `[TEXT]`, `[TOOL_USE]`, `[TOOL_RESULT]`. A slash-command invocation
  (e.g. `/debug-llm`) is only distinguishable from plain text in the user
  bubble's `richText` Lexical tree, via a `mention` node with
  `typeaheadType.case == "cursor_skill"` — that's unwrapped into
  `[SKILL_LOAD] <name>: ...` instead of a plain `[USER]` line. `[TOKENS]`
  prefers real `in`/`out`/`total` from each bubble's own `tokenCount`, but on
  current Cursor versions that field stays zero on every bubble (verified:
  only 168/29130 real bubbles on this machine ever had it populated) — when
  no bubble has it, falls back to a single composer-level snapshot printed
  at the end, read from `composerData.promptTokenBreakdown` (per-category:
  system prompt, tools, rules, skills, mcp, subagents, conversation) and
  `contextUsagePercent`. Cursor bubbles only ever carry two `type`s
  (user/assistant) with these content kinds — verified against ~29k real
  bubbles — so unlike Claude Code there's no separate tier of
  session-bookkeeping entry types to surface; that metadata lives in
  composerData, not per-bubble.

- `unknown` → detection was inconclusive (e.g. run from a plain terminal,
  outside either tool). Ask the user which one they mean (`cu` or `cl`) —
  do not guess.

**An explicit `cl` or `cu` argument always overrides auto-detection** — skip
`detect_env.py` and run the matching script directly. Use this when the user
names a tool explicitly, or wants a different session than the one currently
running this command (combine with the explicit ID form below).

## Optional: dump a specific session/composer

Both scripts accept an explicit ID as the first CLI arg instead of auto-detecting the
latest one:

```bash
python3 .claude/commands/references/debug-llm/extract_claude.py <path-to-session.jsonl>
python3 .claude/commands/references/debug-llm/extract_cursor.py <composer_id>
```

Use this when the user names a specific past session, or when the auto-detected
"latest" one isn't the one they mean (ask them for the id/path if ambiguous).

## Output handling

Always write the dump to a file under `<project-root>/though/debug/` — never rely
on printing it straight to the terminal, since long sessions blow past what's
readable (or even fully returned) inline. Create the directory first if it
doesn't exist yet:

```bash
mkdir -p though/debug
```

Name the file after the source being dumped so repeat runs don't collide:
`though/debug/<session-id-or-composer-id>.txt`. The session/composer id is
right there in the script's own output — Claude Code's dump starts with a
`# session=<path>` header (take the `.jsonl` basename), Cursor's with
`# composer_id=<id>`. Redirect into that path:

```bash
python3 .claude/commands/references/debug-llm/extract_claude.py > though/debug/<session-id>.txt
python3 .claude/commands/references/debug-llm/extract_cursor.py > though/debug/<composer-id>.txt
```

After writing the file, still show the user a short preview (e.g. `head -n 50`
or a `tail -n 200` for the most recent turns) so they see something useful
immediately without waiting on the full file — but the file itself is the
required artifact, not an optional convenience.

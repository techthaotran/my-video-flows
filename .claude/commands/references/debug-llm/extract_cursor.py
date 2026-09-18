#!/usr/bin/env python3
"""Dump the full conversation of a Cursor chat (composer), in order.

Cursor stores all chat data in a single global SQLite DB, keyed by composerId:
  ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
    - cursorDiskKV["composerData:<composerId>"]        -> conversation metadata + bubble order
    - cursorDiskKV["bubbleId:<composerId>:<bubbleId>"]  -> one message/thinking/tool-call block

To find "the current chat window" for this repo, Cursor's own bookkeeping is
used rather than guessing: each workspace (one repo folder) gets its own
  ~/Library/Application Support/Cursor/User/workspaceStorage/<hash>/state.vscdb
  (workspace.json in the same dir names the folder it belongs to)
whose ItemTable["composer.composerData"] has lastFocusedComposerIds — Cursor's
real, per-workspace record of which chat tab was focused most recently. This
replaces an earlier heuristic (still kept as a fallback) that scanned every
composer in the whole DB, kept only ones whose raw JSON happened to contain
the repo path as a substring, and picked the one with the highest createdAt.
That fallback is unreliable: createdAt is when a composer was first created,
not when it was last used, so an old composer someone's still actively
working in loses to a newer one that was opened once and abandoned — verified
on a real machine where it picked a composer with no lastUpdatedAt at all
over the actually-focused one.

Prints every block that makes up the conversation:
  [USER]        - the human's prompt
  [THINKING]    - the model's extended-thinking blocks
  [TEXT]        - the model's visible reply text
  [TOOL_USE]    - a tool call the model made (name + args). MCP-server calls
                  (toolFormerData.tool == 19) store their real name/args nested
                  inside a double-JSON-encoded rawArgs string; this unwraps
                  them and prints as mcp__<server>__<tool>(args) instead of
                  the raw wrapper JSON.
  [TOOL_RESULT] - what that tool call returned (also unwrapped for MCP calls);
                  non-"completed" statuses (error/rejected/...) are noted
  [TITLE]       - the composer's name (same tag Claude Code's extractor uses
                  for its session title, so both dumps share one vocabulary)
  [TOKENS]      - real per-bubble token usage from bubble.tokenCount
                  (inputTokens/outputTokens); no cache breakdown is exposed
                  here the way Claude Code's usage object has one

Cursor bubbles only ever carry two `type`s (1=user, 2=assistant) and, within
an assistant bubble, three content kinds (thinking / tool call+result / text)
— verified against ~29k real bubbles. There's no Cursor equivalent of Claude
Code's many top-level session-bookkeeping entries (mode, queue state, ...):
that metadata lives in composerData instead, not per-bubble.

Usage:
  extract_cursor.py                # the chat window currently focused for this repo
  extract_cursor.py <composer_id>  # dump one specific composer
"""
import glob
import json
import os
import sqlite3
import subprocess
import sys

DB_PATH = os.path.expanduser(
    "~/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
)
WORKSPACE_STORAGE_DIR = os.path.expanduser(
    "~/Library/Application Support/Cursor/User/workspaceStorage"
)


def repo_root():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], text=True
        ).strip()
    except Exception:
        return os.getcwd()


def connect():
    return sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)


def find_current_composer_id(repo_path):
    """The correct way to find "the chat window currently open for this
    repo": look up this repo's own workspace-storage DB and read Cursor's
    real focus-order bookkeeping, instead of guessing from creation time
    across every composer that ever mentioned the repo path anywhere.
    Returns None (never raises) if anything about this lookup doesn't pan
    out, so the caller can fall back to the old heuristic."""
    target = "file://" + repo_path.rstrip("/")
    candidates = []
    for ws_json in glob.glob(os.path.join(WORKSPACE_STORAGE_DIR, "*", "workspace.json")):
        try:
            with open(ws_json) as f:
                folder = json.load(f).get("folder", "")
        except (OSError, json.JSONDecodeError):
            continue
        if folder.rstrip("/") != target:
            continue
        db_path = os.path.join(os.path.dirname(ws_json), "state.vscdb")
        if os.path.isfile(db_path):
            candidates.append(db_path)

    if not candidates:
        return None
    # If this repo somehow has more than one workspace-storage entry (e.g.
    # re-opened after a Cursor data migration), the most recently written
    # state.vscdb is the active one.
    db_path = max(candidates, key=os.path.getmtime)

    try:
        ws_conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        cur = ws_conn.cursor()
        cur.execute("SELECT value FROM ItemTable WHERE key='composer.composerData'")
        row = cur.fetchone()
        ws_conn.close()
    except sqlite3.Error:
        return None
    if not row:
        return None

    try:
        focused = json.loads(row[0]).get("lastFocusedComposerIds") or []
    except json.JSONDecodeError:
        return None
    return focused[0] if focused else None


def find_latest_composer_id(conn, needle):
    """Fallback only — see find_current_composer_id for why this is unreliable
    on its own (createdAt, not last-focused/last-updated; and "needle appears
    somewhere in the JSON" is a much looser match than "this is the repo's
    own workspace")."""
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'")
    best_id, best_created = None, -1
    for key, value in cur.fetchall():
        if value is None:
            continue
        text = value.decode("utf-8", errors="ignore") if isinstance(value, bytes) else value
        if needle not in text:
            continue
        d = json.loads(text)
        created = d.get("createdAt", 0)
        if created > best_created:
            best_created = created
            best_id = d["composerId"]
    return best_id


MCP_TOOL_KIND = 19  # toolFormerData.tool == 19 marks an MCP-server tool call


def _try_json(s):
    if not isinstance(s, str):
        return None
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return None


def render_mcp_tool_call(tool):
    """MCP calls store their real name/input/result inside nested,
    double-JSON-encoded strings (rawArgs / result). Unwrap them instead of
    printing the raw wrapper, and label the call with server + tool name."""
    raw = _try_json(tool.get("rawArgs")) or {}
    server = raw.get("providerIdentifier", "?")
    tool_name = raw.get("toolName") or tool.get("name", "?")
    args = raw.get("args", raw)
    print(f"[TOOL_USE] mcp__{server}__{tool_name}({json.dumps(args)})\n")

    status = tool.get("status")
    if status and status != "completed":
        print(f"[TOOL_RESULT] [{status}]\n")
        return

    result = _try_json(tool.get("result"))
    inner = _try_json(result.get("result")) if isinstance(result, dict) else None
    if isinstance(inner, dict) and isinstance(inner.get("content"), list):
        text = "\n".join(
            block.get("text", "")
            for block in inner["content"]
            if isinstance(block, dict) and block.get("type") == "text"
        )
        if text:
            print(f"[TOOL_RESULT] {text}\n")
            return

    error = tool.get("error")
    if error:
        print(f"[TOOL_RESULT] [ERROR] {error}\n")
    elif tool.get("result"):
        print(f"[TOOL_RESULT] {tool['result']}\n")


def extract_skill_invocation(rich_text_raw):
    """A slash-command skill (e.g. /debug-llm) is stored in the user bubble's
    plain `text` as an indistinguishable flat string ("/debug-llm cu"); the
    only place Cursor records *which skill* was actually invoked is a
    `mention` node inside the Lexical `richText` JSON tree, identified by
    `typeaheadType.case == "cursor_skill"` and a `filename` of the form
    "<skill-name>/SKILL.md". Returns the skill name, or None if this bubble
    doesn't contain one (verified against real bubbles: plain user text has
    no richText mention nodes at all)."""
    rt = _try_json(rich_text_raw)
    if not isinstance(rt, dict):
        return None

    def walk(node):
        if not isinstance(node, dict):
            return None
        if node.get("type") == "mention":
            tt = node.get("typeaheadType")
            if isinstance(tt, dict) and tt.get("case") == "cursor_skill":
                filename = tt.get("filename", "")
                return filename.rsplit("/SKILL.md", 1)[0] or node.get("mentionName")
        for child in node.get("children", []) or []:
            found = walk(child)
            if found:
                return found
        return None

    return walk(rt.get("root", {}))


def render_bubble(b):
    btype = b.get("type")
    thinking = b.get("thinking") or {}
    tool = b.get("toolFormerData")
    text = b.get("text") or ""

    if btype == 1:
        skill = extract_skill_invocation(b.get("richText"))
        if skill:
            print(f"[SKILL_LOAD] {skill}: {text}\n")
        elif text:
            print(f"[USER] {text}\n")
        return

    # assistant (type 2): a bubble can carry thinking, tool call, and/or text
    if thinking.get("text"):
        print(f"[THINKING] {thinking['text']}\n")
    if tool:
        if tool.get("tool") == MCP_TOOL_KIND:
            render_mcp_tool_call(tool)
        else:
            print(f"[TOOL_USE] {tool.get('name')}({tool.get('rawArgs')})\n")
            status = tool.get("status")
            if status and status != "completed":
                print(f"[TOOL_RESULT] [{status}]\n")
            elif tool.get("result"):
                print(f"[TOOL_RESULT] {tool['result']}\n")
    if text:
        print(f"[TEXT] {text}\n")

    token_count = b.get("tokenCount") or {}
    in_tok, out_tok = token_count.get("inputTokens"), token_count.get("outputTokens")
    if in_tok or out_tok:
        in_tok, out_tok = in_tok or 0, out_tok or 0
        print(f"[TOKENS] in={in_tok} out={out_tok} total={in_tok + out_tok}\n")


def print_composer_token_summary(data):
    """Fallback for when no bubble carried a non-zero tokenCount (common on
    current Cursor versions — verified: 168/29130 real bubbles across this
    machine's whole DB had it populated, the rest are all zero). The real,
    current numbers instead live one level up, on composerData itself:
    `promptTokenBreakdown` (a snapshot of the last request's context usage,
    broken down by category — system prompt, tools, rules, skills, mcp,
    subagents, conversation) and `contextUsagePercent`. This is a
    point-in-time snapshot of the whole composer, not a per-turn delta like
    Claude Code's [TOKENS], so it's printed once at the end rather than
    interleaved with bubbles."""
    breakdown = data.get("promptTokenBreakdown") or {}
    categories = breakdown.get("categories") or []
    if not breakdown and data.get("contextUsagePercent") is None:
        return
    total = breakdown.get("totalUsedTokens")
    max_tokens = breakdown.get("maxTokens")
    pct = data.get("contextUsagePercent")
    parts = []
    if total is not None:
        parts.append(f"total={total}")
    if max_tokens is not None:
        parts.append(f"max={max_tokens}")
    if pct is not None:
        parts.append(f"context_used={pct:.1f}%")
    print(f"[TOKENS] (composer snapshot) {' '.join(parts)}")
    for cat in categories:
        label = cat.get("label", cat.get("id", "?"))
        print(f"  - {label}: {cat.get('estimatedTokens', 0)}")
    print()


def dump_composer(conn, composer_id):
    cur = conn.cursor()
    cur.execute("SELECT value FROM cursorDiskKV WHERE key=?", (f"composerData:{composer_id}",))
    row = cur.fetchone()
    if not row:
        print(f"No composer found with id {composer_id}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(row[0])
    title = data.get("name") or data.get("subtitle")
    if title:
        print(f"[TITLE] {title}\n")
    headers = data.get("fullConversationHeadersOnly", [])
    any_bubble_tokens = False
    for h in headers:
        bid = h["bubbleId"]
        cur.execute(
            "SELECT value FROM cursorDiskKV WHERE key=?",
            (f"bubbleId:{composer_id}:{bid}",),
        )
        brow = cur.fetchone()
        if not brow:
            continue
        bubble = json.loads(brow[0])
        tc = bubble.get("tokenCount") or {}
        if tc.get("inputTokens") or tc.get("outputTokens"):
            any_bubble_tokens = True
        render_bubble(bubble)

    if not any_bubble_tokens:
        print_composer_token_summary(data)


def main():
    conn = connect()
    if len(sys.argv) > 1:
        composer_id = sys.argv[1]
    else:
        repo = repo_root()
        composer_id = find_current_composer_id(repo)
        source = "workspace-focus"
        if not composer_id:
            composer_id = find_latest_composer_id(conn, repo)
            source = "fallback: createdAt heuristic"
        if not composer_id:
            print(f"No Cursor composer found referencing {repo}", file=sys.stderr)
            sys.exit(1)
        print(f"# composer_id={composer_id} (via {source})\n", file=sys.stderr)
    dump_composer(conn, composer_id)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Dump the full conversation of a Claude Code session, in order.

Reads the session transcript Claude Code writes to disk at:
  ~/.claude/projects/<sanitized-cwd>/<session_id>.jsonl

Each line is one message (user or assistant). This prints every block that
makes up the conversation:
  [USER]        - the human's prompt
  [THINKING]    - Claude's extended-thinking blocks
  [TEXT]        - Claude's visible reply text
  [TOOL_USE]    - a tool call Claude made (name + input, incl. mcp__server__tool
                  calls; [SUBAGENT] prefix marks calls made inside a Task subagent)
  [TOOL_RESULT] - what that tool call returned, labeled with the tool name it
                  answers; non-text blocks (e.g. MCP image results) get a
                  readable placeholder instead of being dropped
  [SKILL_LOAD]  - a SKILL.md's full body being injected into context after a
                  `Skill` tool call (or a slash command's own file) — these
                  are synthetic ("isMeta") turns from the CLI, not the human;
                  without this tag they render identically to [USER] and are
                  easy to mistake for something the person actually typed
  [META]        - other injected-but-not-human-typed content (isMeta) that
                  doesn't look like a skill body

Every other top-level entry type in the transcript (there are 10 total; user
and assistant are handled above) also gets printed, not silently skipped:
  [ATTACHMENT]  - injected context: skill/agent listings, file snapshots,
                  hook output, task reminders, queued commands, ...
  [SYSTEM]      - CLI-internal events, e.g. stop-hook summaries
  [TITLE]       - the session's ai-generated or user-set title
  [MODE]        - permission-mode changes (normal/plan/...)
  [QUEUE]       - prompt queue bookkeeping (enqueue/dequeue/remove)
  [FRAME_LINK]  - a preview-pane/artifact link opened during the session
  [LAST_PROMPT] - CLI bookkeeping of the most recent prompt (used for resume);
                  usually redundant with the [USER] turn it points at
  [TOKENS]      - real (not estimated) token usage for one assistant turn,
                  straight from the API response's `usage` field: in/out/
                  cache-read/cache-write, plus a total of all four

Usage:
  extract_claude.py                  # the currently running session (via
                                      # $CLAUDE_CODE_SESSION_ID, when this
                                      # script is run from inside Claude Code),
                                      # else the most recently modified session
                                      # in this project
  extract_claude.py <session.jsonl>  # a specific transcript file
"""
import glob
import json
import os
import re
import subprocess
import sys


def sanitized_cwd():
    root = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
    )
    cwd = root.stdout.strip() if root.returncode == 0 else os.getcwd()
    return re.sub(r"[^A-Za-z0-9]", "-", cwd)


def latest_session(project_dir):
    files = glob.glob(os.path.join(project_dir, "*.jsonl"))
    if not files:
        print(f"No session transcripts found in {project_dir}", file=sys.stderr)
        sys.exit(1)
    return max(files, key=os.path.getmtime)


def current_session(project_dir):
    """Resolve the session this script is actually running inside of, when
    invoked from within Claude Code itself. $CLAUDE_CODE_SESSION_ID is set by
    Claude Code for its own subprocesses; falling back to "most recently
    modified file" is a guess that breaks as soon as more than one Claude
    Code window is open on the same repo."""
    session_id = os.environ.get("CLAUDE_CODE_SESSION_ID")
    if session_id:
        candidate = os.path.join(project_dir, f"{session_id}.jsonl")
        if os.path.isfile(candidate):
            return candidate
    return latest_session(project_dir)


def render_tool_result_block(b):
    """Render one block of a tool_result's content list. Text is passed
    through; non-text blocks (e.g. MCP image/base64 results, which used to
    be silently dropped) get a readable placeholder instead of vanishing."""
    if not isinstance(b, dict):
        return str(b)
    t = b.get("type")
    if t == "text":
        return b.get("text", "")
    if t == "image":
        src = b.get("source") or {}
        media_type = src.get("media_type", "unknown")
        data = src.get("data", "")
        size_kb = round(len(data) * 3 / 4 / 1024) if data else 0  # base64 -> bytes
        return f"[image block: {media_type}, ~{size_kb} KB]"
    if t == "resource":
        return f"[resource block: {json.dumps(b.get('resource', b))[:300]}]"
    return f"[{t or 'unknown'} block: {json.dumps(b)[:300]}]"


SKILL_LOAD_RE = re.compile(r"Base directory for this skill:.*/\.claude/skills/([^/\s]+)")
MD_TITLE_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)


def classify_meta_text(text):
    """isMeta user turns are content the CLI injected, not content the human
    typed (a loaded SKILL.md body, a slash command's own file, a reference
    doc pulled in by a skill, ...). Label the common case (a skill body,
    identifiable by its standard header) with the skill's name; fall back to
    a generic tag for anything else so it's still never confused with real
    [USER] input."""
    m = SKILL_LOAD_RE.search(text)
    if m:
        return f"[SKILL_LOAD] {m.group(1)}:"
    m = MD_TITLE_RE.search(text)
    if m:
        return f'[SKILL_LOAD] "{m.group(1).strip()}":'
    return "[META]"


def render_user_content(content, tool_names, is_meta=False):
    if isinstance(content, str):
        tag = classify_meta_text(content) if is_meta else "[USER]"
        print(f"{tag} {content}\n")
        return
    for c in content:
        t = c.get("type")
        if t == "text":
            if is_meta:
                print(f"{classify_meta_text(c['text'])} {c['text']}\n")
            else:
                print(f"[USER] {c['text']}\n")
        elif t == "tool_result":
            result = c.get("content")
            if isinstance(result, list):
                result = "\n".join(render_tool_result_block(b) for b in result)
            tool_use_id = c.get("tool_use_id")
            name = tool_names.get(tool_use_id)
            label = f" ({name})" if name else ""
            if c.get("is_error"):
                label += " [ERROR]"
            print(f"[TOOL_RESULT]{label} {result}\n")


def render_tokens(usage):
    """Print the real per-turn token usage straight from the API response
    (Anthropic Messages API `usage` object), not a char-count estimate."""
    if not usage:
        return
    in_tok = usage.get("input_tokens", 0)
    out_tok = usage.get("output_tokens", 0)
    cache_read = usage.get("cache_read_input_tokens", 0)
    cache_write = usage.get("cache_creation_input_tokens", 0)
    total = in_tok + out_tok + cache_read + cache_write
    print(
        f"[TOKENS] in={in_tok} out={out_tok} cache_read={cache_read} "
        f"cache_write={cache_write} total={total}\n"
    )


def render_assistant_content(content, tool_names, sidechain=False, usage=None):
    prefix = "[SUBAGENT] " if sidechain else ""
    for c in content:
        t = c.get("type")
        if t == "thinking":
            print(f"[THINKING] {prefix}{c['thinking']}\n")
        elif t == "text":
            print(f"[TEXT] {prefix}{c['text']}\n")
        elif t == "tool_use":
            tool_use_id = c.get("id")
            if tool_use_id:
                tool_names[tool_use_id] = c["name"]
            print(f"[TOOL_USE] {prefix}{c['name']}({json.dumps(c.get('input'))})\n")
    render_tokens(usage)


def render_attachment(a):
    """Generic renderer for the many `attachment` subtypes (skill/agent
    listings, file snapshots, hook context, queued commands, ...). Each
    subtype has a different shape, so this surfaces whichever field carries
    the actual text, then dumps the rest of the payload as compact JSON —
    nothing gets silently dropped for not matching a known shape."""
    t = a.get("type", "unknown")
    label = a.get("filename") or a.get("path") or ""
    label = f" {label}" if label else ""

    primary = None
    for key in ("content", "snippet", "prompt"):
        val = a.get(key)
        if isinstance(val, str) and val:
            primary = val
            break
        if isinstance(val, list) and val and all(isinstance(x, str) for x in val):
            primary = "\n".join(val)
            break

    rest = {
        k: v
        for k, v in a.items()
        if k not in ("type", "content", "snippet", "prompt", "filename", "path")
    }
    parts = [p for p in (primary, json.dumps(rest, ensure_ascii=False) if rest else None) if p]
    body = "\n".join(parts) if parts else "(empty)"
    return f"[ATTACHMENT] {t}{label}: {body}"


def render_other_entry(d):
    """Render top-level session-log entries that aren't a user/assistant
    conversation turn: CLI bookkeeping (mode, titles, prompt-queue state,
    artifact links) and injected attachments. Previously skipped entirely
    since `main()` only handled entries with a `message` field."""
    t = d.get("type")
    if t == "attachment":
        print(f"{render_attachment(d.get('attachment') or {})}\n")
    elif t == "system":
        extra = {
            k: v
            for k, v in d.items()
            if k not in ("type", "subtype", "parentUuid", "isSidechain", "uuid", "timestamp")
        }
        print(f"[SYSTEM] {d.get('subtype', '?')}: {json.dumps(extra, ensure_ascii=False)}\n")
    elif t in ("ai-title", "custom-title"):
        kind = "ai" if t == "ai-title" else "custom"
        title = d.get("aiTitle") or d.get("customTitle") or ""
        print(f"[TITLE] ({kind}) {title}\n")
    elif t == "mode":
        print(f"[MODE] {d.get('mode')}\n")
    elif t == "queue-operation":
        content = d.get("content")
        suffix = f": {content}" if content else ""
        print(f"[QUEUE] {d.get('operation', '?')}{suffix}\n")
    elif t == "frame-link":
        print(f"[FRAME_LINK] {d.get('title', '')} -> {d.get('frameUrl', '')} (local: {d.get('path', '')})\n")
    elif t == "last-prompt":
        print(f"[LAST_PROMPT] {d.get('lastPrompt', '')}\n")


def main():
    if len(sys.argv) > 1:
        path = sys.argv[1]
    else:
        project_dir = os.path.expanduser(f"~/.claude/projects/{sanitized_cwd()}")
        path = current_session(project_dir)
        print(f"# session={path}\n", file=sys.stderr)

    tool_names = {}  # tool_use_id -> tool name (incl. mcp__server__tool), so
    # TOOL_RESULT lines can say which call (and which MCP server) they answer.
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue

            t = d.get("type")
            if t in ("user", "assistant"):
                msg = d.get("message")
                content = msg.get("content") if msg else None
                if content is None:
                    continue
                if t == "user":
                    render_user_content(content, tool_names, is_meta=bool(d.get("isMeta")))
                else:
                    render_assistant_content(
                        content,
                        tool_names,
                        sidechain=bool(d.get("isSidechain")),
                        usage=msg.get("usage"),
                    )
            else:
                render_other_entry(d)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Detect which coding agent this script is currently being run from.

Prints exactly one of: cl (Claude Code), cu (Cursor), unknown — and nothing
else on stdout, so callers can do `arg=$(python3 detect_env.py)`.

Detection strategy, in order:
1. $CLAUDECODE=1 is set by Claude Code on every subprocess it spawns
   (verified: present alongside $CLAUDE_CODE_SESSION_ID). Fast, exact.
2. Otherwise walk the process ancestry (macOS `ps`) looking for an app
   bundle named Claude.app or Cursor.app. This is what actually identifies
   the owning app regardless of which env vars a given version happens to
   set — verified by walking from a live shell PID up through
   .../claude.app/... to /Applications/Claude.app. Works the same way for
   Cursor, whose helper processes live under /Applications/Cursor.app.
"""
import os
import subprocess
import sys


def from_env():
    if os.environ.get("CLAUDECODE") == "1":
        return "cl"
    return None


def from_process_ancestry(max_hops=20):
    try:
        pid = os.getpid()
        for _ in range(max_hops):
            out = subprocess.run(
                ["ps", "-o", "ppid=,comm=", "-p", str(pid)],
                capture_output=True,
                text=True,
                timeout=2,
            )
            line = out.stdout.strip()
            if not line:
                return None
            parts = line.split(None, 1)
            if len(parts) != 2:
                return None
            ppid_str, comm = parts
            comm_lower = comm.lower()
            if "cursor.app" in comm_lower or "/cursor helper" in comm_lower:
                return "cu"
            if "claude.app" in comm_lower or "claude-code" in comm_lower:
                return "cl"
            if not ppid_str.isdigit() or int(ppid_str) <= 1:
                return None
            pid = int(ppid_str)
    except (OSError, subprocess.SubprocessError):
        return None
    return None


def main():
    result = from_env() or from_process_ancestry() or "unknown"
    print(result)
    sys.exit(0 if result != "unknown" else 1)


if __name__ == "__main__":
    main()

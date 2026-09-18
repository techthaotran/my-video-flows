---
description: Run the complete two-AI pipeline: code-review-base followed by code-verify on the exact same diff and run directory.
---

Invoke the `code-review` skill first, then pass its exact run directory to the separate `code-verify`
skill. Each skill owns its own rules and templates; do not merge their responsibilities.

Arguments (`$ARGUMENTS`) use the same diff-scope rules as `code-review-base`.
If the final token is `--debug`, strip it from the scope and pass debug artifact mode to both skills.
Without it, both stages write only human-facing/handoff files and decisive evidence.

Requirements:

1. Run deterministic preflight, then Code Review Base with exactly one `reviewer`; persist
   `review.md`, and persist standalone `preflight.md` only with `--debug`.
   Create the run at repository-root `test-features/<feature-slug>/<run-id>/`.
2. Pass that exact artifact and run directory to Code Verify; create exactly one verifier agent for
   the full verify stage. It runs all cases sequentially and creates no verifier subagents.
3. Verify that the diff fingerprint has not changed between the two stages. If it changed, stop as
   `STALE_REVIEW`; do not verify mismatched code.
4. Persist `verify.md`, cross-reference results by finding ID, and return the merged final report
   using `.claude/skills/code-verify/assets/final-report-template.md`.
5. Resolve runtime service endpoints only through root `CLAUDE.md`; never hard-code ports here.
6. Return the human decision queue and update `metrics.json`; never emit AI approval or imply that
   no finding means safe to merge.
7. Link the grouped test-case evidence summary; every failed executed case must be visibly prefixed
   `NG-`, and every browser/UI assertion must have a screenshot.
8. If Verify creates any `BLOCKED-*` case, stop the full workflow as `WAITING_HUMAN`, persist partial
   artifacts, report the exact blocker and ask for guidance. Resume only on explicit instruction and
   after rechecking the same diff fingerprint.
9. When guidance clears the blocker, record evidence and update reusable skill/README guidance before
   completing the resumed full run; keep one-off or sensitive details only in redacted run evidence.
10. Screenshot permission is mandatory before Verify executes a case. If missing or denied, keep
    asking the user to grant it and do not continue until a screenshot succeeds.
11. Verify must use `playwright-cli`; install `@playwright/cli@latest` globally and its browser
    runtime when absent. Never use Chrome Agent, Chrome MCP, Playwright MCP, or another browser MCP.
    A failed install/recheck is `BLOCKED_TOOLING` and pauses for human guidance.
12. Enforce the Verify allow scope. Any required action outside it becomes
    `BLOCKED_OUT_OF_SCOPE`; stop and ask the human before performing that exact action.

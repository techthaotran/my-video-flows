---
description: Run AI Verify against a saved code-review-base artifact, using deterministic checks and conditional runtime verification.
---

Invoke the `code-verify` skill. Read the shared contract it references before running.

Arguments (`$ARGUMENTS`) should identify a `review.md`, its run directory, or the same explicit diff
scope. If omitted, use the newest incomplete code-review run whose `review.md` exists and whose diff
fingerprint still matches the working scope. If no unambiguous compatible artifact exists, stop and
ask for the intended run; never silently review again.

When the final token is `--debug`, remove it from the run/scope arguments and persist full diagnostic
JSON, logs and traces. Without it, persist only human-facing plans, Markdown reports and decisive
evidence defined by the skill.

Search incomplete runs only under repository-root `test-features/*/*/`. Legacy `.claude` evidence
may be used only when the user explicitly supplies its path; never create new artifacts there.

Requirements:

- Do not run `reviewer`. Create exactly one `verifier` agent for the whole verify run. It plans and
  executes every test case sequentially; it must not create coordinator/worker subagents.
- Require `playwright-cli` for every run. If `command -v playwright-cli` fails, install the official
  CLI with `npm install -g @playwright/cli@latest`, verify `playwright-cli --help`, and run
  `playwright-cli install-browser` when its browser runtime is missing. Never use or install Chrome
  Agent, Chrome MCP, `chrome-devtools-mcp`, Playwright MCP, or another browser MCP. Failure is
  `BLOCKED_TOOLING` and pauses for human guidance.
- Enforce the allow scope in `code-verify/SKILL.md`. Before any action outside it, persist current
  state, return `BLOCKED_OUT_OF_SCOPE`, and ask the human for exact approval; never act first.
- Consume finding IDs and verification contracts verbatim from `review.md`.
- Consume `context.md` and create a coverage matrix for spec/approved plan, workflow/wiki, old/new
  business logic, user behavior, current-system and related-feature impact, performance, security,
  error handling, rules/format, and applicable refactor invariants. Turn every applicable sourced
  requirement/invariant into a traceable test case; do not generate cases only from findings.
- Read the `refactor` skill and test only observable invariants, never subjective style.
- Test requirements/invariants independently. Report `WEAK_ORACLE` or
  `TEST_GAP` instead of treating implementation-mirroring tests as proof.
- Before runtime verification, identify the affected service and resolve its current endpoint from
  the service/port mapping in root `CLAUDE.md`.
- Check listener plus service health/identity first. Reuse an already healthy service; only start
  the canonical service when nothing is listening. Never start duplicates or kill a conflicting
  process; report `BLOCKED_PORT_CONFLICT`.
- Persist `verify-plan.md` before execution. Before any case runs, confirm screenshot permission.
  Missing or denied permission is `BLOCKED_SCREENSHOT_PERMISSION` and moves the whole run to
  `WAITING_HUMAN`; ask the user to grant it again and do not proceed to another case until it works.
  Cases that need auth are eligible only after GUI/API login succeeds.
- For GUI contracts, `playwright-cli` uses a dedicated named session and verification tabs. When
  unauthenticated, navigate to `/login` and follow root `CLAUDE.md`. Never attach to or inspect the
  user's browser/profile/session.
- API clients, test data and evidence folders remain isolated; cases with dependencies/shared
  mutable fixtures run sequentially.
- The single verifier writes `verify-plan.md`, one test-case folder at a time, summaries,
  `verify.md`, and `metrics.json`. An `NG` case does not stop later cases. Any `BLOCKED*`,
  `WEAK_ORACLE`, or `TEST_GAP` result
  pauses the whole verify run in `WAITING_HUMAN`; stop before the next case, save partial evidence/summary,
  notify human with the exact blocker and question, then resume only after explicit guidance.
- After human guidance clears the blocker, record the resolution in case evidence, resume the same
  run, and update reusable learning: verification workflow rules in `skills/code-verify/SKILL.md`, project
  troubleshooting in `.claude/README.md`. Deduplicate and never persist secrets/ephemeral values.
- Never place a concrete port in this command, the skill, or the verifier prompt template.
- Use Playwright CLI browser interaction only for genuinely browser-dependent contracts or an explicit `swagger-playwright`
  API-only contract. Swagger PASS must be labeled `API_ONLY` and cannot replace a GUI integration
  test case.
- Persist the output as `verify.md` in the same run directory.
- Persist every verification as a grouped test-case folder following
  `skills/code-verify/assets/evidence-format.md`;
  create `summary.md` (and `summary.json` only with `--debug`), prefix every final case with `PASS-`, `NG-`, or `BLOCKED-`, and
  include screenshots for browser/Swagger assertions plus redacted text evidence for every case.
- Update `metrics.json` with observable counts only; never invent precision or recall.

---
name: code-verify
description: Independent runtime and evidence verification for an existing code-review run. Uses exactly one verifier agent, sequential test cases, mandatory screenshot permission, PASS/NG/BLOCKED evidence, and human-guided resume.
---

# Code Verify

This skill consumes an existing `code-review` run and never repeats static review.

## Verification artifact contract

Use the exact run directory created by `code-review` under
`test-features/<feature-slug>/<run-id>/`. Strip `--debug` from arguments before resolving the run.
Require and preserve the normal handoff files from that skill. This skill creates in normal mode:

8. `verify-plan.md`
9. `test-cases/<PASS|NG|BLOCKED>-<case-number>-<case-slug>/case.md` plus only the screenshot or
   redacted text evidence directly cited by a human-checkable assertion
10. `test-cases/summary.md`
11. `verify.md`

With `--debug`, additionally persist the full diagnostic set: `case.json`, `summary.json`, raw
command output, request/response detail, network/console traces, readiness logs, retries and other
intermediate evidence. The suffix changes artifact verbosity only; it never reduces test coverage,
screenshot requirements, blocker handling, or verification rigor. Secrets remain forbidden in both
modes.

Before execution, recompute the scoped diff fingerprint. Return `STALE_REVIEW` if it differs from
`diff.sha256`. Concrete ports/endpoints come only from root `CLAUDE.md`. Never use GitNexus, edit
product source, commit, deploy, publish, run real migrations, perform destructive actions, persist
secrets, or claim merge approval.

## Prepare verification

1. Resolve `review.md` from the explicit argument or newest unambiguous incomplete run under
   `test-features/*/*/`.
2. Require `diff.patch`, `diff.sha256`, `context.md`, and `review.md`. In a debug run also load
   `scope.txt` and `preflight.md`; their absence in a normal run is valid.
   Recompute the scoped diff fingerprint; return `STALE_REVIEW` on mismatch.
3. Create exactly one `verifier` agent for the whole run. Before execution, it builds a coverage
   matrix from `context.md` and `review.md` in this priority: spec, approved plan, approved
   workflow/wiki, old business logic from code/wiki, new business logic, user behavior, current
   system/related-feature impact, performance, security, error handling, rules/format, and applicable
   refactor invariants. It converts every applicable requirement/invariant and reviewer contract
   into stable two-digit case IDs and writes `verify-plan.md` with service, auth gate, dependencies, mutable
   resources, execution order, evidence folder, and GUI tab when applicable. It must not create
   coordinator/worker subagents.
   One case may cover several categories only when it maps each source and assertion explicitly.
   Record every category as `COVERED`, `NOT_APPLICABLE`, `CONTEXT_GAP`, or `TEST_GAP`; do not silently
   omit it or invent a new requirement from the implementation.
4. Read `.claude/skills/refactor/SKILL.md` completely. Verify only its observable requirements or
   invariants (for example behavior preservation, bounded work, resource cleanup, and error
   propagation); never create a runtime test for subjective style alone.
5. Reject an implementation-mirroring oracle as `WEAK_ORACLE`; use `TEST_GAP` when an independent
   requirement/fixture is missing.

## Runtime, auth, and sequential execution

1. `playwright-cli` is mandatory for every verify run and is the only allowed browser controller.
   Run `command -v playwright-cli` and `playwright-cli --help`. If absent, install exactly
   `@playwright/cli@latest` with `npm install -g @playwright/cli@latest`, then recheck. If its browser
   runtime is missing, run `playwright-cli install-browser`. Never install or use Chrome Agent,
   Chrome MCP, `chrome-devtools-mcp`, Playwright MCP, or another browser MCP. Installation/recheck
   failure is `BLOCKED_TOOLING`: enter `WAITING_HUMAN` and do not substitute another tool.
2. For runtime contracts, resolve the affected service and endpoint only from root `CLAUDE.md`.
3. Check listener, health, and service identity. Reuse a healthy service; start the canonical service
   only if nothing is listening. A wrong-service conflict is `BLOCKED_PORT_CONFLICT`; never kill,
   change port, or start a duplicate. Static/package checks skip this gate.
4. Before any test case, require a successful `playwright-cli screenshot` capability/permission
   check. If permission
   is absent or denied, return `BLOCKED_SCREENSHOT_PERMISSION`, enter `WAITING_HUMAN`, and ask the
   user to grant it again. Do not skip, substitute another evidence method, or execute any next case
   until a screenshot succeeds. Persist the path returned by `playwright-cli`, then copy only the
   required redacted evidence into the case folder.
5. Public/no-auth cases become eligible after the screenshot gate. Authenticated GUI/API cases also
   wait for the matching login/session gate defined in `CLAUDE.md`.
6. Use a dedicated named `playwright-cli` session and dedicated verification tabs. Login follows
   root `CLAUDE.md`; never inspect or change the user's browser, tabs, profile, cookies, or data.
   For Chrome-extension GUI contracts: use headed Chromium with config `browser.launchOptions.args`
   `--disable-extensions-except=<unpacked>` and `--load-extension=<unpacked>` plus an isolated
   `userDataDir` under the run evidence folder. CRXJS HMR `dist/extension` requires a healthy
   package `dev:ext` (URL from process log) or a production `build:ext`; reload the extension after
   Vite is up. Prefer Playwright locators that pierce open shadow roots; native `<select>` uses
   `selectOption`. Do not auto-waive extension load failures that are still in allow-scope.
7. The one verifier executes test cases sequentially in `verify-plan.md` order. Keep API clients,
   cookie jars, test namespaces, and mutable fixtures isolated and clean them after each case.
8. The verifier follows [`assets/evidence-format.md`](assets/evidence-format.md). Browser and
   `swagger-playwright` assertions require screenshots; API/CLI/package/static checks require redacted
   text/JSON and explicitly state that a screenshot is not applicable. All generated explanations
   are clear Vietnamese, and every case includes complete manual reproduction steps that do not rely
   on chat context.

## Allow scope — hard boundary

The verifier may only read the frozen run and relevant checkout files; run existing non-mutating
package checks; inspect/reuse or canonically start services mapped in root `CLAUDE.md`; make safe
local requests required by a case; use `playwright-cli` in a dedicated named session/tabs; create
isolated test data; clean up only data it created; and write redacted artifacts inside the current
run directory. Installing the missing official `@playwright/cli@latest` package and its browser
runtime as specified above is the one allowed global mutation.

Anything else is outside scope, including another tool/dependency install, Chrome Agent, Chrome MCP,
product source/config changes, unrelated service/tab/account access, destructive cleanup, deploy, migration,
publish, commit, or test-target expansion. Before performing it, return `BLOCKED_OUT_OF_SCOPE`, save
current state, enter `WAITING_HUMAN`, and ask one question containing the proposed action, exact
target, reason, risk, and pending cases. Human approval applies only to that exact action and never
silently broadens the remaining scope.

## Block and resume

Any `BLOCKED`, `BLOCKED_AUTH`, `BLOCKED_PORT_CONFLICT`, `BLOCKED_SCREENSHOT_PERMISSION`,
`BLOCKED_TOOLING`, `BLOCKED_OUT_OF_SCOPE`,
`WEAK_ORACLE`, or `TEST_GAP` result triggers `WAITING_HUMAN`: stop before the next action, persist
partial evidence/summary, then ask the human one concrete question with case/path, evidence, and
completed/current/pending state. End the turn. Screenshot denial is never waivable: ask again until
permission works.

After the human replies:

1. Preserve run/case IDs and recheck `diff.sha256`.
2. Apply only authorized guidance and empirically recheck the blocked precondition.
3. Add `Block resolution` to case evidence and partial summary with redacted guidance, action,
   evidence, timestamp, and durable-learning classification.
4. Resume the next sequential case only after the blocker clears; otherwise ask again with new evidence.
5. Before completion, store reusable workflow/safety/evidence learning in this `SKILL.md`, or
   project-specific prerequisites/troubleshooting in `.claude/README.md` under `Known blocker
   resolutions`. Deduplicate; keep one-off or sensitive details only in redacted run evidence.

## Complete verification

The single verifier writes `test-cases/summary.md`, `verify.md`, updates `metrics.json`, and writes
`summary.json` only in debug mode after running cases sequentially. Final case folders use `PASS-`, `NG-`, or
`BLOCKED-`. `NG` does not cancel later cases; blocker states always trigger the global pause above.

Cross-reference every contract/finding as `CONFIRMED`, `REFUTED`, `NOT_REPRODUCED`, `BLOCKED`,
`BLOCKED_AUTH`, `BLOCKED_PORT_CONFLICT`, `BLOCKED_SCREENSHOT_PERMISSION`, `WEAK_ORACLE`, or
`TEST_GAP`. Use Chrome only for DOM/
rendering, interaction, navigation, browser storage/cookies, extension APIs, or another browser-only
observable. `swagger-playwright` is also allowed for an explicit API-only contract before GUI integration.
Its PASS is scoped `API_ONLY` and never proves GUI/end-to-end wiring. Other backend verification uses
package tests, direct API/CLI, logs, state assertions, or static trace.

Do not mark the workflow `COMPLETE` after a resolved blocker until its evidence is recorded and the
durable guidance is updated or explicitly classified `NON_GENERALIZABLE`.

Write the final result using
[`assets/final-report-template.md`](assets/final-report-template.md).

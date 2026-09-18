---
name: code-review
description: Static cross-domain code review. Builds immutable scope/context/preflight artifacts, runs one AI Reviewer, and emits findings plus verification contracts without ports, services, auth, or Chrome.
---

# Code Review

This skill implements only `code-review-base`; runtime verification belongs to the separate
`code-verify` skill.

## Review artifact contract

Create each run at `test-features/<feature-slug>/<YYYYMMDD-HHMMSS>/`. Derive the slug from the
ticket/spec/plan; use `code-review` only when no feature identity exists. Never store evidence under
`.claude/`.

Artifact mode is selected from the command suffix. Strip `--debug` before resolving the diff scope.

Normal mode creates only the files a human needs to inspect the AI result and the immutable handoff:

1. `diff.patch`
2. `diff.sha256`
3. `context.md`
4. `review.md`
5. `metrics.json`

With `--debug`, also create the complete diagnostic set:

1. `scope.txt`
2. `preflight.md` with full command output and diagnostic detail

In normal mode, keep the scope and concise preflight status inside `review.md`; do not create
duplicate standalone files. The debug suffix changes artifact verbosity only, never review depth,
checks, safety rules, or findings.

These files are the immutable handoff to `code-verify`. Never use GitNexus; its `main`-only index is
not evidence for the active checkout. Never resolve ports, start services, log in, or use Chrome.
Never edit product source, commit, deploy, publish, migrate, or claim merge approval.

## Resolve scope

Use an explicit PR/base/files scope when supplied. Otherwise inspect uncommitted and staged changes
plus current-branch commits relative to `main`. Exclude generated output, dependencies, and lockfiles
unless explicitly requested. Stop when there is no code change.

Measure changed code files, changed lines, touched modules, and domains. Above **40 code files**,
**2,000 changed lines**, or **8 behaviorally distinct modules**, return `SCOPE_TOO_LARGE` with a
partition plan grouped by complete behavior/module paths. Record any explicit human override as a
coverage risk.

## Build context

Create `context.md` before preflight using
[`assets/context-template.md`](assets/context-template.md). It is a cited source ledger, not a new
specification or implementation plan.

Use this precedence:

```text
Confirmed spec / acceptance criteria
  → approved implementation plan
  → approved workflow/wiki + established business invariants
  → actual diff and surrounding code
  → architecture, contracts, conventions, runtime constraints
```

Record all of these as `CONFIRMED`, `MISSING`, or `NOT_APPLICABLE` with citations:

- spec/acceptance criteria and approved plan, when available;
- approved business/user workflow from task docs or project wiki, when available;
- old business logic from current code plus wiki, and new business logic from spec/plan/workflow;
- user behavior across actor/auth/loading/empty/error/permission states;
- current end-to-end system logic, callers/dependents, related-feature and regression impact;
- API/DTO/schema/events, dependency versions, architecture and production constraints;
- performance, security, error handling, business rules, input/output format and compatibility;
- the full `.claude/skills/refactor/SKILL.md` checklist: KISS, DRY, YAGNI, SOLID, Clean Code,
  Performance Rules and Error-Handling Rules, each with concrete applicability/evidence.

Read the refactor skill completely before review. It is a review lens only: do not edit source and
do not let style preferences override behavior requirements. When sources conflict, cite both under
`Source conflicts`, create a `CONTEXT_GAP`, identify the human decision owner, and do not invent the
intended behavior.

## Review workflow

1. Create `test-features/<feature-slug>/<run-id>/` and write immutable `diff.patch` and `diff.sha256`.
   Write standalone `scope.txt` only in debug mode.
2. Build and validate `context.md`.
3. Inspect affected package scripts and run applicable non-mutating deterministic checks:
   compiler/typecheck, lint without fix, focused existing tests, and configured static/security/
   dependency analysis. Never run `--fix`, snapshot updates, migrations, deploy, or publish. Store
   exact `PASS | FAIL | BLOCKED` and record missing checks. Persist full output in `preflight.md`
   only in debug mode; otherwise put the concise result in `review.md`.
4. Run exactly one `reviewer` with the immutable diff, context, preflight, changed files, package
   ownership, cross-domain contracts, AI-generated-code flag, and
   [`assets/finding-format.md`](assets/finding-format.md).
5. Save its complete change manifest, risk triage, system traces, findings, blind spots, coverage,
   human decision queue, and independently testable verification contracts to `review.md`. The
   contract matrix must cover every applicable requirement/workflow/business/user/impact/performance/
   security/error/rule/format/refactor category, even when no bug finding exists; use
   `NOT_APPLICABLE`, `CONTEXT_GAP`, or `TEST_GAP` instead of silently omitting a category.
6. Initialize `metrics.json` from
   [`assets/metrics-template.json`](assets/metrics-template.json)
   using observable facts only.
7. Return the absolute run and `review.md` paths for handoff to `code-verify`.

This skill is static/read-only: it never resolves ports, starts services, logs in, launches Chrome,
or runs the `verifier`. Passing preflight does not prove semantic correctness.

## Non-goals

- No per-domain reviewer fan-out.
- No runtime/browser verification.
- No vague LOW-severity noise by default.
- No precision, recall, safety, or merge-readiness claim without human/ground-truth evidence.

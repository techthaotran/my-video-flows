---
description: Run deterministic non-mutating preflight plus AI Reviewer: build context/risk maps, findings, and verification contracts without runtime/browser verification.
---

Invoke the `code-review` skill. Read the shared contract it references before running.

Arguments (`$ARGUMENTS`) may specify a PR, base ref, staged changes, files, or paths. If empty, use
the skill's default diff scope.

When the final token is `--debug`, remove it from the scope arguments and enable full diagnostic
artifacts. Without it, persist only human-facing review/handoff files defined by the skill.

Requirements:

- Run exactly one `reviewer` agent; do not run `verifier`.
- Apply the scope-size gate and build `context.md` from `assets/context-template.md` **before
  preflight**. Include spec, approved plan, Spec↔Plan↔Diff traceability, conflicts, and completeness
  decision. If too large, return a behavior/module partition plan instead of a misleading review.
- Run applicable non-mutating deterministic preflight before Reviewer. Persist full `preflight.md`
  only with `--debug`; otherwise include its concise status in `review.md`.
  Never run lint `--fix`, snapshot update, migration, deploy, or another source-changing command.
- Review the complete affected scope, including backend/API code.
- Read and apply the `refactor` skill as a concrete review checklist. Cover spec/approved plan,
  workflow/wiki, old/new business logic, user behavior, current-system and related-feature impact,
  performance, security, error handling, rules, and formats. Do not emit subjective style findings.
- Create verification contracts for every applicable sourced requirement/invariant, not only for
  bug findings; record `NOT_APPLICABLE`, `CONTEXT_GAP`, or `TEST_GAP` for uncovered categories.
- Create a run directory and persist the reviewer handoff artifact as `review.md` so `code-verify`
  can consume it later.
- The run directory must be repository-root `test-features/<feature-slug>/<run-id>/`; never create a
  new run under `.claude/`.
- Return the run directory, risk summary, findings, and verification contracts.
- Include coverage, context gaps, blind spots, and a human decision queue; never return approval.
- Do not resolve or hard-code any service port. Reviewer is static/read-only.

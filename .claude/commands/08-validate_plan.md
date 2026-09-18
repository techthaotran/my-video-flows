---
description: Validate that an implementation plan was correctly executed, verify success criteria against actual code changes, and report/propose fixes for failed cases
---

## Initial Setup

When this command is invoked, tell the user immediately (before investigating) that validation is running. Respond with something like:
```
Running validate-plan. I'll locate the plan, check the actual code changes against it, and give you a pass/fail report per phase.
```

If the user already provided a `plan.md` path, continue right away. Only ask for it if nothing was given and it can't be found (see Step 0).

# Validate Plan

Turn an implementation plan (`plan.md`, output of `create_plan`) into a concrete pass/fail report against the actual code changes, precise enough that the user knows exactly which criteria failed and why — without Claude silently fixing anything on its own.

**Core principles:**
- **Validate against `plan.md` and the actual current code changes** — not against memory, not against assumptions, not against a re-imagined version of what the feature "should" do. `plan.md` is the single source of truth for what "done" means.
- **Never invent new success criteria.** Only check what the phases' `**Verify**` blocks (`Automated` + `Manual`), the master plan section 6, and the phase descriptions actually state. If something seems missing from the plan, flag it as a plan gap — don't silently treat it as a validation failure.
- **Never auto-fix.** When a case fails, report it and propose a concrete fix — but wait for explicit user approval before editing any file. This applies even to trivial fixes (typos, lint).
- **Map every finding to a specific ID.** Every pass/fail must reference a specific phase, an automated check command, or a manual verification bullet from `plan.md`. No vague "partially implemented" without saying exactly which item(s) failed.
- **Output report language:** the validation report file is always written in **Vietnamese**, keeping technical terms in English (file paths, commands, code, API names...) — same convention as `plan.md` itself, since the same requester reviews both.

## Step 0 — Locate the plan & reuse check

1. **Locate `plan.md`**:
   - If a path was given, use it directly.
   - Otherwise, check recent conversation context (was a plan just created or implemented in this same chat?) or search `thoughts/shared/plans/` for the most recently modified plan.
   - **If no plan can be confidently identified → STOP and ask the user which plan to validate.** Do not guess a target plan — validating against the wrong plan produces a report that looks credible but is meaningless.

2. **Determine context**:
   - **Existing session** (implementation happened earlier in this same conversation): reuse what's already known — files touched, phases completed, todo list state — instead of rediscovering everything from git. Only re-verify by running the automated commands fresh, since code may have changed since it was last seen in context.
   - **Fresh session** (no implementation context in this chat): discover purely from git and the current file state — no assumptions about what "should" have happened beyond what's in `plan.md`.

3. **If reusing session context**, briefly state what's being reused vs. freshly checked, same spirit as `create_plan`'s Step 0:
   ```
   Reuse check:

   Known from this session (no need to research again):
   - [Phase / file implemented earlier in this conversation]

   Will re-verify (the code may have changed since):
   - Re-run all automated checks
   - Current diff against the plan
   ```

## Step 1: Context Gathering

1. **Read the whole plan set completely** — master plan + every sub-plan. Extract, for every phase:
   - Phase name and the matrix rows it cites
   - Every `Automated` command (exact command string) and every `Manual` step from the phase's `**Verify**` block
   From the **master plan**, extract once:
   - section 4 — the work matrix: this is the coverage checklist; every row must be accounted for by some phase
   - section 2 — the refactor commitments (only the principles the plan actually committed to; `N/A` entries are not findings) — these are claims the implementation must honor, not words to skip over
   - section 3 — the flow the implementation is supposed to follow
   - section 6 — end-to-end verification

2. **Gather implementation evidence**:
   ```bash
   git log --oneline -n 20
   git diff HEAD~N..HEAD   # N covering the implementation commits
   cd $(git rev-parse --show-toplevel) && make check test  # or whatever the project's actual check commands are
   ```
   Prefer the exact commands listed in the phases' `Automated` lines over generic `make check test` — the plan already specifies what "automated verification" means for this task.

3. **Read all files the plan says should have changed**, fully, to compare planned vs. actual.

## Step 2: Systematic Validation

For each phase in `plan.md`:

1. **Run every command listed under `Automated`** for that phase. Record exact pass/fail per command — don't summarize multiple commands into one verdict.

2. **Assign a phase status using these fixed thresholds** (no ambiguous middle ground):
   - **✅ Fully complete**: 100% of automated checks for the phase pass, AND the code changes match what the phase describes (files, approach).
   - **⚠️ Has issues**: at least one automated check fails, OR code exists but deviates from the plan's approach in a way that affects behavior (not just naming).
   - **❌ Not implemented**: no code changes found that correspond to this phase at all.
   - A phase is never marked "partially implemented" without listing exactly which automated check(s) or manual item(s) are the reason.

3. **Cross-check the refactor-principle commitments**, not just their presence:
   - For each of KISS / DRY / YAGNI / SOLID / Clean Code the plan committed to — check whether the actual code honors it (e.g., if the plan said "no new interface, plain function is enough" under YAGNI, verify no speculative interface was actually added).
   - Flag drift as a **Deviation** (if harmless, e.g. improved on the plan) or an **Issue** (if it reintroduces the complexity the plan explicitly ruled out).

4. **List manual verification steps** (`Manual` lines + master plan section 6) as-is, for the user to run themselves — do not attempt to guess their outcome.

5. **Check the workflow diagram** (master plan section 3) against the actual code path — note if the real flow diverges from what was diagrammed.

6. **Check matrix coverage**: every row in the master plan section 4 must map to a validated phase. A row with no corresponding phase or code is a ❌ in its own right — report it as a coverage gap, citing the row number.

## Step 3: Propose Fixes (do not apply)

For every ❌ or ⚠️ finding:
1. State the specific fix needed (file:line, what to change).
2. Show a short proposed diff or code snippet.
3. **Do not create or edit any file.** Wait for the user to say which fixes to apply.

If the user approves fixes, apply them one at a time and re-run only the relevant automated check to confirm, rather than re-running the entire validation.

## Step 4: Write the Report

Write to `<same directory as plan.md>/validation-report.md`. Overwrite if it already exists (a plan should only have one current validation report).
Write to `<plan-dir>/validation-report.md`. Overwrite if it already exists (a plan set should only have one current validation report).

Use `assets/validation-report-template.md` as the skeleton — read it before writing. Keep its section numbering and status symbols (✅ / ⚠️ / ❌) unchanged; they are what the reader scans for. Sections with nothing to report get `N/A`, not padding.

## After the report exists

Tell the user the full path to `validation-report.md`, summarize the overall status in 1-2 sentences (e.g. "2 of 3 phases complete, 1 lint issue to fix"), and explicitly ask which of the proposed fixes (Step 3 / Section 5) they want Claude to apply. Do not start editing code uninvited.

## Important Guidelines

1. **Be evidence-based, not optimistic.** A phase marked ✅ in a sub-plan is a claim, not proof — verify against actual code and command output.
2. **Never auto-fix.** Every fix, however small, is proposed and waits for approval.
3. **No vague middle statuses.** Every ⚠️ or ❌ must cite the exact failing check or missing piece.
4. **Respect session context.** If implementation happened in this same chat, don't rediscover everything from git — but do re-run automated checks, since code can have changed since it was last seen.
5. **Cross-reference refactor commitments**, not just checkbox completion — the plan made specific KISS/DRY/YAGNI/SOLID/Clean Code claims; validate them like any other criterion.

## Files

- `assets/validation-report-template.md` — skeleton for `validation-report.md` (Step 4).
- `assets/plan-master-template.md` / `assets/plan-subplan-template.md` — the plan structure being validated against.

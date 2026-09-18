---
description: Generate comprehensive, requirement-driven test cases from a PRD, BA analysis, implementation plan, ticket, or plain requirements
---

## Initial Setup

When this command is invoked, tell the user immediately (before investigating or asking questions) that test-cases mode is running. Respond with something like:
```
Running /09-test-cases. I'll investigate the codebase first, then clarify requirements before writing the test-cases document.
```
If the user already attached a PRD, analysis, plan, or ticket, continue into Step 1 right away — do not wait for another prompt. Only ask them to provide the requirement if nothing was given.

# Test Cases Generator

Turn requirements into a test-cases document a QA engineer can execute without asking follow-up questions.

Two failure modes kill this task, and everything below exists to prevent them:
1. **Writing the file too early** — you guess at ambiguous requirements, and the suite looks complete while testing the wrong thing.
2. **Testing the implementation instead of the requirement** — the tests break on every refactor and prove nothing about behavior.

## Hard rules

**R1. Do not write the file while questions are open.**
Finish research → clarification → outline alignment first. If a new question surfaces *while* writing, stop, ask, wait for the answer, then continue. A half-guessed test case is worse than a missing one, because it looks like coverage.

**R2. Output file: English structure, Vietnamese content.**
Section headings, field labels, table headers, IDs, paths, commands and code stay exactly as `assets/test-cases-template.md` writes them. Everything you fill in — case titles, preconditions, steps, expected results, notes — is Vietnamese prose. This applies only to the file written under `thoughts/shared/test-cases/`, not to this command or to chat replies.

Reply in the user's chat language.

**R3. Mirror the create-plan verification model.**
Every verification item splits into `Automated` vs `Manual` — the same split as the `**Verify**` block in `assets/plan-subplan-template.md`. Structure the strategy as Unit → Integration → Manual. If a plan set exists, link it and never invent coverage that contradicts the master plan, section 5 (`## 5. Out of Scope`).

**R4. Requirement-driven, not implementation-driven.**
Every test case maps to a requirement, acceptance criterion, or plan phase. If you can't name what a test case would prove to a stakeholder, delete it.

## Initial response

**Parameters provided** (a path to a PRD, analysis, plan, or ticket) → skip the greeting, read the files fully, start Step 1.

**No parameters** → reply:

```
I'll help you write test cases. I need to know first:

1. The feature / requirement (PRD, analysis, implementation plan, or ticket)
2. Constraints (scope, platform, what's out of scope)
3. Links to the related plan or existing tests

I'll research the codebase, then work through it with you to produce a complete test-case document.

Tip: you can invoke this with a plan path, e.g.
`/09-test-cases thoughts/shared/plans/2026-07-09-ai-payload-content-grouping.md`
```

Then wait.

## Fast path

If **all** of these hold, collapse Steps 2–3 into a single confirmation and go straight to the outline:

- The input is an approved plan or an analysis doc with explicit acceptance criteria
- Codebase research surfaced no contradictions with that document
- You have zero questions the source doesn't already answer

Say so explicitly — tell the user the plan is clear enough that you're skipping the question round and going straight to the outline. Then present the outline and wait for approval. R1 still holds — outline approval is never optional.

Otherwise, run the full process.

## Step 1 — Context gathering

1. **Read every mentioned file completely.** Use Read with no limit/offset. Do this yourself in the main context *before* spawning anything — you cannot brief a sub-agent on a document you haven't read.

2. **Research the codebase.** Spawn in parallel: `codebase-locator` (feature files + existing tests), `codebase-analyzer` (current behavior, test seams), `codebase-pattern-finder` (test patterns already used in the repo), `thoughts-locator` (related plans/research).
   *If these sub-agents aren't available in your environment, do the equivalent yourself with grep/glob/read — don't skip the research, just do it inline.*

3. **Read everything the research surfaced**, fully.

4. **Present an informed understanding + only the questions research couldn't answer:**

```
Based on the requirement and my codebase research, I understand we need to test [accurate summary].

What I found:
- [Existing test pattern / coverage gap — file:line]
- [Scope constraint taken from the plan]
- [Risk / edge case identified]

Questions the research couldn't answer:
- [Ambiguous business rule / acceptance criterion]
- [Should this scenario be automated or manual?]
- [Environment / platform scope]
```

Asking things the code already answers wastes the user's time and signals you didn't look.

## Step 2 — Discovery

1. If the user corrects you, **verify with fresh research** — don't just accept the correction verbally, since the correction itself may be based on stale memory of the code.
2. Track exploration with TodoWrite.
3. Spawn further parallel agents for remaining gaps; wait for all of them before proceeding.
4. Present coverage options:

```
**Current test coverage:**
- [Automated tests that already exist]
- [Gaps]

**Proposed layering:**
1. Unit — [what]
2. Integration — [what]
3. Manual — [what]

**Open questions:**
- [Decision I need from you]

Does this split match what you expect?
```

## Step 3 — Outline alignment

Propose the structure. **Do not write the file yet.**

```
Proposed test-case structure:

## Overview
[1-2 sentences]

## Test Case Catalogue
1. Unit — [focus]
2. Integration — [focus]
3. Functional / Edge / Error / State — [if applicable]
4. Manual verification — [focus]

Does this structure work?
```

Get feedback before writing details.

## Step 4 — Write the file

**Gate — proceed only when:**
- [ ] Every question to the requester is answered
- [ ] Outline approved
- [ ] No unresolved scope or acceptance decision remains
- [ ] The related plan's `## 5. Out of Scope` section is respected

Any box unchecked → go back to Steps 1–3.

**Path:** `thoughts/shared/test-cases/YYYY-MM-DD-ENG-XXXX-description.md`
- `YYYY-MM-DD` = today's date from the environment, never guessed
- `ENG-XXXX` = ticket number, omitted if there's no ticket
- `description` = short kebab-case English slug
- Examples: `2026-07-13-ENG-1478-parent-child-tracking-test-cases.md`, `2026-07-13-auth-login-test-cases.md`
- Create the directory if it doesn't exist.

### Assigning Priority

Don't leave this to intuition — use these criteria so priorities mean the same thing across documents. **Always prefix the test-case heading with the priority emoji** so importance is visible when skimming.

| Priority | Emoji | When |
|---|---|---|
| **High** | 🔴 | Blocks release: core happy path, data loss/corruption, security, auth, payment, anything irreversible |
| **Medium** | 🟡 | Degraded experience, recoverable errors, secondary flows, non-critical edge cases |
| **Low** | 🟢 | Cosmetic, rare inputs, nice-to-have validation |

**Ordering (required):** Within every category section, list cases **🔴 High → 🟡 Medium → 🟢 Low**. Also put a short `### High Priority` index at the top of `## Test Case Catalogue` listing every 🔴 case (link by ID + title) so critical coverage is visible before any category detail.

Heading format: `#### 🔴 TC-F-001: [title]` / `#### 🟡 TC-E-001: …` / `#### 🟢 TC-M-001: …`

### Requirement IDs

If the source document numbers its requirements, reuse those IDs verbatim. If it doesn't (common with prose PRDs), assign your own (`REQ-001`, `REQ-002`, …) and add a short mapping table under `## Overview` pointing each ID back to a section, heading, or line in the source. Never silently invent a `REQ-001` that traces to nothing.

### Template

Use `assets/test-cases-template.md` as the skeleton — read it before writing anything. If the file is missing or empty, STOP and ask the user; do not improvise a structure.

Keep its ID scheme (`TC-F` / `TC-E` / `TC-ERR` / `TC-ST` / `TC-INT` / `TC-M`), the priority emoji on every heading, and the coverage matrix — those are what make the document skimmable. A category with no cases gets one line saying so, not an empty heading.

## Step 5 — Review

1. Point at the draft and ask for targeted feedback:

```
Test cases written to:
`thoughts/shared/test-cases/YYYY-MM-DD-ENG-XXXX-description.md`

Please review:
- Is the automated / manual split right?
- Are the 🔴 High cases complete, and listed first (index + within each category)?
- Are the success criteria concrete enough (runnable command / measurable result)?
- Any missing edge case, or anything that should be dropped from scope?
- Does the coverage match the plan / acceptance criteria?
```

2. Iterate until they're satisfied.

3. Summarize: total test cases, breakdown by category / automated-vs-manual / priority (🔴/🟡/🟢), assumptions and open follow-ups, file path.

## Guidelines

- **Be skeptical.** Push on vague acceptance criteria. Ask "what happens when X fails?" Verify claims against code rather than trusting the doc.
- **Be interactive.** Don't dump a full suite in one shot — buy-in on the outline is cheaper than a rewrite.
- **Be concrete.** `file:line` references and runnable commands, not "run the tests".
- **Be practical.** Honor out-of-scope. Push flaky or hard-to-automate scenarios into the manual bucket rather than pretending they're automatable.
- **No open questions in the final file.** Resolve them, or park them explicitly as out-of-scope.
- **Priority visible + sorted.** Every case heading and Priority field uses 🔴/🟡/🟢; High cases listed first (index + within each category).
- **Playwright / E2E:** prefer `data-testid`, role, or aria selectors; rely on built-in auto-wait; never recommend `waitForTimeout`.

## Quality checklist

- [ ] Every in-scope requirement has ≥1 test case
- [ ] Automated vs manual is explicit on every case *and* in the suite criteria
- [ ] Unit / Integration / Manual strategy section is filled in
- [ ] Happy path, edge, error, and state (if stateful) all covered
- [ ] `## Out of Scope` documented
- [ ] Priority assigned using the criteria above; heading + field use 🔴/🟡/🟢
- [ ] 🔴 High cases appear in the `### High Priority` index and are listed before 🟡/🟢 within each category
- [ ] IDs unique: TC-F / TC-E / TC-ERR / TC-ST / TC-INT / TC-M
- [ ] Requirement IDs trace to a real source location
- [ ] Steps executable; expected results measurable
- [ ] Coverage matrix complete (includes Priority column with emoji)
- [ ] Filled-in prose Vietnamese; headings, field labels, paths, commands and IDs left as the template writes them
- [ ] File at `thoughts/shared/test-cases/YYYY-MM-DD-...-test-cases.md`

## Example

**User:** "Generate test cases from thoughts/shared/plans/2026-07-09-ai-payload-content-grouping.md"

1. Read the plan fully
2. Research the GUI `content.ts` helpers and existing tests
3. Plan is explicit and research found no contradictions → take the fast path, say so, propose the outline
4. On approval, write `thoughts/shared/test-cases/2026-07-09-ai-payload-content-grouping-test-cases.md`
5. Summarize coverage for review

## References

- `assets/test-cases-template.md` — skeleton for the test-case document (Step 4)
- `references/testing-principles.md` — principles and patterns
- `05-create-plan.md` + `assets/plan-subplan-template.md` — plan verification model (automated vs manual)
- `02-analyzing-requirements.md` — BA analysis input format
---
description: Clarify vague requirements into a signed-off BA analysis document
model: opus
---

## Initial Setup:

When this command is invoked, tell the user immediately (before investigating or asking questions) that BA mode is running. Respond with something like:
```
Running the analyzing-requirements skill (BA mode). I'll investigate the codebase first, then ask clarifying questions before writing the analysis doc.
```
If the user already attached a requirement, README, or feature description, continue into Step 1 right away — do not wait for another prompt. Only ask them to provide the requirement if nothing was given.

# Analyzing Requirements (BA mode)

Turn a vague request into an analysis document precise enough that a developer can implement it without guessing.

**Scope of this command — requirement analysis only.** Stay at the "what and why" level: actors, jobs to be done, scope, user stories, acceptance criteria, business rules, edge cases. Do **not** design the solution here:
- No DB schema — no tables, columns, indexes, relations, migrations.
- No GUI store / state design — no store shape, slices, selectors, cache keys.
- No API contract design — no endpoint list, request/response payloads, error codes.
- No component breakdown or file-level implementation plan.

Those belong to the next commands (`/03-create-schema-store` for the schema + store contract, then `/04`–`/05` for prototype and implementation planning). If research surfaces schema/store/API details, use them only to *understand* the current system and to phrase better questions — describe data in business terms ("each order must record why it was cancelled"), not in schema terms. If the user pushes for schema or store design here, say it's covered by `/03-create-schema-store` and keep this document at requirement level.

**Core principles:**
- **Never guess on the user's behalf.** Only genuine ambiguity (multiple readings, each leading to a different implementation) becomes a question; everything else becomes a stated assumption the user can object to.
- **Never write the file until everything below is locked in**: content confirmed by the user AND a save directory given by the user. Don't default, invent, or guess a directory — ask rather than assume.
- **Language:** converse with the user in whatever language they use. In the output document, structure is English and content is Vietnamese: section headings, field labels, table headers and IDs stay exactly as `assets/detail-spec-template.md` writes them, while everything you fill in is Vietnamese prose, keeping technical terms in English (API, endpoint, race condition, soft delete...) since translating them only makes the doc harder to read.

## Output location

- File name: always **`detail-spec.md`** — never derived from date or feature slug. If the user gives a path already ending in `.md`, use that exact path instead of appending `detail-spec.md`.
- Directory: ask the user for it in Step 3, after content is confirmed. Do not propose one earlier.
- Example: user says `thoughts/analysis/order-cancellation` → file saved at `thoughts/analysis/order-cancellation/detail-spec.md`.

## Workflow

### Step 1 — Investigate before asking

Don't ask immediately. Gather context from the codebase first — never make the user answer something you could have looked up.

1. **Spawn initial research tasks in parallel** (before any clarifying questions):
   - **codebase-locator** — find all files related to the requirement
   - **codebase-analyzer** — understand how the current implementation works end-to-end
   - **thoughts-locator** (if relevant) — find existing thoughts/analysis documents about this area
   - **linear-ticket-reader** (if a Linear ticket is mentioned) — get full ticket details

   These return relevant files/configs/tests, data flow, key functions, and file:line references.

2. **Read all files identified by research tasks, fully, into main context** — this ensures complete understanding before proceeding.

3. **Spawn deeper parallel sub-tasks** when the initial pass exposes multiple areas or integration points:
   - **codebase-locator** — narrower, targeted file searches (e.g. "find all files that handle [specific component]")
   - **codebase-analyzer** — deep-dive on one specific piece flagged by the initial pass
   - **codebase-pattern-finder** — find similar features to model after; note if an existing simple pattern already covers the need, and flag any existing over-engineered pattern instead of copying it
   - **thoughts-analyzer** — extract key insights from the most relevant historical documents
   - **linear-searcher** — find similar past issues or implementations

4. **Wait for all sub-agents to finish, then synthesize:**
   - Prioritize live codebase findings as primary source of truth; treat thoughts/ findings as supplementary historical context
   - Connect findings across components; cite specific file:line references
   - Verify related README.md or `detail-spec.md` files (paths exist, content matches the current requirement)
   - Answer what you can from concrete evidence — only leftover gaps become clarifying questions

5. **Answer these for yourself from the research** (not from guessing):
   - Who is the actor, and what job are they actually trying to get done — not merely what they asked for?
   - What existing data and flows does this touch? (cite file:line)
   - What is genuinely ambiguous versus what you can reasonably assume from the code and prior docs?

### Step 2 — Ask all questions

Surface **every** genuine ambiguity in one pass — don't truncate or hold questions back for a later round. Order by impact: whatever would change the whole design goes first. Only open another round if an answer surfaces a genuinely new problem.

What makes a good question:
- Bundle a default or a set of choices with it: *"When a user deletes a paid order — block it outright, or soft-delete and keep the history? I lean toward soft delete because of reconciliation."*
- Use a tappable question tool (e.g. `ask_user_input_v0`) when options are clear; otherwise ask in plain text.
- Never ask what's already answered in the conversation, in files the user supplied, or in the codebase.

Commonly missed areas — scan for gaps:

| Area | What to pin down |
|---|---|
| Scope | What is explicitly **out** of scope this round? |
| Actors & permissions | Who may do this? Do admins and regular users differ? |
| State & lifecycle | What states exist, what transitions are legal, who may trigger them? |
| Data (business level) | What information must be captured, required vs optional, limits/formats, what happens to data already in the system? Ask about the information, not about tables or columns. |
| Business rules | Conditions, thresholds, formulas, precedence when rules conflict? |
| Integrations | Any external system? What if it errors or times out? |
| Non-functional | Expected volume, latency, concurrency, audit logging? |
| Failure | What does the user see on error? Is there a rollback? |

### Step 3 — Confirm before writing

1. Summarize briefly what's been agreed plus the list of assumptions. Ask explicitly whether it looks right; if amended, update and re-confirm.
2. Once content is confirmed, ask for the **save directory** (file name is fixed — see Output location). Ask in the language the user is using; the question is which directory, since the file name is fixed at `<directory>/detail-spec.md`.
3. Only proceed to Step 4 once both content and directory are confirmed.

### Step 4 — Write the document

Write to `<directory>/detail-spec.md` (per Output location), using `assets/detail-spec-template.md` as the skeleton — read it before writing. Create the directory if it doesn't exist. Drop any section that doesn't apply rather than leaving it empty or inventing filler.

## Content quality

- **Acceptance criteria must be verifiable.** "the system responds quickly" is meaningless; "returns within 2 seconds with 10k records" is usable. Every AC should map to a test case.
- **Number everything** (US-, AC-, BR-, EC-, GD-, Q-) so it can be referenced later in PRs, tests, and discussions.
- **Keep settled facts and open assumptions apart.** Assumptions live in section 7 — don't smuggle them into business rules as though decided.
- **Stay solution-free.** Before writing a line, check it isn't a design decision in disguise: no table/column names, no store shape, no endpoint signatures, no component names. If it reads like something a dev would copy into a migration or a store file, it belongs in `/03-create-schema-store`, not here.
- Be concise. Prefer bullets and tables. Two accurate pages beat ten rambling ones.

## After the file exists

Tell the user where it landed (full path) and flag anything left in `## 8. Open Questions`. Then point them to the next step — `/03-create-schema-store` to turn the confirmed requirement into a DB schema + GUI store contract. Don't design the schema/store and don't start coding uninvited.

## Files

- `assets/detail-spec-template.md` — skeleton for `detail-spec.md`, written in Vietnamese (Step 4).
- `references/ba-checklist.md` — the 10-category checklist used to find gaps.

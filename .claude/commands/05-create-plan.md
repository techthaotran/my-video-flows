---
description: Create detailed implementation plans with thorough research and iteration
model: opus
---

# Implementation Plan

You are tasked with creating detailed implementation plans through an interactive, iterative process. You should be skeptical, thorough, and work collaboratively with the user to produce high-quality technical specifications.

## Mandatory Rules

1. **Only create the plan files when all questions to the requester are resolved**
   - Do NOT create any plan file while open questions remain, requirements are vague, or the requester has not answered.
   - Complete Steps 1–3 (research, clarification, approach alignment) before writing the files.
   - If new questions arise while writing the plan → STOP, ask the requester, wait for answers, then continue.

2. **Every plan must be split into 4 files: master, common, API, GUI**
   - When the task touches both API (backend) and GUI (frontend), the plan output is always **4 separate files**, not one:
     1. **Master plan** (`...-description.md`) — the single source of truth for **context and decisions**: TL;DR, current state, design decisions, flow diagram, the work matrix (every item + its scope + its phase + dependencies), out-of-scope, end-to-end verification, references.
     2. **Plan common** (`...-description-common.md`) — anything shared/used by both sides: DB schema, shared types/contracts, shared utils/config, cross-cutting conventions.
     3. **Plan API** (`...-description-api.md`) — backend-only implementation (endpoints, services, business logic, DB access).
     4. **Plan GUI** (`...-description-gui.md`) — frontend-only implementation (components, stores, API integration, UI/UX).
   - If the task is genuinely single-sided (pure API-only or pure GUI-only, nothing shared), state this explicitly in the master plan's work matrix and skip creating the sub-plan(s) that don't apply — one line of reasoning in the matrix, not silent omission.
   - **No information may appear in more than one file.** Context, decisions, out-of-scope and references live only in the master plan; sub-plans open with a reference line back to it (`xem master plan section 1, 2, 5, 7`) and contain only their deltas plus `## Phase N` sections. A sub-plan that restates the master plan's context is invalid.
   - **Traceability runs through the work matrix** (master plan, section 4): every row names exactly one scope, one phase, and one sub-plan file; every sub-plan phase cites the matrix rows it implements. Nothing is planned in the master plan alone, and nothing appears in a sub-plan without a matrix row.
   - Cross-file pointers use plain wording — `xem master plan section 4`, `xem plan API, Phase 2` — never symbols like `§`.

3. **Always ask the user where to save the plan before writing any file — mandatory, no default**
   - Before creating any plan file, explicitly ask the user which directory/location to save the plan set into — there is no default, the user must state a path (e.g. a ticket-specific or feature-specific subfolder).
   - Do NOT assume the default path and start writing — this confirmation is required every time, even if a previous plan in the same conversation used a given location.
   - Wait for the user's explicit answer before proceeding to Step 4's file-writing sub-steps.
   - Once confirmed, use that location as the base directory for all 4 files (master + applicable sub-plans), keeping them together in the same directory.

4. **Plan file output: English structure, Vietnamese content**
   - Section headings, field labels and table headers come from the templates in `assets/` and stay verbatim in English — do not translate or renumber them.
   - Everything written into those sections MUST be **Vietnamese** prose so the requester can review easily, with English kept for file paths, code paths, variable/function/class names, CLI commands, and code snippets.
   - This applies only to the **plan file output** — not to this command file or chat responses during the planning process.

5. **Must follow refactor skill when creating a plan**
   - Read and apply `/skills/refactor/SKILL.md` BEFORE writing the plan — especially the **MUST INTERNALIZE** section.
   - The AI MUST understand and apply all five named principles (not just list the acronyms): **KISS, DRY, YAGNI, SOLID, Clean Code**, plus performance and error-handling rules.
   - The refactor block lives **only in the master plan** (section 2), and lists only the principles that actually changed a decision in this plan; a principle with no impact is written `N/A`. Restating a principle's definition, or writing vague "follow best practices", is invalid — as is repeating the block in a sub-plan.
   - Do NOT plan complex code to refactor later — design for simplicity from the start.

6. **Plan output must include an internal workflow diagram**
   - The **master plan** MUST contain a workflow diagram (using Mermaid syntax) that visualizes the overall internal flow of the feature/task, showing how the common/API/GUI parts interact (e.g., request/data flow, sequence between components, or state transitions).
   - The diagram goes in `## 3. Flow Diagram` of the master plan (see `assets/plan-master-template.md`).
   - Each sub-plan (common/API/GUI) MAY include its own more detailed diagram for its scope when useful; it is mandatory only in the master plan.
   - The diagram must reflect the actual components/files identified during research (Step 1–2), not a generic placeholder.
   - If the task genuinely has no meaningful internal flow to diagram (e.g., a one-line config change), state that explicitly in that section instead of omitting it — do not skip the section silently.

7. **Reuse research when the input is already pre-analyzed**
   - If the input is a `detail-spec.md` or an equivalent already-researched document (e.g. output of BA mode / the `analyzing-requirements` skill) → run **Step 0 — Reuse check** before Step 1, and only research the gap (technical patterns, test conventions, refactor compliance) — do not re-research business logic that's already settled.
   - If you're not sure the earlier context is still intact in the conversation (it may have been compacted/truncated in a long chat) → verify by re-reading the file rather than blindly trusting what's in context.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a file path or ticket reference was provided as a parameter, skip the default message
   - Immediately read any provided files FULLY
   - **If the provided file is a `detail-spec.md` (BA mode output) or similar pre-analyzed doc** → after reading it fully, go to **Step 0 — Reuse check** before spawning any research.
   - Otherwise, begin the normal research process (Step 1)

2. **If no parameters provided**, respond with:
```
I'll help you create a detailed implementation plan. Let me start by understanding what we're building.

Please provide:
1. The task/ticket description (or reference to a ticket file)
2. Any relevant context, constraints, or specific requirements
3. Links to related research or previous implementations

I'll analyze this information and work with you to create a comprehensive plan.

Tip: You can also invoke this command with a ticket file directly: `/create_plan thoughts/allison/tickets/eng_1234.md`
For deeper analysis, try: `/create_plan think deeply about thoughts/allison/tickets/eng_1234.md`
```

Then wait for the user's input.

## Process Steps

### Step 0 — Reuse check (only applies when the input is already pre-researched)

Goal: avoid re-researching what's already known; only look into what's still missing. Critically, the agent must make this reasoning **visible to the user** — don't silently decide what to skip.

1. **Content already "settled" in `detail-spec.md`** (User Stories, Acceptance Criteria, Business Rules, Edge Cases, Scope, Assumptions) → treat as ALREADY ANSWERED. Don't ask the user again, and don't spawn research to re-verify these items unless there's a sign of conflict with the actual code.

2. **Check for existing context earlier in the same chat window**:
   - If file:line references and the current-flow analysis were already read FULL into context in a previous turn (e.g. during BA mode) and are still intact in the conversation → don't re-read them, don't spawn `codebase-analyzer` for that same part again.
   - If unsure (long conversation, suspicion it may have been summarized/truncated) → do a quick verify by re-reading once, don't assume.

3. **Identify the gap** — only the following ALWAYS need fresh research, since BA mode isn't responsible for finding them:
   - Similar technical patterns to model after (`codebase-pattern-finder`)
   - Existing test conventions, build/lint commands (`make test`, `npm run lint`...)
   - Compliance check against `/skills/refactor/SKILL.md` (KISS/DRY/YAGNI/SOLID/Clean Code)
   - Any code area `detail-spec.md` / prior context hasn't covered

4. **Only spawn sub-agents for the gap identified in item 3.**

5. **Report the reuse decision to the user before starting research**, using this format:
   ```
   Reuse check before research:

   Already available (not researching again):
   - [Item / business rule / file:line — source: detail-spec.md section X, or "read in full earlier this session"]
   - ...

   Missing, will research this round:
   - [Technical pattern to find]
   - [Test/lint convention to check]
   - [Refactor compliance to verify]
   - [Code area not yet covered]
   ```
   - This list must be shown **before** spawning sub-agents, not folded silently into Step 1's "Present informed understanding" — the user should see the reuse decision as its own explicit step.
   - If Step 0 doesn't apply (no pre-analyzed input), skip this report and go straight into Step 1.

If the input isn't a pre-analyzed doc → skip Step 0 entirely and go straight into Step 1 as normal.

### Step 1: Context Gathering & Initial Analysis

1. **Read all mentioned files immediately and FULLY**:
   - Ticket files (e.g., `thoughts/allison/tickets/eng_1234.md`)
   - Research documents
   - Related implementation plans
   - Any JSON/data files mentioned
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: DO NOT spawn sub-tasks before reading these files yourself in the main context
   - **NEVER** read files partially - if a file is mentioned, read it completely

2. **Spawn initial research tasks to gather context** (respecting Step 0's gap list if applicable):
   Before asking the user any questions, use specialized agents to research in parallel — but only for what Step 0 identified as a gap, or for everything if Step 0 was skipped:

   - Use the **codebase-locator** agent to find all files related to the ticket/task
   - Use the **codebase-analyzer** agent to understand how the current implementation works
   - If relevant, use the **thoughts-locator** agent to find any existing thoughts documents about this feature
   - If a Linear ticket is mentioned, use the **linear-ticket-reader** agent to get full details

   These agents will:
   - Find relevant source files, configs, and tests
   - Trace data flow and key functions
   - Return detailed explanations with file:line references

3. **Read all files identified by research tasks**:
   - After research tasks complete, read ALL files they identified as relevant
   - Read them FULLY into the main context
   - This ensures you have complete understanding before proceeding

4. **Analyze and verify understanding**:
   - Cross-reference the ticket requirements with actual code
   - Identify any discrepancies or misunderstandings
   - Note assumptions that need verification
   - Determine true scope based on codebase reality

5. **Present informed understanding and focused questions**:
   ```
   Based on the ticket/detail-spec.md and my research of the codebase, I understand we need to [accurate summary].

   Newly found this round (beyond what Step 0 already listed as reused):
   - [Current implementation detail with file:line reference]
   - [Relevant pattern or constraint discovered]
   - [Potential complexity or edge case identified]

   Questions that my research couldn't answer:
   - [Specific technical question that requires human judgment]
   - [Business logic clarification]
   - [Design preference that affects implementation]
   ```

   Only ask questions that you genuinely cannot answer through code investigation OR that are still listed as open in detail-spec.md's `## 8. Open Questions` section. If Step 0 ran, don't repeat its "already have" list here — just reference it and add anything new.

### Step 2: Research & Discovery

After getting initial clarifications:

1. **If the user corrects any misunderstanding**:
   - DO NOT just accept the correction
   - Spawn new research tasks to verify the correct information
   - Read the specific files/directories they mention
   - Only proceed once you've verified the facts yourself

2. **Create a research todo list** using TodoWrite to track exploration tasks

3. **Spawn parallel sub-tasks for comprehensive research**:
   - Create multiple Task agents to research different aspects concurrently
   - Use the right agent for each type of research:

   **For deeper investigation:**
   - **codebase-locator** - To find more specific files (e.g., "find all files that handle [specific component]")
   - **codebase-analyzer** - To understand implementation details (e.g., "analyze how [system] works")
   - **codebase-pattern-finder** - To find similar features we can model after — while researching, note whether an existing simple pattern (plain function / lookup map) already covers the need; flag any existing over-engineered pattern instead of copying it

   **For historical context:**
   - **thoughts-locator** - To find any research, plans, or decisions about this area
   - **thoughts-analyzer** - To extract key insights from the most relevant documents

   **For related tickets:**
   - **linear-searcher** - To find similar issues or past implementations

   Each agent knows how to:
   - Find the right files and code patterns
   - Identify conventions and patterns to follow
   - Look for integration points and dependencies
   - Return specific file:line references
   - Find tests and examples

3. **Wait for ALL sub-tasks to complete** before proceeding

4. **Present findings and design options**:
   ```
   Based on my research, here's what I found:

   **Current State:**
   - [Key discovery about existing code]
   - [Pattern or convention to follow]

   **Design Options:**
   1. [Option A] - [pros/cons]
   2. [Option B] - [pros/cons]

   **Refactor-skill check (all five — required):**
   - **KISS**: [Which option is the simplest form — plain function vs lookup map vs full pattern]
   - **DRY**: [Where shared logic would live; what duplication to avoid]
   - **YAGNI**: [Any option ruled out for speculative / "flexible later" design]
   - **SOLID**: [SRP boundaries; whether DIP/OCP is needed at a real boundary, or would just add layers]
   - **Clean Code**: [Naming/structure expectations for the chosen option]

   **Open Questions:**
   - [Technical uncertainty]
   - [Design decision needed]

   Which approach aligns best with your vision?
   ```

### Step 3: Plan Structure Development

Once aligned on approach:

1. **Create initial plan outline**:
   ```
   Here's my proposed plan structure:

   ## Overview
   [1-2 sentence summary]

   ## Implementation Phases:
   1. [Phase name] - [what it accomplishes]
   2. [Phase name] - [what it accomplishes]
   3. [Phase name] - [what it accomplishes]

   Does this phasing make sense? Should I adjust the order or granularity?
   ```

2. **Gate — quick refactor-skill sanity check before detailing** (all five; do not skip SOLID/Clean Code):
   - [ ] **YAGNI**: Does any phase introduce a class/interface/pattern with only one real use case today? → simplify
   - [ ] **DRY**: Does any phase duplicate logic that already exists elsewhere? → flag for extraction
   - [ ] **KISS**: Is there a simpler phasing (fewer moving parts) that still satisfies the requirements?
   - [ ] **SOLID**: Are responsibilities split cleanly (no god module planned)? Is DIP only at real external boundaries?
   - [ ] **Clean Code**: Will the planned units stay small, named by intent, with guard-clause-friendly shape (not nested mega-functions)?
   - If any box fails, revise the outline before moving to Step 4 — do not carry over-engineered structure into the detailed plan.

3. **Get feedback on structure** before writing details — do NOT create any plan file at this step
   - As part of this structure feedback, also confirm the **common / API / GUI classification** (see Step 4.2 below) with the user before writing the 4 files.

### Step 4: Detailed Plan Writing

**Prerequisites — proceed only when:**
- [ ] All questions to the requester have been answered clearly
- [ ] Approach is aligned (Step 3 complete, including the Step 3 gate)
- [ ] No unresolved technical or business decisions remain
- [ ] `/skills/refactor/SKILL.md` has been read and applied to the design

If prerequisites are not met → return to Steps 1–3; do NOT create the plan files.

After structure approval:

1. **Read refactor skill** — read `/skills/refactor/SKILL.md` and ensure every phase in every plan file follows its principles.

2. **Classify every piece of work into common / API / GUI** before writing files:
   - **Common**: DB schema/migration, shared types/DTOs/contracts, shared utils/config, cross-cutting conventions used by both sides.
   - **API**: backend-only — endpoints, services, business logic, DB access code, backend validation/auth.
   - **GUI**: frontend-only — components, stores, API-client integration, UI/UX, client-side validation.
   - If the task is genuinely single-sided (no shared/common work, or no API work, or no GUI work), note that explicitly — the master plan still documents the decision, but the inapplicable sub-plan file(s) are skipped.

3. **Ask the user where to save the plan — mandatory, do this before writing any file**:
   - Ask explicitly which directory the plan set goes into — do not suggest or imply a default location; require the user to state a path.
   - Wait for the user's explicit answer before proceeding.
   - Use the confirmed directory as `<plan-dir>` for the rest of this step — all 4 files live together in `<plan-dir>`.

4. **Determine the file set** in `<plan-dir>`, using a shared `YYYY-MM-DD-ENG-XXXX-description` base name:
   - `<plan-dir>/YYYY-MM-DD-ENG-XXXX-description.md` — **master plan** (always created)
   - `<plan-dir>/YYYY-MM-DD-ENG-XXXX-description-common.md` — **plan common** (created when there is shared work)
   - `<plan-dir>/YYYY-MM-DD-ENG-XXXX-description-api.md` — **plan API** (created when there is backend work)
   - `<plan-dir>/YYYY-MM-DD-ENG-XXXX-description-gui.md` — **plan GUI** (created when there is frontend work)
   - YYYY-MM-DD is today's date; ENG-XXXX is the ticket number (omit if no ticket); description is a brief kebab-case description.
   - Example set (given a confirmed `<plan-dir>`): `2025-01-08-ENG-1478-parent-child-tracking.md`, `...-common.md`, `...-api.md`, `...-gui.md`

5. **Read the template files first — mandatory**:
   - Read `assets/plan-master-template.md` (master skeleton) and `assets/plan-subplan-template.md` (sub-plan skeleton) before writing anything.
   - If either file is missing or empty, STOP and ask the user — do not improvise a structure from memory.

6. **Write the master plan first**, using `assets/plan-master-template.md` as the skeleton. Its section headings, field labels and table headers are English and stay verbatim; everything you write into them is **Vietnamese** prose.
   - Fill the TL;DR box and sections 1–7; leave no template placeholder in the output.
   - Sections 3 (flow diagram) and 4 (work matrix) are mandatory (Rules 2 and 6). The matrix is written **before** the sub-plans — it is what the sub-plans implement.
   - A section with genuinely nothing to say gets `N/A`, not filler prose.

7. **Write each applicable sub-plan** (`-common.md`, `-api.md`, `-gui.md`) using `assets/plan-subplan-template.md` — same rule: English structure, Vietnamese content.
   - A sub-plan is read **together with** the master plan, not instead of it: it must not restate context, decisions, out-of-scope, or references.
   - Content is limited to `## Deviations from Master Plan` (default `N/A`) plus `## Phase N` sections, each citing the matrix rows it implements.
   - Prefer one bullet per file touched (`path — what changes`); include a code block only when a bullet cannot convey the intent.

### Step 5: Sync and Review

1. **Sync the thoughts directory**:
   - This ensures all created plan files (master + applicable sub-plans) are properly indexed and available

2. **No-duplication check** (the core invariant of this format):
   - [ ] Every row of the work matrix (master plan, section 4) maps to exactly one phase in exactly one sub-plan; every sub-plan phase cites its matrix rows — no orphans in either direction
   - [ ] No sub-plan restates context, design decisions, out-of-scope, references, or the refactor block — each opens with the reference line back to the master plan
   - [ ] Sub-plans intentionally skipped are explained in one line inside the matrix, not silently absent
   - [ ] Phase numbering in the matrix matches the actual `## Phase N` headings in each sub-plan
   - [ ] No contradicting technical decisions between the master plan and any sub-plan
   - [ ] Empty sections read `N/A`; no section padded with restated prose
   - [ ] Cross-references use `section N` / `Phase N` wording — no `§` symbols

3. **Final refactor-skill gate before presenting** — run this for the master plan AND each sub-plan file, mapping explicitly to the skill's five principles + Final Checklist:
   - [ ] Behavior/scope stays as agreed — no speculative extras (**YAGNI**)
   - [ ] No phase introduces abstractions beyond what today's requirements justify (**KISS** / **YAGNI**)
   - [ ] No duplicated logic across phases or across sub-plans (**DRY**) — shared logic lives in the common plan, not copy-pasted into API/GUI
   - [ ] Responsibilities/boundaries between common/API/GUI are clear; no god phase/module; DIP only where needed (**SOLID**)
   - [ ] Planned units favor small, well-named, guard-clause-friendly code; no planned dead/commented scaffolding (**Clean Code**)
   - [ ] The refactor block in the master plan (section 2) names a concrete decision per listed principle, and `N/A` where a principle had no impact — no restated definitions, no copy in any sub-plan
   - [ ] Performance and error-handling call-outs present where loops/parsing/lookups or an external data/API boundary are involved (otherwise `N/A`)
   - [ ] section 3 (flow diagram) reflects the actual components/files from research (not a generic placeholder)
   - If any item fails, revise the relevant plan file(s) before presenting them to the user.

4. **Present the draft plan locations**:
   ```
   I've created the implementation plan at:
   `<plan-dir>/YYYY-MM-DD-ENG-XXXX-description.md` (master)
   `<plan-dir>/YYYY-MM-DD-ENG-XXXX-description-common.md` (common)
   `<plan-dir>/YYYY-MM-DD-ENG-XXXX-description-api.md` (API)
   `<plan-dir>/YYYY-MM-DD-ENG-XXXX-description-gui.md` (GUI)
   (`<plan-dir>` = the location confirmed with the user in Step 4.3)
   [omit any sub-plan file that wasn't applicable, and say why]

   Please review it and let me know:
   - Is the work matrix (section 4) complete, and is each item in the right scope?
   - Are the phases properly scoped and correctly sequenced?
   - Are the verify steps specific enough (automated vs manual)?
   - Any technical details that need adjustment? Missing edge cases?
   - Do the design decisions in section 2 match what you had in mind?
   - Does the workflow diagram (section 3) reflect the real flow across common/API/GUI?
   ```

5. **Iterate based on feedback** - be ready to:
   - Add missing phases in the correct sub-plan, adding the matching matrix row in the same edit
   - Adjust technical approach, including re-classifying an item between common/API/GUI
   - Clarify verify steps (both automated and manual)
   - Add/remove scope items
   - Refine the workflow diagram
   - Any change touches the matrix and the sub-plan together — never one without the other

6. **Continue refining** until the user is satisfied with all files

## Important Guidelines

1. **Be Skeptical**:
   - Question vague requirements
   - Identify potential issues early
   - Ask "why" and "what about"
   - Don't assume - verify with code

2. **Be Interactive**:
   - Don't write the full plan in one shot
   - Get buy-in at each major step
   - Allow course corrections
   - Work collaboratively

3. **Be Thorough**:
   - Read all context files COMPLETELY before planning
   - Research actual code patterns using parallel sub-tasks
   - Include specific file paths and line numbers
   - Write measurable success criteria with clear automated vs manual distinction

4. **Be Practical**:
   - Focus on incremental, testable changes
   - Consider migration and rollback
   - Think about edge cases
   - Include "what we're NOT doing"

5. **Track Progress**:
   - Use TodoWrite to track planning tasks
   - Update todos as you complete research
   - Mark planning tasks complete when done

6. **No Open Questions in Final Plan**:
   - If open questions arise during planning → STOP
   - Research or ask the requester immediately
   - Do NOT create any of the plan files while unanswered questions remain
   - Every plan file must be complete and immediately actionable
   - Every decision must be made before finalizing the plan, including the common/API/GUI classification itself

7. **Follow refactor skill (AI must understand all five)**:
   - Read `/skills/refactor/SKILL.md` before writing the plan — internalize KISS, DRY, YAGNI, SOLID, Clean Code from the MUST INTERNALIZE table
   - Every phase must design for: simple code (**KISS**), no duplication (**DRY**), no speculative structure (**YAGNI**), clear responsibilities/boundaries (**SOLID**), readable small units (**Clean Code**)
   - Where relevant, call out: single-pass loops, parse/cast once, safe JSON/API wrappers, boundary validation
   - If proposing a design pattern → explain why a lookup map or plain function is insufficient (**KISS** / **YAGNI**)
   - Apply the five-principle check at Step 2 and at the Step 3 gate; record only the principles that changed a decision in the master plan (section 2); re-run the Final Checklist at Step 5 before presenting

8. **Include a workflow diagram**:
   - The master plan must include a `## 3. Flow Diagram` section with a Mermaid diagram covering the overall common/API/GUI flow
   - Base the diagram on the real components/files found during research, not generic boxes
   - If there is truly no meaningful internal flow, state that explicitly instead of omitting the section

9. **Reuse research from a preceding skill in the same chat**:
   - When input is a `detail-spec.md` (or similar pre-analyzed doc), run **Step 0 — Reuse check** first
   - Never re-ask questions already answered in `detail-spec.md`'s confirmed sections
   - Never re-run `codebase-analyzer` on files already read FULL into the current context earlier in the same conversation, unless there's reason to doubt that context is still intact
   - Always research fresh for: pattern-finding, test/lint conventions, and refactor-skill compliance — these are outside BA mode's scope

10. **Always split into 4 files (master / common / API / GUI)**:
    - The work matrix in the master plan classifies every piece of work as common, API, or GUI — no unclassified item
    - Each sub-plan holds only its deltas plus its `## Phase N` sections; context and decisions stay in the master plan
    - Skip a sub-plan file only when that scope genuinely has no work, and say so in one line inside the matrix

11. **Write for the reader, not for the checklist**:
    - Each fact appears exactly once across the whole plan set; elsewhere, reference it (`xem master plan section 2`)
    - Prefer short bullets over prose; one bullet per file touched
    - A section with nothing to say gets `N/A` — never padding
    - Code blocks only when a bullet cannot convey the intent

## Success Criteria Guidelines

**Always separate success criteria into two categories:**

1. **Automated Verification** (can be run by execution agents):
   - Commands that can be run: `make test`, `npm run lint`, etc.
   - Specific files that should exist
   - Code compilation/type checking
   - Automated test suites

2. **Manual Verification** (requires human testing):
   - UI/UX functionality
   - Performance under real conditions
   - Edge cases that are hard to automate
   - User acceptance criteria

**Format** — inside each `## Phase N` of a sub-plan, as a two-line **Verify** block (see `assets/plan-subplan-template.md`):
```markdown
**Verify**
- Automated: `make migrate` · `go test ./...` · `golangci-lint run`
- Manual: [what a human opens, does, and should see]
```
End-to-end verification that spans scopes goes in the master plan (section 6) instead — not repeated per sub-plan.

## Common Patterns

### For Database Changes:
- Start with schema/migration
- Add store methods
- Update business logic
- Expose via API
- Update clients

### For New Features:
- Research existing patterns first
- Start with data model
- Build backend logic
- Add API endpoints
- Implement UI last

### For Refactoring:
- Read and follow `/skills/refactor/SKILL.md`
- Document current behavior
- Plan incremental changes
- Maintain backwards compatibility
- Include migration strategy
- Design simpler than existing code (KISS), never more complex

## Sub-task Spawning Best Practices

See `references/subagent-research.md` — when to spawn, how to write the prompt, which agent for which job, and how to verify results.

## Example Interaction Flow

```
User: /implementation_plan
Assistant: I'll help you create a detailed implementation plan...

User: We need to add parent-child tracking for Claude sub-tasks. See thoughts/allison/tickets/eng_1478.md
Assistant: Let me read that ticket file completely first...

[Reads file fully]

Based on the ticket, I understand we need to track parent-child relationships for Claude sub-task events in the daemon. Before I start planning, I have some questions...

[Interactive process continues...]
```

## Files

- `assets/plan-master-template.md` — skeleton for the **master plan** (used in Step 4.6).
- `assets/plan-subplan-template.md` — skeleton for each **sub-plan** (common / API / GUI, used in Step 4.7).
- `/skills/refactor/SKILL.md` — mandatory coding principles applied to every plan file (Rule 5).
- `references/subagent-research.md` — how to spawn and verify research sub-agents (Steps 1–2).

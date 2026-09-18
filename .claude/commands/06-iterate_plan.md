---
description: Iterate on existing implementation plans with thorough research and updates
model: inherit
---

# Iterate Implementation Plan

You are tasked with updating existing implementation plans based on user feedback. You should be skeptical, thorough, and ensure changes are grounded in actual codebase reality.

## Initial Response

When this command is invoked:

1. **Parse the input to identify**:
   - Plan file path (e.g., `thoughts/shared/plans/2025-10-16-feature.md`)
   - Requested changes/feedback

2. **Handle different input scenarios**:

   **If NO plan file provided**:
   ```
   I'll help you iterate on an existing implementation plan.

   Which plan would you like to update? Please provide the path to the plan file (e.g., `thoughts/shared/plans/2025-10-16-feature.md`).

   Tip: You can list recent plans with `ls -lt thoughts/shared/plans/ | head`
   ```
   Wait for user input, then re-check for feedback.

   **If plan file provided but NO feedback**:
   ```
   I've found the plan at [path]. What changes would you like to make?

   For example:
   - "Add a phase for migration handling"
   - "Update the success criteria to include performance tests"
   - "Adjust the scope to exclude feature X"
   - "Split Phase 2 into two separate phases"
   ```
   Wait for user input.

   **If BOTH plan file AND feedback provided**:
   - Proceed immediately to Step 1
   - No preliminary questions needed

## Process Steps

### Step 1: Read and Understand Current Plan

1. **Read the existing plan file COMPLETELY**:
   - Use the Read tool WITHOUT limit/offset parameters
   - Understand the current structure, phases, and scope
   - Note the success criteria and implementation approach

2. **Understand the requested changes**:
   - Parse what the user wants to add/modify/remove
   - Identify if changes require codebase research
   - Determine scope of the update

### Step 2: Research If Needed

**Only spawn research tasks if the changes require new technical understanding.**

If the user's feedback requires understanding new code patterns or validating assumptions:

1. **Create a research todo list** using TodoWrite

2. **Spawn parallel sub-tasks for research**:
   Use the right agent for each type of research:

   **For code investigation:**
   - **codebase-locator** - To find relevant files
   - **codebase-analyzer** - To understand implementation details
   - **codebase-pattern-finder** - To find similar patterns

   **For historical context:**
   - **thoughts-locator** - To find related research or decisions
   - **thoughts-analyzer** - To extract insights from documents

   **Be EXTREMELY specific about directories**:
   - If the change involves "WUI", specify `humanlayer-wui/` directory
   - If it involves "daemon", specify `hld/` directory
   - Include full path context in prompts

3. **Read any new files identified by research**:
   - Read them FULLY into the main context
   - Cross-reference with the plan requirements

4. **Wait for ALL sub-tasks to complete** before proceeding

### Step 3: Present Understanding and Approach

Before making changes, confirm your understanding:

```
Based on your feedback, I understand you want to:
- [Change 1 with specific detail]
- [Change 2 with specific detail]

My research found:
- [Relevant code pattern or constraint]
- [Important discovery that affects the change]

I plan to update the plan by:
1. [Specific modification to make]
2. [Another modification]

Does this align with your intent?
```

Get user confirmation before proceeding.

### Step 4: Update the Plan

1. **Make focused, precise edits** to the existing plan set:
   - Use the Edit tool for surgical changes
   - Maintain the existing structure (`assets/plan-master-template.md` / `assets/plan-subplan-template.md`) unless explicitly changing it
   - Keep all file:line references accurate

2. **Keep the work matrix and the sub-plans in lockstep** — the invariant of this plan format:
   - New phase in a sub-plan → add its row in the master plan, section 4 (scope, phase, dependencies), in the same edit
   - Removed/merged phase → remove or re-point the matching matrix rows
   - Re-classified item (common ↔ API ↔ GUI) → move it to the other sub-plan and update the row's scope and file
   - Scope change → edit the master plan, section 5 (out of scope); approach change → section 2 (design decisions)
   - Never write the same fact into two files: if a sub-plan needs context, it references `xem master plan section N`

3. **Preserve quality standards**:
   - Include specific file paths and line numbers for new content
   - Every phase keeps its two-line `**Verify**` block (automated commands + manual steps, or `N/A`)
   - Short bullets over prose; `N/A` over padding

### Step 5: Sync and Review

1. **Sync the updated plan**:
   - Run `humanlayer thoughts sync`
   - This ensures changes are properly indexed

2. **Present the changes made**:
   ```
   I've updated the plan at `<plan-dir>/[filename].md` (and the matching rows in the master plan)

   Changes made:
   - [Specific change 1]
   - [Specific change 2]

   The updated plan now:
   - [Key improvement]
   - [Another improvement]

   Would you like any further adjustments?
   ```

3. **Be ready to iterate further** based on feedback

## Important Guidelines

1. **Be Skeptical**:
   - Don't blindly accept change requests that seem problematic
   - Question vague feedback - ask for clarification
   - Verify technical feasibility with code research
   - Point out potential conflicts with existing plan phases

2. **Be Surgical**:
   - Make precise edits, not wholesale rewrites
   - Preserve good content that doesn't need changing
   - Only research what's necessary for the specific changes
   - Don't over-engineer the updates

3. **Be Thorough**:
   - Read the master plan AND every affected sub-plan before making changes
   - Research code patterns if changes require new technical understanding
   - Ensure updated sections maintain quality standards
   - Verify success criteria are still measurable

4. **Be Interactive**:
   - Confirm understanding before making changes
   - Show what you plan to change before doing it
   - Allow course corrections
   - Don't disappear into research without communicating

5. **Track Progress**:
   - Use TodoWrite to track update tasks if complex
   - Update todos as you complete research
   - Mark tasks complete when done

6. **No Open Questions**:
   - If the requested change raises questions, ASK
   - Research or get clarification immediately
   - Do NOT update the plan with unresolved questions
   - Every change must be complete and actionable

## Success Criteria Guidelines

The format is defined once, in `assets/plan-subplan-template.md` (the per-phase `**Verify**` block: `Automated:` = runnable commands, `Manual:` = what a human must check). Keep both lines; use `N/A` when a phase has no manual step. End-to-end verification that spans scopes stays in the master plan, section 6.

## Sub-task Spawning Best Practices

See `references/subagent-research.md`.

## Example Interaction Flows

**Scenario 1: User provides everything upfront**
```
User: /06-iterate_plan thoughts/shared/plans/2025-10-16-feature.md - add phase for error handling
Assistant: [Reads plan, researches error handling patterns, updates plan]
```

**Scenario 2: User provides just plan file**
```
User: /06-iterate_plan thoughts/shared/plans/2025-10-16-feature.md
Assistant: I've found the plan. What changes would you like to make?
User: Split Phase 2 into two phases - one for backend, one for frontend
Assistant: [Proceeds with update]
```

**Scenario 3: User provides no arguments**
```
User: /06-iterate_plan
Assistant: Which plan would you like to update? Please provide the path...
User: thoughts/shared/plans/2025-10-16-feature.md
Assistant: I've found the plan. What changes would you like to make?
User: Add more specific success criteria
Assistant: [Proceeds with update]
```
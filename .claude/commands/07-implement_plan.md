---
description: Implement technical plans from thoughts/shared/plans with verification
---

# Implement Plan

You are tasked with implementing an approved technical plan from `thoughts/shared/plans/`. These plans contain phases with specific changes and success criteria.

## Getting Started

When given a plan path:
- Read the **master plan** completely — section 1 (current state), section 2 (design decisions), section 3 (flow diagram), section 4 (work matrix)
- Then read the sub-plan you're implementing (`-common.md` / `-api.md` / `-gui.md`); a sub-plan is read together with the master plan, never alone
- Follow the matrix order in section 4 — common first, then API, then GUI, respecting the dependency column
- Check which phase headings are already marked ✅ (done) before starting
- Read the original ticket and all files mentioned in the plan
- **Read files fully** - never use limit/offset parameters, you need complete context
- Read `/skills/refactor/SKILL.md` before writing any code — every line you write must follow its KISS/DRY/YAGNI/SOLID/Clean Code rules, Performance Rules, and Error-Handling Rules. The plan was designed with this skill in mind; your implementation must honor it too, not just the plan's wording.
- Think deeply about how the pieces fit together
- Create a todo list to track your progress
- Start implementing if you understand what needs to be done

If no plan path provided, ask for one.

## Implementation Philosophy

Plans are carefully designed, but reality can be messy. Your job is to:
- Follow the plan's intent while adapting to what you find
- Implement each phase fully before moving to the next
- Verify your work makes sense in the broader codebase context
- Mark progress by appending ` ✅` to the phase heading in the sub-plan once its automated verification passes
- Write code that already passes the refactor skill's Final Checklist on the first attempt — don't plan to "clean it up later"

When things don't match the plan exactly, think about why and communicate clearly. The plan is your guide, but your judgment matters too.

If you encounter a mismatch:
- STOP and think deeply about why the plan can't be followed
- Present the issue clearly:
  ```
  Issue in Phase [N]:
  Expected: [what the plan says]
  Found: [actual situation]
  Why this matters: [explanation]

  How should I proceed?
  ```
- Any alternative approach you propose must still follow `/skills/refactor/SKILL.md` — a quick patch that skips KISS/DRY/error-handling to "just make it work" is not acceptable; present the simplest approach that still meets the rules, even when deviating from the plan.

## Verification Approach

After implementing a phase:
- Run the success criteria checks (usually `make check test` covers everything)
- Fix any issues before proceeding
- **Run the refactor skill's Final Checklist against the code you just wrote** (not a replacement for `make check test` — an additional pass focused on code quality). Verify each of the five named principles explicitly:
  - [ ] Behavior matches the plan; no speculative extras (**YAGNI**)
  - [ ] No unnecessary abstractions/patterns for a single use case (**KISS** / **YAGNI**)
  - [ ] No duplicated logic introduced (**DRY**)
  - [ ] Clear single responsibilities; no god function/class; DIP only at real boundaries (**SOLID**)
  - [ ] Intention-revealing names; small functions; guard clauses; named constants; no dead code (**Clean Code**)
  - [ ] One pass per collection; parse/cast once and reused; Map/Set over nested lookups (Performance Rules)
  - [ ] JSON parsing and API/network calls wrapped safely; external conversions validated; no empty catch (Error-Handling Rules)
  - If any item fails, fix the code before marking the phase's automated verification complete.
- Update your progress in both the plan and your todos
- Append ` ✅` to the phase heading in the sub-plan using Edit — do not mark a phase done while any automated command fails
- **Pause for human verification**: After completing all automated verification (including the refactor skill checklist above) for a phase, pause and inform the human that the phase is ready for manual testing. Use this format:
  ```
  Phase [N] Complete - Ready for Manual Verification

  Automated verification passed:
  - [List automated checks that passed]

  Please perform the manual verification steps from the phase's `**Verify**` block (`Manual`), plus the master plan section 6 if this is the last phase:
  - [List manual verification items from the plan]

  Let me know when manual testing is complete so I can proceed to Phase [N+1].
  ```

If instructed to execute multiple phases consecutively, skip the pause until the last phase. Otherwise, assume you are just doing one phase.

do not check off items in the manual testing steps until confirmed by the user.


## If You Get Stuck

When something isn't working as expected:
- First, make sure you've read and understood all the relevant code
- Consider if the codebase has evolved since the plan was written
- Present the mismatch clearly and ask for guidance

Use sub-tasks sparingly - mainly for targeted debugging or exploring unfamiliar territory.

## Resuming Work

If phases are already marked ✅:
- Trust that completed work is done
- Pick up from the first phase without a ✅, following the matrix order in the master plan section 4
- Verify previous work only if something seems off — if you do inspect it, hold it to the same refactor skill checklist as new code

Remember: You're implementing a solution, not just checking boxes. Keep the end goal in mind and maintain forward momentum.
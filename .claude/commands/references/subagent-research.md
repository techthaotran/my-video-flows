# Sub-task Spawning Best Practices

Shared by `05-create-plan.md` and `06-iterate_plan.md`. Applies to every research sub-agent spawned during planning.

## When to spawn

1. **Only spawn if truly needed** — a small, well-understood change does not need research.
2. **Spawn multiple tasks in parallel** for efficiency; each task focused on one specific area.
3. **Wait for ALL sub-tasks to complete** before synthesizing.

## How to write the prompt

4. **Provide detailed instructions**, including:
   - Exactly what to search for
   - Which directories to focus on
   - What information to extract
   - Expected output format
5. **Be EXTREMELY specific about directories** — include the full path context in the prompt.
6. **Specify read-only tools** to use.
7. **Request specific `file:line` references** in the response.

## Handling results

8. **Verify sub-task results**:
   - If a sub-task returns unexpected results, spawn follow-up tasks
   - Cross-check findings against the actual codebase
   - Don't accept results that seem incorrect

## Which agent for which job

| Need | Agent |
|---|---|
| Find files related to a task | `codebase-locator` |
| Understand how current code works | `codebase-analyzer` |
| Find a similar existing pattern to model after | `codebase-pattern-finder` |
| Find prior research/plans/decisions | `thoughts-locator` → `thoughts-analyzer` |
| Full ticket details | `linear-ticket-reader` |
| Similar past issues | `linear-searcher` |

Example — spawn concurrently:

```python
tasks = [
    Task("Research database schema", db_research_prompt),
    Task("Find API patterns", api_research_prompt),
    Task("Investigate UI components", ui_research_prompt),
    Task("Check test patterns", test_research_prompt),
]
```

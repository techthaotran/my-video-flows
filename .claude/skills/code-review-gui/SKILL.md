---
name: code-review-gui
description: >-
  Implements and reviews seconder.ai frontend code (React 19, Vite, React Router 7,
  Next.js 15, Chrome Extension MV3, SolidJS content scripts, @sec/gui-seconder,
  fast-context, secFetch, Paraglide i18n, Tailwind, shadcn) following project
  conventions in RULES.md. Use when implementing, editing, or reviewing any code
  under apps/gui/ or packages/gui/, creating React/Next components, extension UI,
  shared UI packages, or when the user asks for frontend code review or PR feedback.
---

# Frontend Skill (seconder.ai)

Scope: **`apps/gui/**`** and **`packages/gui/**`** — **implement** and **review**.

This skill is the **single source of truth** for seconder frontend work. Read
[RULES.md](RULES.md) for coding standards — not legacy Cursor rule files.

Complements `reactjs-code-review` and `solidjs-code-review` for deep framework audits.

## When this skill loads

On every frontend task, read the appropriate companion files:

1. **[RULES.md](RULES.md)** — before writing or editing code
2. **[CHECKLIST.md](CHECKLIST.md)** + **[STANDARDS.md](STANDARDS.md)** — when reviewing or self-checking before PR
3. **[examples.md](examples.md)** — on demand for output format reference

## Implementation workflow

1. **Identify surface** from path — extension / seconder-sf / shared package / content-script
2. **Read [RULES.md](RULES.md)** — apply TypeScript, React/Next, styling, i18n, naming rules
3. **Match existing patterns** — read similar files in the same feature folder before adding code
4. **Implement minimally** — follow `fast-context`, `secFetch`, Sec naming in [STANDARDS.md](STANDARDS.md)
5. **Self-check** — walk routed checklist sections from [CHECKLIST.md](CHECKLIST.md) before finishing

## Review workflow

### 1. Determine scope

Run `git status` first if the tree state is unclear.

- **Uncommitted / working changes** → `git diff` and `git diff --staged`
- **Branch / PR** → `git diff <base>...HEAD`
- **Specific commit** → `git show <sha>`
- **Named files** → review the paths the user provided

**Frontend filter:** only review paths under `apps/gui/` or `packages/gui/`.
If the diff includes non-frontend files, note them as out of scope and skip.

If scope is ambiguous, ask before reviewing.

### 2. Read context

Open changed files and enough surrounding code to understand data flow.

Read skill companions:
- [RULES.md](RULES.md) — coding standards for all frontend work
- [STANDARDS.md](STANDARDS.md) — stack conventions and mental models

Check where state is **created** vs **consumed** — bugs often sit at the read site.
Identify whether each file is **React**, **Next.js RSC/client**, or **SolidJS island**
before applying framework-specific checks.

### 3. Route checklist sections

Apply only the sections routed by changed paths. Full items live in
[CHECKLIST.md](CHECKLIST.md).

| Changed path pattern | Sections |
|---------------------|----------|
| `apps/gui/seconder-webapp-extension/**` (not under `content-script/`) | §A, §B, §D |
| `apps/gui/seconder-webapp-extension/**/content-script/**` | §A, §E |
| `apps/gui/seconder-sf/**` | §A, §C, §D |
| `packages/gui/seconder/**` | §A, §D |

When a diff spans multiple surfaces, apply the union of routed sections per file.

For deep framework-specific review beyond this checklist, load the framework
skill based on **changed file paths**:

| Changed path pattern | Load skill |
|---------------------|------------|
| `apps/gui/**` or `packages/gui/**` excluding `**/content-script/**` | [reactjs-code-review/SKILL.md](../reactjs-code-review/SKILL.md) |
| `**/content-script/**` | [solidjs-code-review/SKILL.md](../solidjs-code-review/SKILL.md) |
| Mixed React + Solid diff | Load **both**; apply each skill only to its files |

Framework skills cover hooks/reactivity, RSC boundaries, fast-context selectors,
SSE lifecycle, and Suspense/`use()` — not cross-cutting i18n/styling in §A.

### 4. Report findings

Use the Output Format below. Lead with a 1–2 sentence summary, then findings by
severity. Omit empty severity buckets.

Note manual verification steps when behavior cannot be verified statically (this
repo has no frontend unit/e2e tests).

## Severity Levels

- **Critical** — merge blockers: broken auth flow, Rules of Hooks violations,
  Solid prop destructuring, XSS (`dangerouslySetInnerHTML` with unsanitized input),
  memory leaks (missing effect/listener cleanup), React hooks in Solid content-script
  files, infinite re-render loops.
- **Warning** — should fix: hardcoded user-facing strings (missing Paraglide `m.key()`),
  API calls bypassing `secFetch`, wrong router context (`BrowserRouter` assumptions in
  extension code), N+1 fetches in list renders, missing SSE stream cleanup on
  unmount/navigation, wrong i18n namespace (`@i18n` in packages).
- **Info** — suggestions: naming, file structure, minor idiomatic preferences,
  extract hook, reduce scope.

## Output Format

```
## Review summary
<1–2 sentences: change size + overall frontend health.>

## Critical
- `path/to/file.tsx:42` — <what is wrong>. <why it matters>. <fix>

## Warning
- `path/to/file.tsx:88` — <what is wrong>. <why it matters>. <fix>

## Info
- `path/to/file.tsx:15` — <suggestion>
```

**Example finding:**

```
## Critical
- `apps/gui/seconder-webapp-extension/src/routes/index.tsx:52` — New `/app/billing`
  route has no `handle: { requireAuth: true }` while sibling settings routes do.
  Unauthenticated users can reach a protected page. Add `requireAuth: true` and wrap
  with `RouteAuthGuard` via existing route table pattern.
```

## Deep-dive delegation

Route by changed paths (see §3 framework table above):

| Need | Action |
|------|--------|
| React hooks, RSC, fast-context, SSE, re-render audit | Read [reactjs-code-review/SKILL.md](../reactjs-code-review/SKILL.md) |
| Solid reactivity deep audit | Read [solidjs-code-review/SKILL.md](../solidjs-code-review/SKILL.md) |


## Change sizing

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Recommend splitting the PR.
```

## When no issues found

State explicitly in the summary ("No stack or convention issues found.") rather than
padding with false positives. Clean code that follows routed checklist sections,
uses `secFetch`, Paraglide keys, and correct framework boundaries is doing the
right things.

## Additional resources

- [RULES.md](RULES.md) — frontend coding standards
- [CHECKLIST.md](CHECKLIST.md) — full §A–§E review checklist
- [STANDARDS.md](STANDARDS.md) — mental models, conventions, anti-patterns
- [examples.md](examples.md) — implementation and review examples


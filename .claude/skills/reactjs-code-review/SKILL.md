---
name: reactjs-code-review
description: >-
  Deep React code review for seconder.ai (React 19, Vite, React Router 7, Next.js 15,
  fast-context, secFetch, SSE, React Compiler). Loaded by code-review-gui when changed
  files are React surfaces under apps/gui/ or packages/gui/ (excluding content-script
  Solid islands). Use for hook correctness, re-render bugs, fast-context subscriptions,
  Suspense/use(), routing/auth guards, effect cleanup, and Next.js RSC boundaries.
  Also triggers on generic React/Next.js review requests outside seconder.
---

# React Code Review (seconder.ai)

Deep **React framework audit** for seconder.ai frontend. Covers hooks, rendering,
state subscriptions, routing, async boundaries, and Next.js client/server split.

**Not in scope here** — handled by [code-review-gui](../code-review-gui/SKILL.md):
Paraglide i18n, Tailwind/shadcn styling, Sec naming, cross-cutting TypeScript,
and SolidJS content-script islands.

## When this skill loads

`code-review-gui` reads this file when the diff includes **React** paths:

| Changed path | Load this skill? |
|--------------|------------------|
| `apps/gui/seconder-webapp-extension/**` (not `content-script/`) | Yes |
| `apps/gui/seconder-sf/**` | Yes |
| `packages/gui/seconder/**` | Yes |
| `**/content-script/**` (SolidJS) | No → [solidjs-code-review](../solidjs-code-review/SKILL.md) |
| Mixed React + Solid diff | Load **both** skills; apply each to its files |

For full frontend review workflow, read companions **first**:
[RULES.md](../code-review-gui/RULES.md), [CHECKLIST.md](../code-review-gui/CHECKLIST.md) §A–§D,
[STANDARDS.md](../code-review-gui/STANDARDS.md).

Stack reference:
- [thoughts/research/2026-06-14-frontend-tech-stack.md](../../thoughts/research/2026-06-14-frontend-tech-stack.md)
- [thoughts/research/2026-06-14-react-code-review-patterns.md](../../thoughts/research/2026-06-14-react-code-review-patterns.md)

---

## Core mental model

Apply on every review:

1. **Components re-render when state or props change** (client). Server Components run
   once per request — no hooks, no browser APIs.
2. **Hooks must run in the same order every render** — never call hooks conditionally.
3. **Effects sync with the outside world** — subscriptions, timers, DOM, fetch side
   effects. Derived values belong in render or `useMemo`, not `useEffect` + `setState`.
4. **Every subscription/timer/listener/SSE stream needs cleanup** in the effect return.
5. **fast-context** uses `useSyncExternalStore` — pass a **selector** to avoid
   whole-store re-renders (`fast-context/index.tsx:109-113`).
6. **React Compiler is enabled** (`base.vite.config.ts:27-31`) — do not add redundant
   `useMemo`/`useCallback`/`memo()` unless there is a measured need.
7. **API calls belong in `store/action.ts` or `api.ts`** via `secFetch` — not inline JSX.
8. **Two-level context:** outer `createContext<IFastContextWrap<T>>` exports `useStore`;
   inner `FastContext` holds ref store (`SecChatMessage/store/index.tsx:65-68`).

---

## Workflow

### 1. Determine scope

- **Uncommitted** → `git diff` and `git diff --staged`
- **Branch / PR** → `git diff <base>...HEAD`
- **Named files** → review provided paths

Run `git status` first if unclear. Scope to `apps/gui/**` and `packages/gui/**`
when invoked from `code-review-gui`.

### 2. Identify surface per file

| Surface | Path signal | Extra checks |
|---------|-------------|--------------|
| Extension / web SPA | `seconder-webapp-extension/` | §3 Router, §4 fast-context, §6 SSE |
| Next.js | `seconder-sf/app/` | §1 Server vs Client |
| Shared package | `packages/gui/seconder/` | §4 fast-context, §5 secFetch actions |

Skip Solid content-script files — use solidjs-code-review instead.

### 3. Read context

- Where is state **created** (provider, `useState`, fast-context init) vs **consumed**?
- Parent components when child receives callbacks or context.
- Distinguish Server Components from `'use client'` boundaries in Next.js.
- Check list rendering and `key` usage inside `.map()`.

### 4. Walk checklist below

Note file + line, what's wrong, why it matters in React's model, concrete fix.

### 5. Report findings

Use Output Format. Lead with 1–2 sentence summary. Omit empty severity buckets.

Note manual verification when behavior cannot be verified statically — this repo has
no frontend unit/e2e tests under `apps/gui/` or `packages/gui/`
(`code-review-gui/SKILL.md:98-99`, research doc).

---

## Severity levels

- **Critical** — broken UI (stale state, infinite loops), memory leaks, Rules of Hooks
  violations, missing SSE/listener cleanup, protected route without auth guard,
  XSS via `dangerouslySetInnerHTML`.
- **Warning** — performance regressions (whole-store `useStore()`, missing abort on
  fetch, unstable list keys), fetch in JSX instead of actions, `setTimeout` without
  cleanup, React hooks in wrong router context assumptions.
- **Info** — idiomatic preferences, extract hook, naming, minor DX.

---

## Output format

```
## Review summary
<1–2 sentences: change size + overall React health.>

## Critical
- `path/to/file.tsx:42` — <what is wrong>. <why it matters in React>. <fix>

## Warning
- `path/to/file.tsx:88` — <what is wrong>. <why it matters>. <fix>

## Info
- `path/to/file.tsx:15` — <suggestion>
```

**Example (seconder-specific):**

```
## Critical
- `apps/gui/seconder-webapp-extension/src/routes/index.tsx:52` — New `/app/billing`
  route has no `handle: { requireAuth: true }` while sibling settings routes do.
  Unauthenticated users can reach a protected page. Add `requireAuth: true` and wrap
  with `RouteAuthGuard` via existing route table pattern.
```

---

## React review checklist

Walk applicable sections only. Items marked **(sec)** are seconder-specific patterns
observed in the codebase.

### 1. Server vs Client (Next.js — `seconder-sf`)

Source: `app/[locale]/help/[[...mdxPath]]/page.tsx`, `RULES.md` §Next.js

- [ ] Server Components by default — `'use client'` only for interactivity
- [ ] No hooks in Server Components
- [ ] Await `params` / `searchParams` when typed as `Promise` (Next.js 15)
- [ ] Data fetching in Server Components uses async/await — not `useEffect` + fetch
      in a client wrapper when avoidable
- [ ] Control flow via `notFound()` / `redirect()` from `next/navigation`
- [ ] **Hybrid routing**: App Router for help docs (`app/[locale]/help/`);
      Pages Router still used for auth (`pages/login/index.tsx`) — apply RSC rules per file

### 2. Hooks correctness

Source: `RULES.md` §React, `InitGetUserInfo.tsx`, feature hooks

- [ ] Hooks called unconditionally at top level of component or custom hook
- [ ] Dependency arrays complete — no stale closures from missing deps
- [ ] No `setState` inside `useEffect` to derive values from other state/props —
      use render-time computation or `useMemo`
- [ ] `useEffect` is for side effects, not transforming data for display
- [ ] Custom hooks encapsulate reusable stateful logic; same Rules of Hooks apply
- [ ] Functional updates (`setX(prev => ...)`) when next state depends on previous
      inside async callbacks

### 3. React Router 7 + auth **(sec)**

Source: `RouterProvider.tsx:5-9`, `routes/index.tsx`, `RouteAuthGuard.tsx`

- [ ] **Router context**: extension → `MemoryRouter`, web SPA → `BrowserRouter`
      — no `BrowserRouter` assumptions in extension-only code
- [ ] Protected routes use `handle: { requireAuth: true }` (`routes/index.tsx:43,78,87,96`)
- [ ] Top-level routes wrapped in `RouteAuthGuard` (`App.tsx:33-37`)
- [ ] Extension detection via `isChromeExtension()` — no URL bar assumptions
- [ ] Lazy routes wrapped in `<Suspense>` (`routes/index.tsx:31-33`)
- [ ] `useSearchParams` / `useNavigate` used in correct router context
- [ ] Logged-in check reads auth store via `useUserLoggedIn()` (`hooks/useUserLoggedIn.ts:4-8`)

### 4. fast-context & state **(sec)**

Source: `fast-context/index.tsx`, feature `store/` folders

- [ ] Feature stores follow layout: `store/context.ts` + `store/action.ts` +
      `store/index.tsx` (see `chat-history/store/`)
- [ ] Components use **selectors**: `useStore(state => state.field)` — not
      `useStore()` without selector in UI components
- [ ] Mutations via `setSelector` with immer `produce()` — no direct store mutation
- [ ] Async actions via `useDispatchFastContext` → `fastDispatch(ctx => action(ctx))`
      (`useFastDispatch.ts:20-35`)
- [ ] Auth store: `AuthProvider` + `InitGetUserInfo` hydration pattern preserved
      (`InitGetUserInfo.tsx:67-125`)
- [ ] State colocated — not lifted higher than necessary; no redundant derived state

### 5. Data fetching **(sec)**

Source: `sec-fetch/base/index.ts`, `store/action.ts` files

- [ ] HTTP via **`secFetch`** in `store/action.ts` or page `api.ts` — not raw
      `fetch`/axios in JSX
- [ ] Token refresh interceptor not bypassed (`sec-fetch/base/http.ts:26-65`)
- [ ] No N+1 fetches inside `.map()` render callbacks
- [ ] Fetch in `useEffect` uses `AbortController` cleanup when request can complete
      after unmount
- [ ] **React 19 `use()` pages**: module promise cache + inner `use(resource)` inside
      `<Suspense>` + `<ErrorBoundary>` with retry (`prompt-templates/index.tsx:12-64`);
      same pattern on `pages/app/chat/index.tsx`, `pages/app/shares/index.tsx`,
      `pages/app/chat/history/index.tsx`
- [ ] Init functions throw on secFetch failure for ErrorBoundary
      (`chat/store/action.ts:25-27`)
- [ ] Init functions that throw on failure are paired with ErrorBoundary retry reset
- [ ] Module-level resource cache nulled on unmount (`prompt-templates/index.tsx:52-55`)

### 6. Effects, SSE & lifecycle **(sec)**

Source: `SecChatMessage/hooks/SSE/index.tsx`, `useAutoScroll/index.ts`

- [ ] Every `addEventListener`, `setInterval`, `setTimeout`, WebSocket,
      ResizeObserver has cleanup in effect return
- [ ] **SSE streams** (`sse.js`): all connections closed on unmount
      (`SSE/index.tsx:111-115`); per-stream `cleanupStream` on error
      (`useEventHandlers.ts:33-44`)
- [ ] SSE 401 retry closes old stream before reopen (`SSE/index.tsx:60-61`)
- [ ] SSE hook mounted via `<InitSSE />` in prompt editor provider
      (`SecChatPromptEditor/store/index.tsx:80-82`)
- [ ] No cascading effects without clear justification
- [ ] `useLayoutEffect` only when DOM measurement before paint is required
      (auth init uses it at `InitGetUserInfo.tsx:67`)

### 7. Suspense, lazy & error boundaries **(sec)**

Source: `routes/index.tsx`, page entry files, `ReactGlobalError.tsx`

- [ ] Route-level code splitting: `React.lazy()` + `<Suspense fallback>`
- [ ] Page data loading: `use()` paired with `<Suspense>` — not bare `use()` outside
- [ ] `<ErrorBoundary>` around risky subtrees with retry fallback (`Error500`)
- [ ] App-level boundary at root (`App.tsx:21`)
- [ ] Heavy editor/auth steps lazy-loaded with Suspense
      (`SecAuthModal/components/FormRenderer.tsx`, `variant-registry.ts`)

### 8. Lists, keys & virtualization

Source: `SecVirtualListRender/`, `ChatHistoryList.tsx`

- [ ] Stable `key` — unique IDs, not array index on reorderable/filterable lists
- [ ] Long lists use `SecVirtualListRender` / `@tanstack/react-virtual` where the
      project already does (`ChatHistoryList.tsx`, `ShareList.tsx`)
- [ ] No fetch per list item in render

### 9. Performance

Source: `base.vite.config.ts:27-31`, `RULES.md:108-109`

- [ ] **React Compiler enabled** — avoid redundant manual `useMemo`/`useCallback`/`memo()`
- [ ] Manual memoization only where profiling or referential stability clearly needed
- [ ] Context/fast-context values: use selectors to limit re-renders
- [ ] Heavy components lazy-loaded when appropriate
- [ ] No inline object/array/function props causing unnecessary child re-renders
      when children are memoized

### 10. Forms & user input

Source: `UsernameEditForm.tsx`, `SecLogin/index.tsx`

- [ ] `react-hook-form` with **inline RHF rules** — no `zodResolver` unless project adds it
- [ ] Controlled inputs have stable `value` + `onChange` wiring
- [ ] `FormProvider` + `useFormContext` for multi-section forms
- [ ] Submit handlers call `secFetch` or `fastDispatch` — not inline fetch in JSX
- [ ] Validation errors surfaced in UI

### 11. TypeScript

Source: `RULES.md` §TypeScript

- [ ] Props typed with `interface`
- [ ] Event handlers typed (`React.MouseEvent<HTMLButtonElement>`, etc.)
- [ ] `children` typed as `ReactNode` when accepted
- [ ] DTOs from `@sec/share/dto`; constants from `@sec/share/constants`
- [ ] No `any` without justification

### 12. Correctness & code quality

- [ ] Loading, empty, and error states handled
- [ ] Names descriptive (`isOpen`, not `flag`); handlers prefixed `handle`
- [ ] Dead code, commented-out blocks, unused imports removed
- [ ] **No React imports or hooks in Solid content-script files**
- [ ] No debug `console.log` left in production paths (observed in `RouteAuthGuard.tsx:13`)
- [ ] `setTimeout` in effects has matching cleanup (observed gap in `RequireLogin.tsx:18-20`)

---

## Anti-patterns — quick recognition

| Anti-pattern (in diff) | Severity | Fix |
|---|---|---|
| `if (x) { const [s, setS] = useState() }` | Critical | Move hook above condition |
| `useEffect(() => setDerived(compute(a,b)), [a,b])` | Warning | Derive in render or `useMemo` |
| `useEffect(() => { fetch(); }, [])` — no abort | Warning | `AbortController` + cleanup |
| `useStore()` without selector in UI component **(sec)** | Warning | e.g. `SecChatPromptEditor/components/editor/index.tsx:24` — use `TabItem.tsx:16-19` |
| `fetch()` / axios in JSX instead of `secFetch` in action **(sec)** | Warning | Move to `store/action.ts` |
| Protected route missing `requireAuth` handle **(sec)** | Critical | Add `handle: { requireAuth: true }` |
| `BrowserRouter` assumptions in extension code **(sec)** | Warning | Use `MemoryRouter`; check `isChromeExtension()` |
| SSE stream opened without unmount close **(sec)** | Critical | `sseRef.current.forEach(s => s.close())` in cleanup |
| `use()` outside `<Suspense>` **(sec)** | Critical | Wrap consuming component in Suspense |
| `items.map((item, i) => <Row key={i} />)` on reorderable list | Warning | Stable `key={item.id}` |
| `dangerouslySetInnerHTML={{ __html: userInput }}` | Critical | Sanitize or avoid |
| Missing cleanup on `window.addEventListener` | Critical | Return cleanup from `useEffect` |
| `'use client'` on page with only static content (Next.js) | Info | Make it a Server Component |
| Redundant `memo()`/`useCallback` with React Compiler **(sec)** | Info | Remove unless measured need |
| React hooks in `content-script/` file | Critical | Solid primitives only |

---

## Reference examples (good patterns)

| Pattern | Location |
|---------|----------|
| Dual FastContext provider | `SecChatMessage/store/index.tsx:65-68` |
| Feature store layout | `chat-history/store/{context,action,index}.tsx` |
| Selector subscription | `SecChatTab/components/TabItem.tsx:16-19` |
| useStore anti-pattern (review cite) | `SecChatPromptEditor/components/editor/index.tsx:24` |
| fastDispatch + secFetch action | `chat-history/store/action.ts:55-119` |
| use() + Suspense + ErrorBoundary page | `pages/app/prompt-templates/index.tsx:12-64` |
| use() pages (chat, shares, history) | `pages/app/chat/index.tsx`, `pages/app/shares/index.tsx`, `pages/app/chat/history/index.tsx` |
| Init throw → ErrorBoundary | `chat/store/action.ts:25-27` |
| SSE cleanup on unmount | `SecChatMessage/hooks/SSE/index.tsx:111-115` |
| InitSSE mount | `SecChatPromptEditor/store/index.tsx:80-82` |
| Effect cleanup (listeners) | `chat/hooks/useAutoScroll/index.ts:23-82` |
| Protected route + guard | `routes/index.tsx:43` + `RouteAuthGuard.tsx:5-19` |
| useUserLoggedIn | `hooks/useUserLoggedIn.ts:4-8` |
| Dual router | `RouterProvider.tsx:5-9` |
| RHF inline rules | `settings/profile/UsernameEditForm.tsx:49-88` |
| Virtual list | `ChatHistoryList.tsx` via `SecVirtualListRender` |
| Auth hydration | `InitGetUserInfo.tsx:67-125` |

---

## Change sizing

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if single logical change.
~1000 lines changed  → Too large. Recommend splitting the PR.
```

## When no obvious React pitfalls

State explicitly in the summary ("No hook or re-render issues. A few stylistic notes
below.") rather than padding with false positives. Clean React code that colocates
state, uses fast-context selectors, cleans up effects/SSE, and keeps Server/Client
boundaries clear is doing the right things.

## Reference — when to use each primitive

- `useState` — local component state
- `useReducer` — complex state transitions with explicit actions
- `useMemo` — expensive derived value (sparingly with React Compiler)
- `useCallback` — stable function reference for memoized children or deps (sparingly)
- `useEffect` — sync with external systems after render
- `useLayoutEffect` — DOM measurement/mutation before paint (rare; auth init)
- `useRef` — mutable value without re-render; DOM refs; SSE instance arrays
- `useContext` — read shared React context (auth, theme)
- `use()` — unwrap promise/resource inside Suspense (React 19 page init)
- `useSyncExternalStore` — fast-context subscription (via `useStore`)
- `Suspense` — async component and data boundaries
- `ErrorBoundary` — catch render errors in subtree (`ReactGlobalError.tsx`)

Flag any case where the diff uses a primitive outside its canonical role.

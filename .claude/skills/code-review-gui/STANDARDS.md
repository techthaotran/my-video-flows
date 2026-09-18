# Frontend Review Standards

Conventions and anti-patterns for seconder.ai frontend code review.
Use with [CHECKLIST.md](CHECKLIST.md) and [SKILL.md](SKILL.md).

For coding standards when **implementing**, see [RULES.md](RULES.md).

---

## Dual mental models

Identify which model applies **before** reviewing a file ([RULES.md](RULES.md) §Do not mix frameworks).

### React (app shell, Next.js client components)

1. Components re-render when state or props change. Server Components run once per request.
2. Hooks must run in the same order every render — never conditionally.
3. Effects sync with the outside world; derived values belong in render or `useMemo`.
4. Every subscription/timer/listener needs cleanup in the effect return.
5. `'use client'` is a boundary cost — prefer Server Components in Next.js when possible.

### SolidJS (content-script islands only)

1. Components run **once**. The function body is not reactive unless inside JSX/memo/effect.
2. Signals must be read inside reactive scopes — reading at top level captures stale values.
3. `props` is a reactive proxy — destructuring breaks reactivity.
4. Effects are for side effects, not derived state — use `createMemo`.
5. Every subscription/timer/listener needs `onCleanup`.

### Rule

Do not mix React and Solid in the same file. Content scripts under
`**/content-script/**` are Solid-only islands.

---

## Sec component conventions

From project structure (`packages/gui/seconder/`, `apps/gui/*/src/components/`):

- Product components prefixed **`Sec`** (e.g. `SecChatMessage`, `SecToastProvider`)
- Feature folders: `components/pages/<feature>/` with `store/`, `hooks/`, subcomponents
- Entry `index.tsx` re-exports; shadcn primitives stay in `components/shadcn/`
- API calls in `store/action.ts` or page-scoped `api.ts` — not inline in JSX
- Handlers: `handleSubmit`, `handleClose`; booleans: `isLoading`, `hasError`

---

## i18n conventions

Source: `docs/tech/front-end/i18n.md`

| Context | Import | Locale files |
|---------|--------|--------------|
| Apps (`apps/gui/*`) | `import { m } from '@i18n'` | `apps/*/i18n/` |
| Packages (`packages/gui/*`) | `import { m } from '@sec/i18n'` | `packages/gui/seconder/i18n/` |

- Flat keys only: `{category}_{message_key}` — no nested keys
- Category maps to URL path or folder path (e.g. `app_settings_username_required`)
- Do not mix `@i18n` and `@sec/i18n` in the wrong layer

---

## State & data fetching conventions

| Layer | Pattern | Location |
|-------|---------|----------|
| App-wide shared state | `createFastContext` + Provider | `packages/gui/seconder/store/` |
| Feature state | Colocated `store/context.ts` + `action.ts` | App `components/pages/<feature>/store/` |
| HTTP | `secFetch` with keyed requests | `packages/gui/seconder/sec-fetch/` |
| Streaming chat | `sse.js` with cleanup | Extension chat hooks |

- Updates via immer `produce()` inside `fast-context` `set()` — no direct mutation
- Selectors avoid whole-store re-renders
- Legacy `packages/gui/seconder/common/http/index.ts` exists — flag **new** code using it instead of `secFetch`

---

## Extension architecture

| Surface | Framework | Build config |
|---------|-----------|--------------|
| Side panel, options, web SPA | React 19 | `web.vite.config.ts` / shared `base.vite.config.ts` |
| Content-script UI | SolidJS in Shadow DOM | `extension.vite.config.ts` + `vite-plugin-solid` |

- Extension routing: `MemoryRouter` (no URL bar)
- Web SPA routing: `BrowserRouter`
- Auth sync: `chrome.storage.local` (extension) vs localStorage (web)
- Injected UI uses custom elements + Shadow DOM to isolate CSS from host pages

---

## Anti-patterns — quick recognition

| Anti-pattern | Applies to | Severity | Fix |
|---|---|---|---|
| Hardcoded UI string in localized file | All | Warning | `m.category_key()` via correct namespace |
| `fetch()` / axios bypassing `secFetch` | React / Shared | Warning | Use `secFetch` in `store/action.ts` or `api.ts` |
| React hooks in content-script file | Solid islands | Critical | Solid primitives only |
| Wrong i18n import (`@i18n` in package code) | Shared | Warning | Use `@sec/i18n` |
| `useContext` without selector on fast-context store | Shared | Warning | Use `useStore(state => state.field)` pattern |
| `BrowserRouter` / `useNavigate` assumptions in extension | Extension | Warning | Use `MemoryRouter`; check `isChromeExtension()` |
| Missing SSE cleanup on navigation/unmount | Extension chat | Warning | Close stream in effect cleanup |
| Prop destructuring in Solid (`function C({ x })`) | Solid islands | Critical | `props.x` or `splitProps` |
| `if (x) { const [s, setS] = useState() }` | React | Critical | Move hook above condition |
| `useEffect(() => setDerived(compute(a,b)), [a,b])` | React | Warning | Derive in render or `useMemo` |
| `useEffect(() => fetch(), [])` — no abort | React | Warning | `AbortController` + cleanup |
| `items.map((item, i) => <Row key={i} />)` on reorderable list | React | Warning | Stable `key={item.id}` |
| `dangerouslySetInnerHTML={{ __html: userInput }}` | All | Critical | Sanitize or avoid |
| Missing cleanup on `window.addEventListener` | React | Critical | Return cleanup from `useEffect` |
| `{items().map(i => <Item />)}` in Solid | Solid islands | Warning | `<For each={items()}>` |
| `createEffect(() => setOther(a() * 2))` | Solid islands | Critical | `createMemo(() => a() * 2)` |
| `setInterval(...)` with no `onCleanup` | Solid islands | Critical | `onCleanup(() => clearInterval(t))` |
| New code using `common/http/index.ts` | Shared | Warning | Migrate to `secFetch` |
| Protected route without `requireAuth` handle | Extension | Critical | Add `handle: { requireAuth: true }` |

---

## Change sizing

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Recommend splitting the PR.
```

---

## Testing note

No automated frontend unit or e2e tests exist under `apps/gui/` or `packages/gui/`
(research doc L204-210).

- Note **manual verification steps** in findings when behavior is hard to verify statically
- Do not flag "missing unit tests" as Critical unless the change introduces untestable complexity
- Suggest concrete manual steps (e.g. "verify auth guard redirects when logged out in extension side panel")

---

## When no issues found

State explicitly in the summary rather than padding with false positives:

> "No stack or convention issues found. A few stylistic notes below."

Clean code that uses routed checklist sections, `secFetch`, Paraglide keys, correct
router context, and framework boundaries is doing the right things.

# Frontend Coding Standards (seconder.ai)

**Single source of truth** for implementing code under `apps/gui/**` and
`packages/gui/**`. Former Cursor frontend rule files are removed — use this file
and [STANDARDS.md](STANDARDS.md) for stack-specific patterns.

---

## General

- Readability over cleverness; minimize scope — change only what the task requires.
- Functional, declarative code; follow DRY; prefer early returns.
- **Named exports** for components and utilities.
- Match surrounding naming, import style, and abstraction level in the same folder.
- Structure files logically: exports, subcomponents, helpers, types.
- Read similar files in the same feature folder before adding new code.

---

## Naming

- Booleans: prefix `is`, `has`, `can`, or `should` (e.g. `isLoading`, `hasError`).
- Event handlers: prefix `handle` (e.g. `handleSubmit`, `handleClose`).
- Product components: prefix **`Sec`** (e.g. `SecChatMessage`, `SecToastProvider`).
- Descriptive names over abbreviations; constants in `UPPER_SNAKE_CASE` when module-level.

---

## Functions & errors

- Single responsibility; keep functions under ~50 lines when practical.
- Early returns for guard clauses and error paths.
- **Never swallow errors silently** — log with context or rethrow.
- Async functions: handle rejection; surface user-visible errors in UI where appropriate.

---

## TypeScript

- Use TypeScript for all new code.
- Prefer **`interface`** over `type` for object shapes.
- **No enums** — use `const` maps with `as const`.
- Explicit types on public function parameters and return values.
- Fixed values as named constants (e.g. `const MAX_ITEMS = 3`).
- Use `satisfies` for type validation where it improves inference.
- Avoid `any` without a documented reason.
- Props: `interface`; event handlers: `React.MouseEvent<HTMLButtonElement>`, etc.
- DTOs/types from `@sec/share/dto`; constants from `@sec/share/constants`.

---

## Styling

- **Tailwind** utility classes; theme tokens from `theme/globals.css` (Tailwind v4).
- Use **`cn()`** from `lib/utils.ts` for conditional class merging.
- **shadcn/Radix** primitives in `components/shadcn/` — extend via CVA variants, do not fork.
- No inline `style` except truly dynamic values (e.g. computed pixel offsets).
- No ad-hoc button/input reimplementations when a shadcn primitive exists.

---

## Accessibility

- Semantic HTML elements (`button`, `nav`, `main`, etc.).
- **`aria-label`** on icon-only controls.
- Keyboard navigation for interactive elements.
- Stable selectors for tests: `data-testid` or `aria-label` — not fragile CSS paths.
- External links with `target="_blank"`: `rel="noopener noreferrer"`.

---

## Data fetching & state

- Colocate state with the feature that owns it.
- App-wide shared state: **`createFastContext`** in `packages/gui/seconder/store/`.
- Feature state: colocated `store/context.ts` + `store/action.ts` + `store/type.ts`.
- HTTP: always **`secFetch`** — not raw `fetch`, axios, or legacy `common/http/index.ts` in new code.
- API logic in `store/action.ts` or page `api.ts`, not in JSX.
- Immer updates via `produce()` in `set()` — no direct store mutation.
- Selectors for selective subscriptions — avoid whole-store re-renders.
- Handle **loading, empty, and error** states in UI.
- No fetch inside list item render paths (N+1 pattern).
- SSE streams (`sse.js`): cleanup on unmount/navigation.
- Toast: `toast.success/error()` from `SecToastProvider/toastActions.ts`.

See [STANDARDS.md](STANDARDS.md) for fast-context, secFetch, and extension auth details.

---

## i18n

- **Paraglide** compiler-time i18n — no hardcoded user-facing strings in localized code.
- Apps (`apps/gui/*`): `import { m } from '@i18n'`
- Packages (`packages/gui/*`): `import { m } from '@sec/i18n'`
- Flat keys only: `{category}_{message_key}` — no nested keys.
- Category maps to URL path or source folder (see `docs/tech/front-end/i18n.md`).

---

## React

- Functional components only; follow **Rules of Hooks** — unconditional top-level calls.
- Effects sync with the outside world; derived values belong in render or `useMemo`, not
  `useEffect` + `setState`.
- Every listener, timer, subscription, and abort controller needs effect cleanup.
- Stable `key` on reorderable lists; use `@tanstack/react-virtual` for long lists where the project already does.
- `react-hook-form` with inline RHF rules — no `zodResolver` unless the project adds it.
- React 19 `use()` only with Suspense boundaries.
- React Compiler is enabled — avoid redundant manual memoization.
- **Extension routing**: `MemoryRouter`; **web SPA**: `BrowserRouter` (`RouterProvider.tsx`).
- Protected routes: `handle: { requireAuth: true }` + `RouteAuthGuard`.
- Extension detection via `isChromeExtension()` — no URL bar assumptions.
- Auth sync: extension → `chrome.storage.local`; web → localStorage.

### Do not mix frameworks

- **SolidJS only** in `**/content-script/**` islands.
- **No React imports or hooks** in Solid content-script files.
- Identify which framework applies before editing a file.

---

## Next.js (`seconder-sf`)

- **Server Components by default**; `'use client'` only for interactivity (state, effects, handlers, browser APIs).
- No hooks in Server Components.
- Await `params` / `searchParams` when typed as Promises (Next.js 15).
- `@sec/gui-seconder` via `transpilePackages`; Paraglide webpack plugin on server build.
- Control flow: `notFound()` / `redirect()` from `next/navigation`.
- Custom Express server (`server.ts`) — do not break port/host assumptions.

---

## Performance & security

- Avoid unnecessary re-renders — colocate state, use selectors, stable references where costly.
- Lazy-load heavy components (`React.lazy`, Next.js `dynamic`) when appropriate.
- Bundle size: avoid importing large libraries for one utility.
- **XSS**: no unsanitized `dangerouslySetInnerHTML`.
- **No secrets, API keys, or credentials** in client code or committed env files.
- Memory leaks: missing effect/listener cleanup is a merge blocker.

---

## Comments

- Code should be self-explanatory.
- Comments only for non-obvious business logic or deep technical constraints.
- Remove dead code, unused imports, and commented-out blocks before finishing.

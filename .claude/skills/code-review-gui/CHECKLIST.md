# Frontend Review Checklist

Walk **applicable sections only** — skip sections not routed by changed paths
(see routing table in [SKILL.md](SKILL.md)).

This checklist validates compliance with **[RULES.md](RULES.md)** and stack-specific
patterns in [STANDARDS.md](STANDARDS.md).

For condensed React or Solid hook/reactivity rules, delegate to the framework skills
after completing the routed sections here.

---

## §A Cross-cutting (all frontend changes)

Applies to every file under `apps/gui/**` and `packages/gui/**`.

Source: [RULES.md](RULES.md) §General, §TypeScript, §Styling, §Accessibility, §i18n

- [ ] TypeScript: `interface` over `type` for object shapes (`RULES.md` §TypeScript)
- [ ] No enums; use `const` maps with `as const` (`RULES.md` §TypeScript)
- [ ] Explicit types on public function params/returns (`RULES.md` §TypeScript)
- [ ] Fixed values as constants (`RULES.md` §TypeScript)
- [ ] Named exports for components/utilities (`RULES.md` §General)
- [ ] Handlers prefixed `handle`; booleans prefixed `is`/`has`/`can` (`RULES.md` §Naming)
- [ ] Functions under ~50 lines, SRP, early returns (`RULES.md` §Functions & errors)
- [ ] No silent error swallowing (`RULES.md` §Functions & errors)
- [ ] Tailwind utility classes; use `cn()` for conditional classes (`packages/gui/seconder/lib/utils.ts:1-6`)
- [ ] shadcn/Radix primitives for UI — no ad-hoc button/input reimplementations
- [ ] No inline styles except dynamic values (`RULES.md` §Styling)
- [ ] Semantic HTML; `aria-label` on icon-only controls (`RULES.md` §Accessibility)
- [ ] Stable selectors (`data-testid`, `aria-label`) over fragile CSS paths (`RULES.md` §Accessibility)
- [ ] **Paraglide i18n**: no hardcoded user-facing strings in localized code (`RULES.md` §i18n)
- [ ] Correct namespace: apps → `@i18n`, packages → `@sec/i18n` (`docs/tech/front-end/i18n.md:15-18`)
- [ ] Flat message keys: `{category}_{message_key}` (`docs/tech/front-end/i18n.md:19-29`)
- [ ] Loading, empty, and error states handled in UI (`RULES.md` §Data fetching & state)
- [ ] No fetch inside list item render paths — N+1 pattern (`RULES.md` §Data fetching & state)
- [ ] XSS: no unsanitized `dangerouslySetInnerHTML` (`RULES.md` §Performance & security)
- [ ] No secrets/credentials in client code (`RULES.md` §Performance & security)
- [ ] Dead code, unused imports removed
- [ ] Comments only for non-obvious business logic (`RULES.md` §Comments)

---

## §B React app shell (`seconder-webapp-extension`, non content-script)

Source: [RULES.md](RULES.md) §React, research doc. Deep hook/fast-context/SSE audit → [reactjs-code-review/SKILL.md](../reactjs-code-review/SKILL.md) (auto-loaded when diff is React paths)

- [ ] Hooks called unconditionally at top level
- [ ] Complete dependency arrays; no stale closures in effects
- [ ] Effect cleanup for listeners, timers, subscriptions, abort controllers
- [ ] Stable `key` on reorderable lists — prefer IDs over index
- [ ] Long lists use `@tanstack/react-virtual` where the project already does
- [ ] `react-hook-form` with inline RHF rules — no zodResolver unless project adds it
- [ ] React 19 `use()` paired with Suspense boundaries (`prompt-templates/index.tsx:8-27`)
- [ ] React Compiler enabled — avoid redundant manual memoization (`base.vite.config.ts:27-31`)
- [ ] **React Router 7**: protected routes use `handle: { requireAuth: true }` (`routes/index.tsx:19-43`)
- [ ] **Router context**: extension → `MemoryRouter`, web → `BrowserRouter` (`RouterProvider.tsx:5-9`)
- [ ] **RouteAuthGuard** applied for routes with `requireAuth` (`RouteAuthGuard.tsx:5-19`)
- [ ] **Extension detection** via `isChromeExtension()` — no URL bar assumptions (`common/extensions.ts:5-10`)
- [ ] Side panel / options page logic separated from content scripts
- [ ] **Auth sync**: extension → `chrome.storage.local`; web → localStorage (`InitGetUserInfo.tsx:18-24`)
- [ ] Web↔extension messaging respects `externally_connectable` (`manifest.config.ts:58-60`)
- [ ] No React imports or hooks in content-script Solid files (`RULES.md` §Do not mix frameworks)

---

## §C Next.js surface (`seconder-sf`)

Source: [RULES.md](RULES.md) §Next.js, research doc L89-103

- [ ] Server Components by default; `'use client'` only for interactivity
- [ ] No hooks in Server Components
- [ ] Await `params` / `searchParams` when typed as Promises (Next.js 15)
- [ ] `@sec/gui-seconder` consumed via `transpilePackages` (`next.config.ts:39`)
- [ ] Paraglide webpack plugin on server build (`next.config.ts:47-58`)
- [ ] Custom Express server (`server.ts`) — no breaking port/host assumptions
- [ ] Nextra help docs under `app/[locale]/help/` follow existing MDX patterns
- [ ] `notFound()` / `redirect()` from `next/navigation` for control flow
- [ ] **Hybrid routing**: App Router (`app/[locale]/help/`) vs Pages Router auth
      (`pages/login/index.tsx`) — apply RSC rules per file, not globally

---

## §D Shared package patterns (`packages/gui/seconder` + shared imports)

Also apply §D when app code imports `@sec/gui-seconder` store/fetch patterns.

- [ ] **Sec naming**: product components prefixed `Sec`
- [ ] **Feature layout**: `store/context.ts` + `store/action.ts` + `store/type.ts` colocated
- [ ] **fast-context** for shared domains — not ad-hoc global `useState` (`fast-context/index.tsx:33-52`)
- [ ] Selectors for selective subscriptions — avoid whole-store re-renders
- [ ] Immer updates via `produce()` in `set()` — no direct store mutation
- [ ] Async actions via `useDispatchFastContext` (`useFastDispatch.ts:20-34`)
- [ ] **secFetch** for API calls — not raw `fetch`/axios in components (`sec-fetch/base/index.ts:27-30`)
- [ ] API logic in `store/action.ts` or page `api.ts`, not in JSX
- [ ] Token refresh interceptor not bypassed (`sec-fetch/base/http.ts:22-65`)
- [ ] **SSE**: `sse.js` streams cleaned up on unmount/navigation (`SecChatMessage/hooks/SSE/index.tsx:41-47`)
- [ ] **Toast**: `toast.*()` from `SecToastProvider/toastActions.ts` — not direct `react-hot-toast`
- [ ] **Errors**: `ErrorBoundary` for risky subtrees; `SecComponentError` for recoverable failures
- [ ] shadcn in `components/shadcn/` — extend via CVA variants, do not fork
- [ ] Theme tokens from `theme/globals.css` — Tailwind v4 `@import` / `@source`
- [ ] DTOs from `@sec/share/dto`; constants from `@sec/share/constants`
- [ ] Flag new code using legacy `common/http/index.ts` instead of `secFetch`

---

## §E SolidJS content-script islands (trimmed)

Apply **only** when changed files are under `**/content-script/**`.

For deeper Solid review, read [solidjs-code-review/SKILL.md](../solidjs-code-review/SKILL.md) (auto-loaded when diff includes content-script paths).
Skip SolidStart / routing / `createResource` checks — not used in islands.

- [ ] **No prop destructuring** — use `props.x` or `splitProps`
- [ ] Signals read inside reactive scopes (JSX, memo, effect)
- [ ] **No `setSignal` inside `createEffect` for derived values** — use `createMemo`
- [ ] **`onCleanup`** for every timer, listener, subscription
- [ ] **`<For>` / `<Show>`** for lists/conditionals — not `.map()` / nested ternaries
- [ ] **Shadow DOM**: custom element disposes render on disconnect (`sec-float-button/index.tsx:7-14`)
- [ ] **No React imports** in Solid content-script files
- [ ] Background communication via `chrome.runtime.sendMessage` — not DOM hacks

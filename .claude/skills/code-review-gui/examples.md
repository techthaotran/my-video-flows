# Frontend Review Examples

Annotated sample reviews using the output format from [SKILL.md](SKILL.md).
These are hypothetical diffs for reference — adapt paths and lines to real changes.

---

## Example 1: Extension route missing auth guard

**Context:** Diff adds a new `/app/billing` route in the webapp-extension route table
without `requireAuth`, while sibling settings routes are protected.

**Sections checked:** §A, §B

```
## Review summary
Small route-table change (~15 lines). One merge-blocking auth gap and one i18n issue.

## Critical
- `apps/gui/seconder-webapp-extension/src/routes/index.tsx:58` — New `/app/billing`
  route element has no `handle: { requireAuth: true }` while `/app/settings` and
  siblings do (`routes/index.tsx:19-43`). Unauthenticated users can reach billing UI.
  Fix: add `handle: { requireAuth: true }` to match protected route pattern; ensure
  `RouteAuthGuard` in `App.tsx` wraps the outlet.

## Warning
- `apps/gui/seconder-webapp-extension/src/pages/app/billing/index.tsx:12` — Page title
  `"Billing"` is hardcoded. Surrounding settings pages use `@i18n` keys
  (`app_settings_*`). Fix: add key to `i18n/app/billing/en.json` and use
  `m.app_billing_title()`.
```

---

## Example 2: API call in component bypassing secFetch

**Context:** Diff adds `axios.get('/api/ai/v1/user/profile')` directly inside a
settings profile component instead of using the existing `api.ts` / `store/action.ts`
pattern.

**Sections checked:** §A, §D

```
## Review summary
Profile edit feature (~80 lines). API layer bypasses project conventions; otherwise
structure looks reasonable.

## Warning
- `apps/gui/seconder-webapp-extension/src/components/pages/settings/profile/ProfileCard.tsx:34` —
  Direct `axios.get` in component bypasses `secFetch` and the token-refresh interceptor
  (`sec-fetch/base/http.ts:22-65`). 401 responses won't trigger refresh/login modal.
  Fix: move call to `profile/api.ts` using `secFetch` like `changePassword()` in the
  same folder.

## Info
- `apps/gui/seconder-webapp-extension/src/components/pages/settings/profile/ProfileCard.tsx:1-90` —
  Consider colocating fetch logic in `store/action.ts` alongside other settings actions
  to match prompt-templates pattern (`store/context.ts` + `store/action.ts`).
```

---

## Example 3: Solid content-script prop destructuring

**Context:** Diff adds a new float-button subcomponent with destructured props in a
Solid file under `content-script/`.

**Sections checked:** §A, §E

```
## Review summary
Content-script widget (~45 lines). One critical Solid reactivity bug.

## Critical
- `apps/gui/seconder-webapp-extension/src/extension/core/content-script/sec-float-button/Tooltip.tsx:4` —
  Props destructured (`function Tooltip({ label })`) captures `label` at the single
  execution of the component function. Parent signal updates won't re-render tooltip.
  Fix: accept `props` and read `props.label` in JSX, or use `splitProps`.

## Info
- For deeper Solid review (control flow, performance), read
  `.cursor/skills/solidjs-code-review/SKILL.md` — this change is otherwise small.
```

---

## Example 4: Out-of-scope diff (negative case)

**Context:** User asks to review changes that only touch `apps/api/ai/`.

```
## Review summary
Diff is outside frontend scope (`apps/gui/`, `packages/gui/`). No GUI checklist applied.

## Info
- Changes under `apps/api/ai/` are not covered by `code-review-gui`. Use backend review
  practices or `/review-bugbot` for a general bug sweep.
```

---

## Example 5: Implementation guidance (new Sec component)

**Context:** Task is to add a `SecProfileBadge` component in `packages/gui/seconder/`.

**Agent workflow:**

1. Read [RULES.md](RULES.md) — confirm `Sec` prefix, `@sec/i18n`, named exports, shadcn primitives.
2. Read an existing similar component (e.g. `SecToastProvider`) for folder layout.
3. Implement minimally.

**Snippet (package layer — correct patterns):**

```tsx
// packages/gui/seconder/components/SecProfileBadge/index.tsx
import { m } from '@sec/i18n';
import { cn } from '@sec/gui-seconder/lib/utils';
import { Badge } from '@sec/gui-seconder/components/shadcn/badge';

interface SecProfileBadgeProps {
  displayName: string;
  isVerified: boolean;
}

export function SecProfileBadge(props: SecProfileBadgeProps) {
  const label = props.isVerified
    ? m.components_auth_profile_verified()
    : m.components_auth_profile_unverified();

  return (
    <Badge
      aria-label={label}
      className={cn(props.isVerified && 'border-green-500')}
    >
      {props.displayName}
    </Badge>
  );
}
```

**Key decisions enforced by RULES.md:**

- `@sec/i18n` (package layer) — not `@i18n`
- Flat keys: `components_auth_profile_verified`
- `Sec` prefix, named export, `interface` for props
- shadcn `Badge` primitive + `cn()` — no ad-hoc styled span
- `aria-label` for accessibility

---

## Severity coverage reference

| Example | Critical | Warning | Info |
|---------|:--------:|:-------:|:----:|
| 1 Route auth | ✓ | ✓ | — |
| 2 secFetch | — | ✓ | ✓ |
| 3 Solid props | ✓ | — | ✓ |
| 4 Out of scope | — | — | ✓ |
| 5 Implementation | — | — | — |

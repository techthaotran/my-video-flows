# UI/UX Design Conventions — seconder.ai

> **Project-specific reference** for the `prototype-planner` command.
> Filled for **seconder.ai**. When reusing the command in another project, overwrite this file with that project's UI stack.
>
> Scope: **visual/component only.** Client state/data-store conventions live in `gui-store-conventions.md`, not here.

## 1. Stack
- **Framework:** React 19 + react-router 7, bundled with **Vite**. App: `apps/gui/seconder-webapp-extension` (runs as both web app and browser extension via `@crxjs/vite-plugin`).
- **Styling:** **Tailwind CSS v4** (`@tailwindcss/vite`), theme via CSS variables + `@theme inline`. No CSS-in-JS.
- **Component library:** **shadcn/ui** (built on `radix-ui`), shared from `@sec/gui-seconder`.

## 2. Where things live
- **Shared components:** `packages/gui/seconder/components/` — `shadcn/` (button, dialog, input, select, sidebar, tabs, tooltip, sheet, drawer, popover, command, etc.), plus `ai-elements/`, `auth/`, `error/`, `icons/`, `theme/`.
- **App components:** `apps/gui/seconder-webapp-extension/src/components/{ui,common,pages,extension}` — feature UI under `components/pages/*`.
- **Pages / routes:** `src/pages/*` + `src/routes/*` (react-router). Layout in `src/layout/` (`sidebar/`, `mobile/`).
- **Design tokens / theme:** `packages/gui/seconder/theme/globals-theme.css` + `globals.css` (+ `mapping.md`). App imports them via `src/index.css` → `@import '@sec/gui-seconder/theme/globals.css'`.

## 3. Design tokens
- **Colors:** defined as CSS custom properties in **OKLCH**, mapped to Tailwind tokens in `@theme inline` (e.g. `--color-primary: var(--primary)`). Semantic tokens: `background/foreground`, `primary`, `secondary`, `muted`, `accent`, `card`, `popover`, `destructive`, `border`, `input`, `ring`, `sidebar-*`, `chart-1..5`. Primary has alpha variants (`--primary-90/80/50/20`). **Use token names, never raw hex/oklch in components.**
- **Radius:** `--radius` scale → `--radius-sm/md/lg/xl`.
- **Typography:** `--font-sans: var(--font-open-sans)`.
- **Dark mode:** `.dark` class variant (`@custom-variant dark`).
- **Layout width:** `--max-width-layout: var(--layout-width-max)`.

## 4. Existing design line / component library
- **Match the shadcn/radix look** already used across the app; compose existing shadcn primitives before styling anything custom.
- **Core components to reuse (`@sec/gui-seconder/components/shadcn`):** button, badge, input, textarea, select, combobox, checkbox, switch, dialog, alert-dialog, drawer, sheet, popover, dropdown-menu, context-menu, command, tabs, accordion, collapsible, tooltip, avatar, breadcrumb, scroll-area, separator, skeleton, resizable, sidebar, nav-list, nav-user, logo.
- **Layout / shell:** app shell + sidebar from `src/layout/` and the shared `sidebar` component; mobile variants under `src/layout/mobile/`.
- **Icons:** `@sec/gui-seconder/components/icons`.

## 5. Design → component mapping
- Map each design element to an existing shadcn component + semantic token first; only create a new component when nothing fits, and justify it.
- Follow shadcn variant/prop conventions (e.g. `variant`, `size` props) rather than ad-hoc class overrides.
- Use Tailwind utility classes bound to theme tokens (e.g. `bg-primary`, `text-muted-foreground`, `rounded-lg`) — not hardcoded values.

## 6. Prototype hosting
- **Where:** add a route/page under the webapp (`src/pages/*` + `src/routes/*`) or a throwaway component under `src/components/pages/*` for the prototype.
- **Launch locally:** from `apps/gui/seconder-webapp-extension`, `pnpm dev` (runs `dev:web` on Vite + `dev:ext`); or `pnpm dev` at repo root (turbo) to bring up the whole stack. Web target is the one to view for UI prototypes.
- **Reviewers see it:** local Vite dev URL / screenshots.

## 7. Placeholder content
- Use lightweight hardcoded placeholder text/images purely to render visuals. **No real data / API wiring** in a prototype — that belongs to `schema-store-designer`. i18n strings live under `src/i18n/` if the prototype needs realistic copy.

## 8. Examples in this codebase
- **Feature UI to imitate:** screens under `src/components/pages/chat/` and `src/components/pages/prompt-templates/` show the target look-and-feel and shadcn usage.
- **Token/theme reference:** `packages/gui/seconder/theme/globals-theme.css` and `theme/mapping.md`.

---
name: figma-design-tokens
description: >-
  Mandatory rules for editing SEC Figma files (SEC project ver 3.0): all colors,
  spacing, radius, and typography must bind to variable collections or local text
  styles — never hardcoded hex/rgb or raw px for design tokens. Use when working
  in Figma, polishing UI design, creating or fixing landing/webapp frames, binding
  tokens, auditing FeedbackPage or shadcn components, or when the user mentions
  Figma variables, design tokens, spacing, radius, or "không dùng cứng".
---

# Figma Design Tokens (SEC)

**Read this skill before any Figma edit** in `SEC project ver 3.0 (activating)` or related SEC design files.

Hardcoded fills, strokes, padding, itemSpacing, cornerRadius, or ad-hoc font sizes are **not allowed** for design-token properties. Use **variable collections** and **text styles** from this file.

## Source of truth

| Layer | Collection / asset | Role |
| --- | --- | --- |
| Semantic tokens | **Tokens** (`VariableCollectionId:6:14`, mode `Default`) | Spacing, radius, `text/*`, `background/*`, `border/*`, `fill/*`, `layout/*` |
| Primitives | **Primitives** (`VariableCollectionId:8:47`, modes `Light` / `Dark`) | Raw colors; bind via Tokens aliases, not directly on UI unless no semantic token exists |
| Typography | **Text styles** on page `Typography` | `h1`, `h2`, `h3`, `h4`, `paragraph`, `lead`, `large`, `small`, `muted`, etc. |

There are **no font-size / line-height variables** in this file. Typography = **text style** + **text color variable**.

## Hard rules

1. **Colors** — `fills`, `strokes`, text color → semantic variable from **Tokens** (`text/*`, `background/*`, `border/*`). Never `#hex` or raw `rgb()` on production UI.
2. **Spacing** — `padding*`, `itemSpacing`, gap-like layout → `spacing/*` variables only. Never magic px for tokenized spacing.
3. **Radius** — `cornerRadius` / corner props → `radius/*` variables (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`).
4. **Typography** — apply `setTextStyleIdAsync` with a named style from `Typography`. Do not set `fontSize` / `lineHeight` manually unless creating a new text style for the system.
5. **Components** — fix tokens on **main components** (Input, Button, Select, Textarea, layouts), not only on page instances. Instances inherit bindings.
6. **Centering** — use auto-layout alignment (`counterAxisAlignItems: CENTER`, `primaryAxisAlignItems: CENTER`). Do not fake centering with calculated padding (e.g. `251px` sides).
7. **Modes** — UI semantic colors use **Tokens / Default**. Primitives Light/Dark are upstream; do not bypass Tokens for standard UI colors.

## Default token map (Feedback / landing forms)

Use [token-map.md](token-map.md) for the full table. Minimum set:

| UI role | Token / style |
| --- | --- |
| Page title | Text style `h1` + `text/text-foreground` |
| Body / intro | Text style `paragraph` + `text/text-muted-foreground` |
| Field label | Text style `muted` + `text/text-foreground` |
| Helper / char count | Text style `muted` + `text/text-muted-foreground` |
| Required `*` (if split) | `text/text-destructive` on asterisk node only |
| Placeholder | Text style `muted` + `text/text-muted-foreground` |
| Page background | `background/bg-background` |
| Content band (accent) | `background/bg-accent` |
| Primary CTA | `background/bg-primary` + `text/text-primary-foreground` (Button component) |
| Input surface | `background/bg-background` + `border/border-input` + `radius/rounded-md` |
| Page padding | `spacing/12` (48px) |
| Section gap | `spacing/8` (32px) |
| Field group gap | `spacing/5` (20px) |
| Label ↔ control | `spacing/2` (8px) |
| Title ↔ subtitle | `spacing/3` (12px) |
| Input padding | `spacing/3` vertical + `spacing/2` horizontal |
| Button padding | `spacing/4` vertical + `spacing/2` horizontal |

Spacing reference: `spacing/0`=0, `1`=4, `2`=8, `3`=12, `4`=16, `5`=20, `6`=24, `8`=32, `12`=48.

## Workflow (every Figma task)

### 1. Preflight — read tokens

1. Connect Figma Desktop Bridge on the target file.
2. Call `figma_get_variables` (`format: summary` or `filtered`) to refresh collection inventory.
3. If editing typography, list text styles via plugin (`figma.getLocalTextStylesAsync()`).
4. Identify which **main components** the page uses (e.g. `LandingPageLayout`, `FeedbackPage`, shadcn `Input`/`Button`).

### 2. Audit before edit

Scan target subtree for hardcoded values:

- SOLID fills/strokes without `boundVariables.color`
- `padding*` / `itemSpacing` without `boundVariables`
- `cornerRadius` without bound radius variables
- TEXT nodes without `textStyleId` and without bound fill

Log findings; plan bindings before moving frames.

### 3. Implement bindings

Use `figma_execute` with async APIs:

```javascript
await figma.loadAllPagesAsync();
const variable = await figma.variables.getVariableByIdAsync('VariableID:...');
node.setBoundVariable('paddingLeft', variable);

const paint = figma.variables.setBoundVariableForPaint(node.fills[0], 'color', variable);
node.fills = [paint];

await textNode.setTextStyleIdAsync('S:...'); // text style id from Typography
```

Bind on **component definitions** inside:

- `SecLayoutLandingPage` → `LandingPageLayout`, `HeaderLanding`
- `FeedbackPage` component set (`Mode=Desktop`, `Mode=Tablet`, `Mode=Mobile`)
- Shadcn pages: `❖ Input`, `❖ Textarea`, `❖ Button`, `❖ Select`

### 4. Layout hygiene

- One content tree per breakpoint frame; no duplicate stacked sections at `(0,0)`.
- Hide non-default Select dropdown layers (`Content`, `Ring`) in default state — do not leave open-menu artifacts visible.
- Tablet: use correct layout variant width (768) or centered mobile column; never Desktop 1142px inside 768px frame without resize.

### 5. Verify after edit

1. Re-run hardcoded audit on changed components → **0** unbound token properties.
2. `figma_capture_screenshot` on Desktop / Tablet / Mobile frames.
3. Confirm variables panel shows bindings (not raw values).

## Tooling

| Tool | Use |
| --- | --- |
| `figma_get_variables` | Inventory / resolved token values |
| `figma_get_file_data` | Structure only; not for token audit |
| `figma_execute` | Bind variables, fix layout, audit script |
| `figma_capture_screenshot` | Visual verify after changes |
| `figma_set_instance_properties` | Variant swaps only; does not replace token binding |

Do **not** use REST-only assumptions; prefer Desktop Bridge plugin state.

## SEC file context

| Item | Value |
| --- | --- |
| File | SEC project ver 3.0 (activating) |
| File key | `RtERLY8vlUC6zZ3gJJVLfU` |
| Feedback page | `↳ /feedback` (`node-id=14177-10047`) |
| Layout materials | Page `SecLayoutLandingPage` |
| Components | Pages under `—— Sec components ——`, `—— Shadcn components ——` |

## When creating new UI in Figma

1. Place inside a named **Section** (never floating on canvas).
2. Reuse existing components (`LandingPageLayout`, shadcn instances) — do not redraw inputs/buttons.
3. Apply tokens from day one; never "fix variables later".
4. If a needed semantic token does not exist, **add alias in Tokens collection** pointing to Primitives — do not hardcode on the frame.

## Anti-patterns (reject in review)

- `#BF3FD4`, `rgb(0.75, 0.25, 0.83)` on UI layers
- `paddingLeft = 251` for visual centering
- Duplicate `FeedbackPage` / form frames at same origin
- Desktop layout variant on Tablet artboard without width fix
- Text with `fontSize: 14` and no text style
- Editing instance overrides for colors that should live on the main component

## Additional reference

- Full role → token table: [token-map.md](token-map.md)
- Frontend implementation of same tokens: `.claude/skills/code-review-gui/RULES.md` (CSS/Tailwind side)
- Visual direction (non-token aesthetics): `.claude/skills/fe-design/SKILL.md`

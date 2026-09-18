# SEC Figma — Token Map

Reference for `figma-design-tokens` skill. All bindings target **Tokens** collection (`VariableCollectionId:6:14`, mode `Default`) unless noted.

## Spacing (`spacing/*`)

| Variable | px | Typical use |
| --- | --- | --- |
| `spacing/0` | 0 | Reset, collapsed |
| `spacing/1` | 4 | Tight inset, dropdown padding |
| `spacing/2` | 8 | Label↔input, button icon gap, horizontal input padding |
| `spacing/3` | 12 | Title↔subtitle, vertical input padding |
| `spacing/4` | 16 | Vertical button padding |
| `spacing/5` | 20 | Between form fields |
| `spacing/6` | 24 | Mobile horizontal padding option |
| `spacing/8` | 32 | Page header ↔ form, section gaps |
| `spacing/12` | 48 | Page padding, header horizontal padding |

If a spacing value is not in the table, pick the **closest token** or add a new `spacing/*` variable — do not use raw px.

## Radius (`radius/*`)

| Variable | px | Use |
| --- | --- | --- |
| `radius/rounded-sm` | 8 | Select focus ring, small chips |
| `radius/rounded-md` | 10 | Input, Button, Select input |
| `radius/rounded-lg` | 12 | Cards, larger surfaces |
| `radius/rounded-xl` | — | Prominent panels |
| `radius/rounded-full` | 9999 | Pills, avatars |

## Text colors (`text/*`)

| Variable | Resolves to (Light) | Use |
| --- | --- | --- |
| `text/text-foreground` | `color/foreground/100` | Titles, primary labels |
| `text/text-muted-foreground` | `color/muted-foreground/100` | Descriptions, helpers, placeholders |
| `text/text-primary` | `color/primary/100` | Brand accent text |
| `text/text-primary-foreground` | `color/primary-foreground/100` | Text on primary buttons |
| `text/text-secondary-foreground` | `color/secondary-foreground/100` | Secondary button text |
| `text/text-destructive` | `color/destructive/100` | Errors, required asterisk |
| `text/text-accent-foreground` | `color/accent-foreground/100` | Text on accent surfaces |

## Background colors (`background/*`)

| Variable | Use |
| --- | --- |
| `background/bg-background` | Page / frame background |
| `background/bg-accent` | Content band (light blue area in landing slot) |
| `background/bg-primary` | Primary buttons, header bar |
| `background/bg-muted` | Muted surfaces |
| `background/bg-input` | Input fill (if not using bg-background + border) |
| `background/bg-card` | Card surfaces |

## Border colors (`border/*`)

| Variable | Use |
| --- | --- |
| `border/border-input` | Input, textarea, select borders |
| `border/border-border` | Default borders |
| `border/border-primary` | Focus / primary outlines |
| `border/border-destructive` | Error states |

## Text styles (Typography page)

| Style | fontSize / lineHeight | Use |
| --- | --- | --- |
| `h1` | 36 / 40 | Page title |
| `h2` | 30 / 36 | Section title |
| `h3` | 24 / 32 | Subsection |
| `h4` | 20 / 28 | Small heading |
| `paragraph` | 16 / 28 | Body copy |
| `lead` | 20 / 28 | Intro emphasis |
| `large` | 18 / 28 | Large body |
| `small` | 14 / 14 | Compact UI text |
| `muted` | 14 / 20 | Labels, helpers, placeholders |

Apply via `await node.setTextStyleIdAsync(styleId)` then bind fill color variable.

## Layout (`layout/*`)

| Variable | Use |
| --- | --- |
| `layout/width-sm` | Small control width token |
| `layout/width-lg` | Large content width token |
| `layout/height-sm` | Small control height |
| `layout/height-lg` | Large block height |

Prefer auto-layout + max-width from design (e.g. content 640px desktop) over hardcoded layout variables unless matching an existing layout token.

## Component binding checklist

When touching these mains, ensure bindings exist on **all variants**:

| Component set | Page | Bind |
| --- | --- | --- |
| `Input` | `❖ Input` | radius md, bg-background, border-input, padding spacing/3+2 |
| `Textarea` | `❖ Textarea` | same as Input |
| `Button` | `❖ Button` | radius md, bg-primary, padding spacing/4+2, itemSpacing spacing/2 |
| `Select` | `❖ Select` | radius md, borders, placeholder muted |
| `LandingPageLayout` | `SecLayoutLandingPage` | Slot bg-accent, Frame bg-background, Header bg-primary |
| `FeedbackPage` | `↳ /feedback` Materials | spacing, text styles, centered content |

## Audit script pattern

```javascript
// Returns nodes with unbound token properties under `root`
function auditHardcoded(root) {
  const issues = [];
  function walk(node, path) {
    const p = path + '/' + node.name;
    if (node.type === 'TEXT') {
      if (!node.fills?.[0]?.boundVariables?.color) issues.push({ p, t: 'text-fill' });
      if (!node.textStyleId) issues.push({ p, t: 'text-style' });
    }
    if (node.fills?.[0]?.type === 'SOLID' && !node.fills[0].boundVariables?.color)
      issues.push({ p, t: 'fill' });
    if (node.paddingLeft > 0 && !node.boundVariables?.paddingLeft)
      issues.push({ p, t: 'padding' });
    if (node.itemSpacing > 0 && !node.boundVariables?.itemSpacing)
      issues.push({ p, t: 'itemSpacing' });
    if (node.cornerRadius > 0 && !node.boundVariables?.topLeftRadius)
      issues.push({ p, t: 'radius' });
    if ('children' in node) node.children.forEach(c => walk(c, p));
  }
  walk(root, '');
  return issues;
}
```

Target: **0 issues** before marking design task complete.

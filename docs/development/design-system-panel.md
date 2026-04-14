# `<Panel>` — Page-Zone Wrapper Component

New in the `@/ui` component library. Resolves the long-running
"four coexisting card conventions" drift documented in the session
notes from the UI audit.

## Why it exists

Before this component, the `@/ui` library provided atoms (`Text`,
`Stack`, `Box`), layout primitives (`Grid`, `Divider`), and widgets
(`MetricCard`, `ChartPanel`, `StatCard`), but had **no canonical
answer for "how do I wrap a multi-element zone on a page?"** Every
page contributor invented their own wrapper — and three or four
distinct conventions grew in parallel:

| Convention | Mechanism | Example page |
|---|---|---|
| A | Inline React `style={{ ... }}` using tokens | `ChartPanel` (widget layer) |
| B | Hand-rolled Tailwind className | `AdminSettingsPage` |
| C | Custom `.card` CSS class in `index.css` | `OverviewPage` |
| D | Plain `<div className="border ...">` | most fleet pages |

The visual difference between them is real and visible — users
commented that "some pages look polished, others look flat" without
being able to articulate why. The root cause was that Convention B
and C (the polished ones) weren't reusable, and Convention D (used
by most pages) had no accent structure to fall back on.

`<Panel>` codifies Convention B (the AdminSettings pattern) as a
first-class, discoverable, type-checked component so every new page
has one canonical answer.

## API

```tsx
import { Panel } from '@/ui';

<Panel tone="info">
  <SectionHeader title="Tenant Privacy" />
  <Stack gap="md">...</Stack>
</Panel>
```

### Props

- `tone` — semantic color of the top accent bar. One of:
  `default` (neutral), `info` (blue), `warning` (orange),
  `destructive` (red), `advanced` (magenta), `system` (muted). Default
  is `default`.
- `padding` — `sm` (p-4, 16px), `md` (p-6, 24px), or `lg` (p-8, 32px).
  Default is `lg` to match the AdminSettings feel.
- `spacing` — internal vertical rhythm between direct children.
  `none`, `sm` (space-y-3), `md` (space-y-6, default), or `lg`
  (space-y-8).
- `as` — polymorphic element tag. `section` (default), `div`,
  `article`, or `aside`.
- `noAccent` — hide the top accent bar. Use sparingly (only for
  nested panels where an outer Panel already provides the accent).
- Plus any standard HTML attributes (`className`, `aria-labelledby`,
  `role`, etc.).

### Tone vocabulary

The six tones are a **semantic vocabulary, not just colors**. Apply
them consistently:

- **`default`** — informational zones, summaries, neutral data displays
- **`info`** — primary or core control zones, main settings
- **`warning`** — cautionary zones, important but recoverable actions
- **`destructive`** — danger zones (deletions, revocations, resets)
- **`advanced`** — advanced/expert-mode controls, experimental features
- **`system`** — system information, read-only metadata

The goal: teach users "red top bar = destructive, magenta = advanced"
across every page so they can transfer the intuition without reading
labels. AdminSettings already uses this vocabulary internally; `<Panel>`
makes it reusable app-wide.

## When to use Panel vs a widget component

- **Widgets** (`MetricCard`, `ChartPanel`, `StatCard`, `DataTable`) own
  their own card-like visual. Use them directly; **do not wrap them in
  a Panel** (you'd get nested card chrome).
- **Panel** is for **grouping multiple atoms or widgets** into a named
  zone. A settings section with a header and some form controls, a
  page section with a mix of `KpiStrip` + `DataTable`, a danger zone
  with a button — those are Panel territory.
- **Plain `<div>`** is fine for **trivial wrappers** that don't warrant
  a zone (e.g., a flex container around two buttons). Don't reach for
  Panel just because you need a `<div>`.

## Migration guide

When converting an existing page:

1. **Find ad-hoc card wrappers**: grep for `bg-surface-card`,
   `border-t-4 border-ac-`, `shadow-card`, `className="card"`, or
   raw `<section className="border...">`.
2. **Pick the tone** by asking "what does this zone semantically mean?"
   — not "what color looks right." If you catch yourself picking a
   color for aesthetic reasons, you probably want `default`.
3. **Pick the padding** — `lg` for top-level page sections (default),
   `md` for standard control zones, `sm` for compact inline panels.
4. **Pick the spacing** — `md` is the default and matches
   AdminSettings. Use `none` if the Panel's children manage their own
   layout (e.g., a single child like `ActiveCampaignList`).
5. **Keep accessibility attributes** — `aria-labelledby`, `role`, etc.
   pass through via the `...rest` spread.
6. **Delete the old wrapper's className** and let Panel own the
   background, border, shadow, and padding.

## Examples in the codebase (POC migrations)

- `apps/signal-horizon/ui/src/pages/OverviewPage.tsx` — Active
  Campaigns section. Converted from `<section className="card border-t-4
  border-ac-blue">` to `<Panel tone="info" padding="md" spacing="none">`.
- `apps/signal-horizon/ui/src/pages/fleet/SensorConfigPage.tsx` —
  Apparatus Echo Target preset row. Converted from
  `<Stack className="border border-border-subtle bg-surface-card p-4">`
  to `<Panel tone="default" padding="sm" spacing="none" as="div">`.

Both pages type-check and build clean (`pnpm type-check`,
`pnpm build` in `apps/signal-horizon/ui`) with no visual regression
in the retained conventions.

## Not yet migrated

- `OverviewPage.tsx`'s **Live Attack Map** section uses `.card scanlines
  tactical-bg` — a themed "tactical HUD" aesthetic with custom visual
  effects (grid overlay, scanlines) that aren't part of Panel's
  vocabulary. Leave as-is until we decide whether to add a
  `variant="tactical"` prop to Panel or keep it as a themed exception.
- `OverviewPage.tsx`'s **Top Attackers** and **Top Fingerprints**
  sections use `.card border-t border-border-subtle` with internal
  `card-header`/`card-body` split. Those need a Panel API for
  slotted headers before they can be converted cleanly.
- `AdminSettingsSkeleton.tsx` duplicates the AdminSettings pattern
  inline for its loading state. Convert to `<Panel>` in the same
  sweep that migrates AdminSettingsPage itself (deliberately held
  off for now to keep the POC scoped).
- Most Hunting pages use `.card`/`card-header`/`card-body` — same
  header-slot issue as the Top Attackers section.

These deferrals tell us the next Panel feature work: **slotted
headers** (a `<Panel.Header>` / `<Panel.Body>` split) so Panel can
absorb the remaining `.card-header`/`card-body` usage sites.

## Next steps

The POC proves Panel works for straightforward wrapper migrations.
Before a full sweep, decide:

1. **Header slot support**: should Panel ship a `<Panel.Header>`
   compound component that styles a header bar with bottom border
   and reduced padding, matching the existing `card-header` pattern?
   This would unlock the OverviewPage Top Attackers / Top Fingerprints
   conversions and most Hunting page conversions.
2. **Tactical variant**: should Panel gain a `variant="tactical"`
   prop that layers on `scanlines`/`tactical-bg` effects for themed
   pages like the attack map? Or should those stay outside Panel's
   responsibility entirely?
3. **Deprecate `.card`**: once headers are slotted and enough pages
   have migrated, mark `.card` in `src/index.css` as deprecated with
   a comment and a grep-count target (e.g., "remove when .card usage
   drops below 10 files").

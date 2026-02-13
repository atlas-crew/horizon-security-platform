# Signal Horizon UI — Agent Rules

## Component Library (MANDATORY)

**BEFORE creating any UI element, check `src/ui/index.ts` for an existing component.**

All UI must use the component library at `src/ui/`. Never hardcode colors, spacing, fonts, or create ad-hoc styled elements.

### Import Pattern

```tsx
// ✅ CORRECT — Always import from @/ui
import { MetricCard, KpiStrip, Button, StatusBadge, DataTable } from '@/ui';
import { colors, spacing, fontFamily, chartColors } from '@/ui';
import { Stack, Box, Text } from '@/ui';
import { barGradientDefs, tooltipDefaults, axisDefaults } from '@/ui';

// ❌ WRONG — Never do these
import { colors } from '../tokens';           // Use @/ui barrel export
const blue = '#0057B7';                        // Use colors.blue
<div style={{ padding: '16px' }}>              // Use spacing.md
<div style={{ borderRadius: '8px' }}>          // borderRadius is ALWAYS 0
<div style={{ fontFamily: 'Inter' }}>          // Use fontFamily (Rubik)
```

### Available Components (check src/ui/index.ts for full list)

| Need | Use |
|------|-----|
| Single KPI / metric | `<MetricCard label="..." value="..." />` |
| Row of KPIs | `<KpiStrip items={[...]} />` |
| Chart wrapper | `<ChartPanel title="...">` |
| Data grid | `<DataTable columns={[...]} data={[...]} />` |
| Status indicator | `<StatusBadge status="active" />` |
| Section heading | `<SectionHeader title="..." />` |
| Action button | `<Button variant="primary">` |
| Alert / notice | `<Alert variant="warning">` |
| Tab navigation | `<Tabs items={[...]} />` |
| Overlay | `<Modal>` or `<Drawer>` |
| Time filter | `<TimeRangeSelector />` |
| Form inputs | `<Input>` and `<Select>` |
| Layout | `<Stack>`, `<Box>`, `<Grid>`, `<Divider>` |
| Typography | `<Text size="lg" weight="light">` |

### Brand Rules (Non-Negotiable)

- **Font**: Rubik only. Headings use weight 300 (light). Body uses weight 400.
- **Colors**: Import from `colors` token. Primary: blue (#0057B7), navy (#001E62), magenta (#D62598)
- **Border radius**: ALWAYS 0. Never round corners. `borderRadius: 0` on everything.
- **Spacing**: Use `spacing` tokens (xs/sm/md/lg/xl/xxl), never raw pixel values
- **Charts**: Use `chartColors` array for data series. Apply `barGradientDefs`, `tooltipDefaults`, `axisDefaults` from chart defaults.

### Chart Implementation

```tsx
import { ChartPanel } from '@/ui';
import { barGradientDefs, tooltipDefaults, axisDefaults, gridDefaults } from '@/ui';
import { chartColors } from '@/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

<ChartPanel title="Request Volume">
  <BarChart data={data}>
    <defs>{barGradientDefs()}</defs>
    <CartesianGrid {...gridDefaults} />
    <XAxis {...axisDefaults} dataKey="name" />
    <YAxis {...axisDefaults} />
    <Tooltip {...tooltipDefaults} />
    <Bar dataKey="value" fill={`url(#${barGradientId(chartColors[0])})`} />
  </BarChart>
</ChartPanel>
```

### Adding New Components

If a component genuinely doesn't exist in the library:
1. Create it in `src/ui/components/` following the existing pattern
2. Use tokens for ALL visual values
3. Export it from `src/ui/index.ts`
4. Add JSDoc with usage examples (see Button.tsx or MetricCard.tsx for format)

Do NOT create one-off styled components in page files.

## Page Structure

Pages live in `src/pages/`. Each page should:
1. Import layout primitives from `@/ui` (Stack, Box, Grid)
2. Compose using library components
3. Keep page files focused on data fetching and layout composition, not styling

## State Management

- Use Zustand for global state (not Redux)
- React Query for server state
- Local useState for UI-only state

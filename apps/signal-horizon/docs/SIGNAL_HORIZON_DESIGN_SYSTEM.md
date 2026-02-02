# Signal Horizon Design System

## Required Reading

Before building any Signal Horizon component, read `/mnt/skills/public/frontend-design/SKILL.md` for guidance on avoiding generic AI aesthetics.

Apply the frontend-design mindset WITHIN the Atlas Crew brand constraints:
- The skill encourages bold creative choices — your boldness comes from the Navy + Magenta palette and the "war room" personality
- The skill says dominant colors with sharp accents beat timid palettes — that means Navy dominant, Magenta as the sharp accent
- The skill warns against Inter, Roboto, Arial — you use Rubik exclusively
- The skill encourages unexpected layouts — that means not defaulting to card grids

The creativity is in the composition and density, not in breaking brand.

---

## Platform Context

You are building components for Signal Horizon, a security fleet management platform. This is a war room for SOC analysts, not a friendly SaaS app. The aesthetic is operational, dense, and precise.

---

## Brand Foundation

### Color Hierarchy (use proportionally)

| Color | Hex | Usage | Proportion |
|-------|-----|-------|------------|
| Navy Blue | #001E62 | Primary backgrounds, headers, dominant surfaces | 60% |
| Atlas Crew Blue | #0057B7 | Interactive elements, links, secondary emphasis | 25% |
| Magenta | #D62598 | Alerts, key metrics, critical actions, data highlights | 10% |
| White | #FFFFFF | Text on dark surfaces | — |
| Off-white | #F0FAF8 | Light backgrounds | — |
| Black | #000000 | Text on light surfaces | — |

### Accent Colors (sparingly, for data visualization)

| Color | Hex | Semantic Use |
|-------|-----|--------------|
| Orange | #E35205 | Warnings |
| Green | #00B140 | Success, healthy |
| Red | #BF3A30 | Critical, blocked |
| Purple | #A400FF | Anomalies |
| Sky Blue | #3298BC | Informational |

### Color Tints and Shades

**Atlas Crew Blue tints/shades:**
- Tint: #70BAF7
- Shade: #004189, #001E6A

**Navy Blue shades:**
- #001E62 (primary)
- #001E6A (darker)

**Magenta tints/shades:**
- Tint: #E97BC1
- Shade: #A60B72, #6D0A50

---

## Typography

**Font Family:** Rubik (Google Fonts)

| Element | Weight | Size | Notes |
|---------|--------|------|-------|
| H1 Title | Light (300) | 48px / 3rem | Page titles |
| H2 Headline | Light (300) | 32px / 2rem | Section headers |
| H3 Headline | Light (300) | 28px / 1.75rem | Card headers |
| Subhead | Regular (400) | 20px / 1.25rem | |
| Body Copy | Regular (400) | 16px / 1rem | |
| Labels | Medium (500) | 14px | Emphasis |
| Buttons | Semibold (600) | 14-16px | |
| Eyebrows | Bold (700) | 16px | ALL-CAPS, letter-spacing: 0.1em |

### Critical Typography Rules

- **Headlines are LIGHT (300), not bold.** Thin type on dark backgrounds is the Atlas Crew look.
- **Never use system fonts.** Always load Rubik.
- **Eyebrows are uppercase with tracking.** `text-transform: uppercase; letter-spacing: 0.1em;`

---

## Layout Rules

### Spacing & Density

- **Information density is good.** SOC analysts want data visible, not hidden behind clicks.
- **Whitespace is intentional, not default.** Tight spacing communicates urgency.
- **Left-align everything.** No centered text blocks except page titles.

### Structure

- **No border-radius anywhere.** `* { border-radius: 0 !important }`
- **Not everything is a card.** Use full-width tables, asymmetric splits, dense panels.
- **Vary the layout.** Avoid uniform card grids. Mix widths, use asymmetry.
- **Tables over cards for data.** If it's tabular, use a table.

---

## Component Patterns

### Navigation

- Dark navy sidebar or top bar
- Active state: Atlas Crew Blue text or magenta underline
- Do NOT use background fill for active state

### Data Tables

- Full-width, no card wrapper
- Dense rows: 36-40px height
- Row hover: subtle navy tint (#001E62 at 10% opacity)
- Sortable columns with clear indicators
- Header row: Navy background, white text

### Metrics / KPIs

- Large numbers in Rubik Light (300)
- Label above in eyebrow style (caps, small, tracked)
- Use magenta for the single most important number
- Secondary metrics in Atlas Crew Blue

### Charts & Data Visualization

- Background: Navy (#001E62)
- Primary data: Atlas Crew Blue (#0057B7)
- Highlights/thresholds: Magenta (#D62598)
- **No gradient fills.** Solid colors only.
- Grid lines: subtle, 10-20% white opacity

### Alerts & Badges

| Severity | Color | Background |
|----------|-------|------------|
| Critical | White | Magenta #D62598 |
| Warning | White | Orange #E35205 |
| Info | Atlas Crew Blue | Navy outline only |
| Success | White | Green #00B140 |

- **Square badges, not rounded pills**
- No border-radius

### Buttons

| Type | Style |
|------|-------|
| Primary | Magenta background (#D62598), white text |
| Secondary | Atlas Crew Blue outline (#0057B7), no fill |
| Tertiary | Text only, Atlas Crew Blue, with arrow |

- **No rounded corners**
- **No shadows**
- Height: 40px standard

### Empty States

- Don't be cute
- "No data" or "No results" is fine
- No illustrations or emoji

---

## Text Color Hierarchy

Color creates visual hierarchy. The eye should flow: **White (important) → Atlas Crew Blue (supporting) → Magenta (critical/action)**.

| Element | Light Mode | Dark Mode | Purpose |
|---------|------------|-----------|---------|
| **Primary content** (KPI values, headings) | Navy #001E62 | White #FFFFFF | Important - demands attention |
| **Supporting content** (labels, timestamps) | Atlas Crew Blue #0057B7 | Atlas Crew Blue #0057B7 | Supporting - provides context |
| **Secondary content** (inactive items) | Navy 60% opacity | White 60% opacity | Background - doesn't compete |
| **Interactive elements** (links, buttons) | Atlas Crew Blue #0057B7 | Atlas Crew Blue #0057B7 | Clickable - indicates action |
| **Critical emphasis** (alerts, active states) | Magenta #D62598 | Magenta #D62598 | Emphasis - urgent attention |

### Application Examples

| UI Element | Color | Rationale |
|------------|-------|-----------|
| Section headers (SECURITY, INFRASTRUCTURE) | Atlas Crew Blue | Supporting - categorizes content |
| KPI labels (ACTIVE THREATS) | Atlas Crew Blue | Supporting - describes the value |
| KPI values (42, 1,337) | White (dark) / Navy (light) | Primary - the actual data |
| Links ("View all", "Details") | Atlas Crew Blue | Interactive - indicates clickability |
| Active nav item | Magenta | Emphasis - current location |
| Inactive nav items | 60% opacity | Secondary - available but not active |
| Timestamps ("Updated 5m ago") | Atlas Crew Blue Tint #70BAF7 | Supporting - contextual info |
| Risk score ≥70 | Magenta | Critical emphasis |
| Risk score 50-69 | Warning Orange #E35205 | High priority |

### The Rule

> **If everything is white, nothing stands out.** Primary content gets full brightness. Supporting content uses Atlas Crew Blue. Only critical actions and states use magenta.

---

## Anti-Patterns (DO NOT DO)

- ❌ Rounded corners anywhere
- ❌ Blue-on-blue-on-blue (use navy + magenta for contrast)
- ❌ Bold headlines (use Light 300)
- ❌ Card grids with equal spacing (vary the layout)
- ❌ Gradient backgrounds or fills
- ❌ Friendly illustrations or emoji
- ❌ Centered paragraph text
- ❌ Low information density
- ❌ Gray as a primary color (use navy)
- ❌ Default Tailwind color palette (slate, zinc, neutral)
- ❌ Inter, Roboto, Arial, or any system fonts
- ❌ Rounded pill badges
- ❌ Drop shadows on cards
- ❌ Generic "SaaS dashboard" patterns

---

## Personality

This is a security command center. It should feel:

| ✓ Should feel | ✗ Should NOT feel |
|---------------|-------------------|
| Operational | Marketing |
| Dense | Spacious |
| Precise | Playful |
| Confident | Cautious |
| Professional | Friendly |
| Urgent | Relaxed |

**Reference points:** Military radar UI, Bloomberg terminal, Datadog, air traffic control.

---

## CSS Variables Template

```css
:root {
  /* Primary */
  --color-navy: #001E62;
  --color-ac-blue: #0057B7;
  --color-magenta: #D62598;
  --color-white: #FFFFFF;
  --color-black: #000000;
  
  /* Tints */
  --color-ac-blue-tint: #70BAF7;
  --color-magenta-tint: #E97BC1;
  
  /* Shades */
  --color-ac-blue-shade: #004189;
  --color-navy-shade: #001E6A;
  --color-magenta-shade: #A60B72;
  
  /* Semantic */
  --color-warning: #E35205;
  --color-success: #00B140;
  --color-critical: #BF3A30;
  --color-info: #3298BC;
  --color-anomaly: #A400FF;
  
  /* Typography */
  --font-family: 'Rubik', sans-serif;
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* Spacing (tight) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
}

* {
  border-radius: 0 !important;
}
```

---

## Tailwind Config (if using Tailwind)

```javascript
module.exports = {
  theme: {
    fontFamily: {
      sans: ['Rubik', 'sans-serif'],
    },
    colors: {
      navy: '#001E62',
      'ac-blue': '#0057B7',
      magenta: '#D62598',
      white: '#FFFFFF',
      black: '#000000',
      warning: '#E35205',
      success: '#00B140',
      critical: '#BF3A30',
      info: '#3298BC',
    },
    borderRadius: {
      none: '0',
      DEFAULT: '0',
    },
  },
}
```

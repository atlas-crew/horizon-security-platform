---
title: Brand Guidelines
prev: false
next: false
---

# Brand Guidelines

The Horizon design system defines colors, typography, iconography, and usage rules for both the Horizon and Synapse products. These interactive reference documents are the source of truth for the visual identity.

<a href="/brand/edge-protection-brand-package.zip" download style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--vp-c-brand-1); color: #fff; text-decoration: none; font-weight: 600; margin-top: 12px;">Download Brand Package (.zip, 499 KB)</a>

## Reference Documents

<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 24px;">

<a href="/brand/color-reference.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Color Reference</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">Full color palette — Vivid Blue, Arc Violet, Slate Command surfaces, status colors, WCAG contrast compliance table.</div>
</a>

<a href="/brand/typography-reference.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Typography Reference</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">15 type roles using the Recursive variable font. Live specimens with exact font-variation-settings for each role.</div>
</a>

<a href="/brand/usage-guide.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Usage Guide</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">Do/don't rules for applying colors, typography, and component patterns. CSS variable quick reference.</div>
</a>

<a href="/brand/edge-protection-lockups.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Brand Lockups</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">Horizon and Synapse lockups in horizontal, stacked, and badge layouts. Dark and light variants at multiple sizes.</div>
</a>

<a href="/brand/edge-protection-reference-card.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Reference Card</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">Single-page visual summary of the entire design system — colors, typography, icons, and lockups.</div>
</a>

</div>

## Quick Rules

| Rule | Detail |
| --- | --- |
| **Font** | Recursive (variable) — one font, 15 roles via axis settings |
| **Border radius** | 0 everywhere, no exceptions |
| **Primary** | `#1E90FF` (Vivid Blue) — links, buttons, active states |
| **Accent** | `#8B5CF6` (Arc Violet) — focus rings, anomaly accents |
| **Coral** | `#F97316` — logo marks only, never in UI |
| **Dark surfaces** | Slate Command scale: `#080E1A` → `#182440` |
| **Text (dark)** | Primary `#E8ECF4`, secondary `#8899B0`, muted `#5A6F8A` (14px+ only) |
| **Shadows** | `rgba(26, 43, 66, ...)` — slate tint, never pure black |

## Source Files

Brand assets are in the repository at `brand/`:

```
brand/
├── banners/          # Full-width banners (SVG + PNG)
├── icons/            # Product icons at multiple sizes (SVG + PNG)
├── lockups/          # Wordmark + icon lockups (SVG + PNG)
└── lockup-sheets/    # HTML reference sheets
```

The design system source of truth is in the UI codebase:

- **CSS variables:** `apps/signal-horizon/ui/src/index.css`
- **Tailwind config:** `apps/signal-horizon/ui/tailwind.config.js`
- **Palette documentation:** `apps/signal-horizon/ui/PALETTE.md`

---
title: Brand Guidelines
prev: false
next: false
---

# Brand Guidelines

The Horizon design system defines colors, typography, iconography, and usage rules for both the Horizon and Synapse products. These interactive reference documents are the source of truth for the visual identity.

<a href="/brand/edge-protection-brand-package.zip" download style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--vp-c-brand-1); color: #fff; text-decoration: none; font-weight: 600; margin-top: 12px;">Download Brand Package (.zip)</a>

## Reference Documents

<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 24px;">

<a href="/brand/color/color-reference.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Color Reference</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">Full color palette — Vivid Blue, Arc Violet, Slate Command surfaces, status colors, WCAG contrast compliance table.</div>
</a>

<a href="/brand/typography/typography-reference.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Typography Reference</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">15 type roles using the Recursive variable font. Live specimens with exact font-variation-settings for each role.</div>
</a>

<a href="/brand/guides/usage-guide.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Usage Guide</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">Do/don't rules for applying colors, typography, and component patterns. CSS variable quick reference.</div>
</a>

<a href="/brand/lockups/lockup-sheet-v1.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
<div style="font-weight: 600; margin-bottom: 8px;">Brand Lockups</div>
<div style="font-size: 13px; color: var(--vp-c-text-2);">Combined Horizon and Synapse lockup sheet — orange and violet wordmarks side-by-side in horizontal, stacked, and badge layouts. Per-product sheets are also included in the downloadable package.</div>
</a>

<a href="/brand/reference/edge-protection-reference-card.html" target="_blank" style="display: block; padding: 20px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); text-decoration: none; color: inherit;">
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

Brand assets live under `brand/` in the repository:

```
brand/
├── color/           # Color reference (HTML + Markdown)
├── typography/      # Typography reference (HTML + Markdown)
├── guides/          # Usage guide (HTML + Markdown)
├── reference/       # Quick reference card (HTML + PDF)
├── lockups/         # Wordmark + icon lockups (HTML sheets + per-product SVGs)
│   ├── horizon/
│   └── synapse/
├── icons/           # Product icons (SVG)
├── banners/         # Full-width banners (SVG + PNG)
└── infographics/    # Technical infographics
    ├── html/        # Interactive HTML versions
    ├── pdf/         # Print-ready PDFs
    └── png/         # Static images
```

The downloadable brand package at the top of this page is **generated at build time** from the current contents of `brand/`, so it always reflects the latest source assets.

The design system source of truth lives in the UI codebase:

- **CSS variables:** `apps/signal-horizon/ui/src/index.css`
- **Tailwind config:** `apps/signal-horizon/ui/tailwind.config.js`
- **Palette documentation:** `apps/signal-horizon/ui/PALETTE.md`

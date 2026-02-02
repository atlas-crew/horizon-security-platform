# Signal Horizon Design Review Checklist

Use this checklist before shipping any UI component. Every item should be checked.

---

## Pre-Work

- [ ] Did you read `/mnt/skills/public/frontend-design/SKILL.md`?
- [ ] Did you read `SIGNAL_HORIZON_DESIGN_SYSTEM.md`?
- [ ] Is there a clear conceptual direction (operational war room)?

---

## Colors

- [ ] Is Navy Blue #001E62 the dominant dark color?
- [ ] Did you avoid gray/slate as a primary surface color?
- [ ] Is Magenta #D62598 used for emphasis/highlights?
- [ ] Is the color ratio approximately 60/25/10 (navy/blue/magenta)?
- [ ] Are accent colors (orange, green, red) reserved for semantic meaning only?
- [ ] No default Tailwind colors visible (slate, zinc, neutral, gray)?
- [ ] No blue-on-blue-on-blue situations?

---

## Typography

- [ ] Is the font Rubik (not Inter, Roboto, Arial, system fonts)?
- [ ] Are headlines using Rubik Light (300), NOT bold?
- [ ] Is body text Rubik Regular (400)?
- [ ] Are labels/eyebrows ALL-CAPS with letter-spacing?
- [ ] Is the type hierarchy clear (only 3-4 sizes per view)?
- [ ] No centered body text (only page titles can be centered)?

---

## Layout

- [ ] Are ALL corners sharp? `border-radius: 0`
- [ ] No rounded corners on any element?
- [ ] Is information density appropriate (no excessive whitespace)?
- [ ] Is the layout asymmetric where appropriate?
- [ ] Did you avoid uniform card grids?
- [ ] Are tables used for tabular data (not cards)?
- [ ] Does it feel dense and operational, not spacious and friendly?

---

## Components

### Buttons
- [ ] Primary buttons: Magenta background, white text?
- [ ] Secondary buttons: Atlas Crew Blue outline, no fill?
- [ ] No rounded corners on buttons?
- [ ] No drop shadows on buttons?

### Tables
- [ ] Full-width (no card wrapper)?
- [ ] Dense rows (36-40px)?
- [ ] Navy header row with white text?
- [ ] Subtle hover state?

### Badges/Alerts
- [ ] Square badges (no rounded pills)?
- [ ] Correct semantic colors (magenta=critical, orange=warning, green=success)?

### Charts
- [ ] Navy background?
- [ ] Atlas Crew Blue for primary data?
- [ ] Magenta for highlights/thresholds?
- [ ] No gradient fills (solid colors only)?

### Empty States
- [ ] Simple text, no illustrations?
- [ ] No emoji or cute messaging?

---

## Anti-Pattern Check

Check that NONE of these exist:

- [ ] No rounded corners anywhere
- [ ] No gradient fills
- [ ] No illustrations or emoji
- [ ] No gray as a primary surface color
- [ ] No drop shadows on cards
- [ ] No Inter/Roboto/Arial/system fonts
- [ ] No default Tailwind color palette
- [ ] No centered paragraph text
- [ ] No low-density "spacious" layouts
- [ ] No uniform card grids
- [ ] No bold headlines (should be Light 300)

---

## Personality Gut Check

Answer honestly:

- [ ] Does this look like a security war room?
- [ ] Would a SOC analyst find this useful and scannable?
- [ ] Is the information density appropriate for operational use?
- [ ] Is it distinct from generic dashboards?
- [ ] Could you tell this is an Atlas Crew product without the logo?
- [ ] Does it feel operational, not marketing?
- [ ] Would you describe this as "generic AI dashboard"? (If YES → redo it)

---

## Final Sign-Off

- [ ] All sections above pass
- [ ] Viewed the component at realistic data volumes
- [ ] Tested with both minimal and maximal data states
- [ ] Component matches the Atlas Crew brand reference card

**Reviewer:** _______________  
**Date:** _______________  
**Component:** _______________

---

## Quick Reference

### Colors
| Role | Hex | Proportion |
|------|-----|------------|
| Navy (dominant) | #001E62 | 60% |
| Atlas Crew Blue (interactive) | #0057B7 | 25% |
| Magenta (emphasis) | #D62598 | 10% |

### Typography
| Element | Weight |
|---------|--------|
| Headlines | Light (300) |
| Body | Regular (400) |
| Labels | Medium (500) |
| Buttons | Semibold (600) |
| Eyebrows | Bold (700), ALL-CAPS |

### Non-Negotiables
1. `border-radius: 0` everywhere
2. Rubik font only
3. Light (300) headlines, never bold
4. Navy dominant, not gray
5. Magenta for emphasis, not more blue

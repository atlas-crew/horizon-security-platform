---
id: TASK-48
title: 'Infographic: Schema learning lifecycle'
status: Done
assignee: []
created_date: '2026-04-12 19:27'
updated_date: '2026-04-12 19:33'
labels:
  - brand
  - infographic
  - schema-learning
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a brand infographic showing how API schemas are inferred, when learning is deferred vs. applied (e.g. after body-phase WAF verdict), and how the learned schema feeds DLP and anomaly detection. Output HTML, PNG, and PDF to brand/infographics/.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HTML, PNG, and PDF assets exist under brand/infographics/{html,png,pdf}
- [x] #2 Shows observe → infer → apply stages
- [x] #3 Explicitly depicts deferral after body-phase WAF verdict
- [x] #4 Shows feedback into DLP/anomaly detection
- [x] #5 Style matches existing infographics
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered three assets matching the house style of the existing 5 lifecycle infographics:

- `brand/infographics/html/schema-learning-lifecycle.html` (source of truth)
- `brand/infographics/png/schema-learning-lifecycle.png` (1200×1817, trimmed)
- `brand/infographics/pdf/schema-learning-lifecycle.pdf` (single page, 1200×1900px @page size)

## Content sections
1. **Hero stats** — ~5μs learn, ~3μs validate, 1.5× length tolerance, LRU eviction (grounded in `schema_learner.rs` doc comments and `SchemaLearnerConfig` defaults).
2. **Request Path pipeline** — 5-stage rail: Parse & Template → Validate → Body-Phase WAF → Verdict Gate → Train If Allowed. Explicit allow/block branch notes underneath showing the `pending_learn` consume-vs-drop behavior.
3. **What the Learner Captures** — 6 field cards: field types (incl. `mixed`), value patterns via `detect_pattern`, length/value bounds with tolerance, sample count / `min_samples_for_validation`, nested-structure depth limits, endpoint identity via LRU/DashMap.
4. **Example — POST /api/users** — side-by-side observed JSON body vs. inferred field schema.
5. **Downstream consumers** — `schema_violation` WAF rule kind, DLP scanner, anomaly detection.
6. **Anti-poisoning callout** — explains the TASK-41 invariant: body-phase WAF runs before the learner trains, so blocked payloads never enter the baseline.

## Grounding
All technical details verified against:
- `apps/synapse-pingora/src/profiler/schema_learner.rs` (config, perf, API, LRU)
- `apps/synapse-pingora/src/profiler/schema_types.rs` (FieldType, PatternType)
- `apps/synapse-pingora/src/main.rs` lines 3668-3810 (the `pending_learn` deferred-training control flow)
- `apps/synapse-pingora/src/waf/engine.rs` (schema_violation match kind + compare_threshold)

## Rendering pipeline (reusable for remaining infographic tasks)
Headless Google Chrome was used for both PNG and PDF:

    CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
      --virtual-time-budget=6000 --window-size=1200,2400 \
      --screenshot=png/NAME.png file://.../html/NAME.html
    magick png/NAME.png -bordercolor '#080e1a' -border 1x1 -trim +repage \
      -shave 1x1 -background '#080e1a' -gravity center -extent 1200xHEIGHT png/NAME.png
    "$CHROME" --headless=new --disable-gpu --no-sandbox --no-pdf-header-footer \
      --virtual-time-budget=6000 --print-to-pdf=pdf/NAME.pdf file://.../html/NAME.html

PDF single-page enforcement requires an `@page{size:1200px HEIGHTpx;margin:0;}` rule inside the `<style>` block, sized generously above the measured content height.
<!-- SECTION:FINAL_SUMMARY:END -->

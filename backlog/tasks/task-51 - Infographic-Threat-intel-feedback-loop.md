---
id: TASK-51
title: 'Infographic: Threat intel feedback loop'
status: Done
assignee: []
created_date: '2026-04-12 19:27'
updated_date: '2026-04-12 22:52'
labels:
  - brand
  - infographic
  - threat-intel
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a brand infographic showing how campaign correlation outputs re-arm detection — closing the loop that the existing campaign-correlation-engine infographic opens. Covers intel ingest, enrichment, correlation, and the path back into detection rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HTML, PNG, and PDF assets exist under brand/infographics/{html,png,pdf}
- [x] #2 Clearly shows the feedback loop from correlation outputs back into detection
- [x] #3 Complements campaign-correlation-engine.* without duplicating it
- [x] #4 Style matches existing infographics
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered three assets for the threat intel feedback loop infographic:

- `brand/infographics/html/threat-intel-feedback-loop.html`
- `brand/infographics/png/threat-intel-feedback-loop.png` (1200×1767)
- `brand/infographics/pdf/threat-intel-feedback-loop.pdf` (1 page, @page 2100px)

## Content
1. **Hero stats** — 8 correlation detectors · 4 signal categories · O(1) fingerprint lookup · +30 campaign risk add.
2. **Closed-loop SVG diagram** — center CampaignManager (O(1) DashMap), four nodes arranged around it: OBSERVE (top, blue) → CORRELATE (right, coral) → RE-ARM (bottom, violet) → ENFORCE (left, red) → back to OBSERVE via a dashed violet arrow labelled "NEW BLOCK EVENTS → NEW SIGNALS". Each node shows concrete function calls (`register_ja4(ip, fingerprint)`, `is_in_campaign?`, `risk +30 applied to each`).
3. **Signal categories (4)** — Attack, Anomaly, Behavior, Intelligence (from `intelligence/signal_manager.rs` `SignalCategory` enum).
4. **Correlation detectors (8)** — shared_fingerprint, ja4_rotation, timing_correlation, network_proximity, behavioral_similarity, attack_sequence, auth_token, graph. Each with the signal type and a one-line purpose. (Matches the 8 files in `correlation/detectors/`.)
5. **Before/after callout** — contrasts "without feedback: 198.51.100.12 blocked, 17 other IPs still exposed" vs. "with feedback: 17 IPs blocked on sight after 3rd fingerprint collision fires".

## Complementarity with existing campaign-correlation-engine infographic
The existing `campaign-correlation-engine.*` infographic shows *how campaigns are detected*. This one closes the loop by showing *what happens next* — how detection outputs re-arm enforcement in-process, at edge speed, without a backend round-trip. No visual duplication: this one uses a circular feedback diagram; the existing one uses a pipeline layout.

## Grounding
- `apps/synapse-pingora/src/correlation/mod.rs:1-30` — Phase 4 architecture, inverted indexes, DashMap concurrency, JA4 + JA4+JA4H indexes.
- `apps/synapse-pingora/src/correlation/manager.rs:1-30` — `CampaignManager::with_config`, default `shared_threshold: 3`, `rotation_threshold: 3`, `register_ja4` entry point.
- `apps/synapse-pingora/src/correlation/detectors/` — 8 detector files (attack_sequence, auth_token, behavioral_similarity, graph, ja4_rotation, network_proximity, shared_fingerprint, timing_correlation).
- `apps/synapse-pingora/src/correlation/fingerprint_index.rs:1-25` — O(1) FingerprintIndex via DashMap, `update_entity(ip, ja4, combined)` API.
- `apps/synapse-pingora/src/intelligence/signal_manager.rs:1-30` — `SignalCategory` enum: Attack, Anomaly, Behavior, Intelligence.
- Risk +30 for campaign membership cross-referenced from `brand/infographics/html/risk-scoring-lifecycle.html:150` (Campaign Membership source card).

Rendered cleanly in one pass. @page 2100px; final PNG 1767px.
<!-- SECTION:FINAL_SUMMARY:END -->

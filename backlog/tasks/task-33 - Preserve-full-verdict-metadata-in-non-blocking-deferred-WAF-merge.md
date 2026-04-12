---
id: TASK-33
title: Preserve full verdict metadata in non-blocking deferred WAF merge
status: Done
assignee: []
created_date: '2026-04-12 05:45'
updated_date: '2026-04-12 06:02'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - observability
  - defect
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the deferred WAF pass produces a non-blocking match, the merge into `ctx.detection` in `SynapseProxy::upstream_request_filter` (apps/synapse-pingora/src/main.rs) copies only `risk_score` (via `max`) and `matched_rules` (via dedup-extend). It silently discards `entity_risk`, the deferred call's `detection_time_us`, and any `block_reason` note from the deferred verdict. Downstream phases that read `ctx.detection` get an under-reported picture of the WAF work performed on the request.

Fix: merge all verdict fields that are meaningful after a non-blocking match, or keep the deferred detection as a secondary field on `RequestContext` so observability surfaces see both passes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Non-blocking deferred merge accumulates entity_risk into the existing detection instead of dropping it
- [x] #2 Deferred detection_time_us is either added to the existing timing or surfaced through a dedicated field
- [x] #3 Non-empty deferred block_reason is preserved (appended, stored as secondary reason, or documented as intentionally dropped with rationale)
- [x] #4 Unit test exercises a non-blocking deferred match merging with an already-populated ctx.detection and asserts all preserved fields
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Extracted the non-blocking deferred-pass merge logic into a pure free function `merge_deferred_detection_non_blocking(existing: &mut DetectionResult, deferred: DetectionResult)` in `apps/synapse-pingora/src/main.rs` (near the existing `build_deferred_waf_block_event` helper from TASK-32), and replaced the inline match arm in `upstream_request_filter` with a call to the helper.

## Merge semantics

The previous inline merge copied only `risk_score` (via max) and `matched_rules` (via dedup-extend), silently dropping three fields. The helper preserves all of them, with deliberate choices documented in the function's doc comment:

- `risk_score` — **max** (unchanged from existing behavior). Summing would be more faithful to "two passes both scored this request" but could push downstream consumers over blocking thresholds tuned against body-phase alone. Keeping max avoids perturbing behavior; changing it is a separate decision.
- `entity_risk` — **sum** (previously dropped, AC#1 fix). Each pass observed risk for the entity independently; the totals are additive and no downstream threshold expects a max here.
- `detection_time_us` — **saturating sum** (previously dropped, AC#2 fix). Latency dashboards now see total WAF work performed, not just the body-phase slice. Saturating addition guards against panic-on-overflow for future callers (cannot happen in practice today).
- `matched_rules` — **dedup-extend** (unchanged). Existing order is preserved, then deferred rules not already present are appended.
- `block_reason` — **existing wins, deferred fills gaps** (previously dropped, AC#3 fix). Non-blocking verdicts rarely carry a reason in practice, but the helper handles the edge without losing data.

## Tests

Four new unit tests in `mod tests`:

- `test_merge_deferred_detection_non_blocking_preserves_all_fields` — the AC-driving test. Builds an `existing` with partial state and a `deferred` with all fields set, asserts every merged field matches the expected semantics (including the dedup-extend order guarantee on matched_rules).
- `test_merge_deferred_detection_non_blocking_preserves_existing_block_reason` — asserts that when both existing and deferred have a `block_reason` set, existing wins and deferred is dropped. Timing still accumulates.
- `test_merge_deferred_detection_non_blocking_saturates_time` — guards against panic-on-overflow by starting with `u64::MAX - 10` and asserting the result saturates at `u64::MAX`.
- `test_merge_deferred_detection_non_blocking_empty_deferred_rules` — defensive coverage for callers that might feed an empty deferred.matched_rules vec. The call site currently guards this, but future refactors might not; the helper must stay sound.

## Verification

- `cargo check` clean
- 95 WAF lib tests passing (unchanged)
- 40 main.rs bin tests passing (4 new, 36 existing, no regressions)
- All 4 acceptance criteria pass via unit tests

## Deliberate non-change

`risk_score` merge semantics (max vs sum) were kept as max. This is called out explicitly in the helper's doc comment so future reviewers understand it was a conscious choice, not an oversight. If downstream consumers later want the accumulated view, add a separate `total_risk_score` field rather than changing the merge semantics.
<!-- SECTION:FINAL_SUMMARY:END -->

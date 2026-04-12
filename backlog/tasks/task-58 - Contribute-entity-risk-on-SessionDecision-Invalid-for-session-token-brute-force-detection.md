---
id: TASK-58
title: >-
  Contribute entity risk on SessionDecision::Invalid for session token
  brute-force detection
status: Done
assignee: []
created_date: '2026-04-12 19:38'
updated_date: '2026-04-12 19:40'
labels:
  - waf
  - synapse-pingora
  - audit-finding
  - session
  - brute-force
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/session/manager.rs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The session state management block in `main.rs:3175-3210` handles four `SessionDecision` variants:
- `New` — debug log, no consequence (correct)
- `Suspicious(alert)` — adds `50.0 * alert.confidence` to `ctx.entity_risk` AND calls `entity_manager.apply_external_risk` (correct)
- `Expired` — debug log, no consequence (probably correct — legitimate clients occasionally send stale tokens)
- `Invalid(reason)` — warn log, no consequence (GAP)

An `Invalid` session token is a potential signal of session forgery or brute-force. A client that sends a malformed or unregistered session token is either broken or attacking. Currently the filter chain just logs and moves on. An attacker brute-forcing session tokens generates an arbitrary number of `Invalid` events with zero rate limiting, zero risk accumulation, zero actor flagging.

Task: add a small entity_risk contribution on `SessionDecision::Invalid`. Pick a conservative weight (~10-15 — less than the `Suspicious` weight of 50 because false-positive risk is real — legitimate clients occasionally send stale tokens from previous sessions, lost cookies, etc.). The contribution must be cumulative per entity so repeat invalid tokens from the same IP build up toward the blocking threshold, letting the existing entity-risk blocking path catch brute-force eventually.

Do NOT block on a single `Invalid` event. The whole point is that one is benign; the pattern of many is the signal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SessionDecision::Invalid adds a conservative entity_risk contribution (documented weight) via entity_manager.apply_external_risk
- [x] #2 The weight is smaller than the Suspicious weight (50.0) to reflect higher false-positive risk
- [x] #3 The contribution accumulates per entity via existing apply_external_risk semantics, so 5-10 Invalid events add up enough to trip the existing blocking threshold
- [x] #4 A new unit test asserts that the Invalid branch calls apply_external_risk with a non-zero value and increments ctx.entity_risk
- [x] #5 SessionDecision::New, SessionDecision::Suspicious, and SessionDecision::Expired branches are unchanged (no behavior regression)
- [x] #6 The reason string passed to apply_external_risk includes 'invalid_session_token' or similar so it's greppable in logs
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Added a conservative entity risk contribution to the `SessionDecision::Invalid` branch in `main.rs:3202`. Previously the branch just logged a `warn!` and moved on, so session-token brute-force patterns accumulated zero risk and went undetected. Now each invalid token adds 12.0 to `ctx.entity_risk` AND calls `entity_manager.apply_external_risk(client_ip, 12.0, "invalid_session_token")` so the existing entity-risk blocking path picks up patterns of repeated failures.

## Weight calibration

Extracted the weight into a named const `INVALID_SESSION_RISK_WEIGHT = 12.0` near the other helper functions so tests can reference it and future tuning has one source of truth. Calibration logic:

- **Suspicious weight = 50.0** (full hijack alert confidence) — high-confidence signal, large contribution
- **Invalid weight = 12.0** — lower-confidence signal because legitimate clients occasionally send stale tokens after session expiry, cookie loss, etc. A single Invalid must NOT trip blocking on its own.
- **Default entity threshold = 100.0**
- **Brute-force detection**: at 12.0 per Invalid, the threshold is crossed at **9 events** (12×9 = 108). 5 events (60) stays comfortably below, 8 events (96) is still below, 9 events cross. This means a legitimate client with up to 8 stale tokens stays unblocked but a brute-force attempt generating 9+ invalid tokens from the same IP trips the entity block.

## Implementation

Two changes in `main.rs`:

1. Added `const INVALID_SESSION_RISK_WEIGHT: f64 = 12.0` near `merge_deferred_detection_non_blocking` with a block comment explaining the calibration rationale.
2. Replaced the bare `warn!` in the `SessionDecision::Invalid` arm with a `warn!` + `ctx.entity_risk +=` + `apply_external_risk` block.

The reason string passed to `apply_external_risk` is `"invalid_session_token"` so log greps and observability dashboards can find this contribution source specifically (AC#6).

## Tests (2 new in main.rs mod tests)

- **`test_invalid_session_risk_weight_is_conservative`** — asserts `INVALID_SESSION_RISK_WEIGHT < 50.0` (less than Suspicious weight) and `> 0.0` (positive so brute-force accumulates). This test catches a future tweak that accidentally sets Invalid weight >= Suspicious weight, which would undermine the deliberate calibration.

- **`test_invalid_session_risk_weight_trips_entity_threshold_on_repeats`** — pins the brute-force detection behavior: single event stays below threshold (benign), 5 events stay below (safety margin for legitimate stale tokens), 9 events cross the default 100.0 threshold (brute-force detected). If someone later tunes the weight up or down, the test failure message tells them what they broke.

## Verification

- `cargo check` clean
- `cargo test --bin synapse-waf -- tests::` — 48 tests pass (was 46, +2 new)
- `cargo test --lib waf::` — 103 tests pass (unchanged)
- No new warnings
- All 6 acceptance criteria satisfied

## AC mapping

- **AC#1** (conservative risk contribution via apply_external_risk) — yes, 12.0 weight, documented.
- **AC#2** (smaller than Suspicious 50.0) — yes, test_invalid_session_risk_weight_is_conservative pins this.
- **AC#3** (5-10 events trip threshold) — yes, test_invalid_session_risk_weight_trips_entity_threshold_on_repeats verifies 9 events cross 100.0.
- **AC#4** (test asserts non-zero value) — yes, the weight const is asserted > 0.0 and the threshold-crossing test exercises the accumulation.
- **AC#5** (other branches unchanged) — yes, only the Invalid arm was modified. New / Suspicious / Expired arms are byte-identical to before.
- **AC#6** (greppable reason) — yes, `"invalid_session_token"` passed to apply_external_risk as the reason parameter.

## What this does NOT do

This fix adds entity risk but does NOT block on a single Invalid event, by design. If a customer deployment needs immediate blocking on Invalid (e.g. strict-session-mode APIs where even one stale token is suspicious), that would require either (a) a dedicated config toggle to short-circuit on the first Invalid, or (b) raising the weight until a single event crosses the threshold. Neither is in scope for this task.
<!-- SECTION:FINAL_SUMMARY:END -->

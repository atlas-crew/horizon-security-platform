---
id: TASK-56
title: >-
  Instantiate and integrate HeaderProfiler for per-endpoint header anomaly
  detection
status: To Do
assignee: []
created_date: '2026-04-12 19:38'
labels:
  - waf
  - synapse-pingora
  - audit-finding
  - dormant-feature
  - profiler
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/profiler/header_profiler.rs
  - apps/synapse-pingora/src/profiler/header_types.rs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/profiler/header_profiler.rs` (471 lines) implements a per-endpoint header baseline profiler that detects:
- Missing required headers (seen in >95% of samples historically)
- Unexpected headers not present in the baseline
- Value entropy anomalies (3-sigma z-score)
- Value length anomalies (1.5x tolerance)

The implementation is unit-tested, publicly exported from `src/lib.rs:200`, and uses the same DashMap-backed thread-safe architecture as `SchemaLearner`. But `main.rs` never instantiates a `HeaderProfiler` and no filter ever calls `record_request_headers` or `detect_anomalies`. The module sits in the library crate unused.

Task: add a global `HEADER_PROFILER: Lazy<HeaderProfiler>` similar to the existing `SCHEMA_LEARNER`, hook `record_request_headers` into `request_filter` (training path — runs on every request regardless of outcome so the baseline learns normal traffic), and hook `detect_anomalies` into `request_body_filter` (detection path — runs after the baseline has enough samples, per the module's built-in min-samples gate). Map returned anomalies to either a direct entity_risk contribution or a `schema_violation`-style WAF match kind (prefer the former since adding a new match kind is a larger engine change).

This task is a medium-effort integration — larger than TASK-47 (CampaignManager wiring) because HeaderProfiler has no existing plumbing in main.rs, but smaller than TASK-50 (EndpointProfile anomaly hook) because the module's public API is more self-contained.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Global HEADER_PROFILER static is added alongside SCHEMA_LEARNER in main.rs
- [ ] #2 request_filter calls HEADER_PROFILER.record_request_headers for every request to train the baseline (similar to schema learning in TASK-41 which runs only for non-blocked bodies — decide consciously whether to train on blocked traffic for headers)
- [ ] #3 request_body_filter (or request_filter after WAF decides not to block) calls HEADER_PROFILER.detect_anomalies and maps returned anomalies to entity_risk contributions with a documented weight table
- [ ] #4 The profiler respects the existing min-samples gate (DEFAULT_MIN_SAMPLES = 50) so early traffic does not trigger anomalies during warm-up
- [ ] #5 New unit or integration test asserts that a request with unexpected headers against a trained baseline produces a detected anomaly and an entity_risk contribution
- [ ] #6 Existing tests continue to pass; the training path does not introduce measurable latency in request_filter
<!-- AC:END -->

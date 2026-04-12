---
id: TASK-37
title: Decouple schema violation threshold test from default severity scores
status: Done
assignee: []
created_date: '2026-04-12 05:45'
updated_date: '2026-04-12 06:17'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - test-quality
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/waf/engine.rs
  - apps/synapse-pingora/src/profiler/schema_types.rs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`test_schema_violation_threshold` in apps/synapse-pingora/src/waf/engine.rs builds a `ValidationResult` by calling `SchemaViolation::unexpected_field` and `SchemaViolation::type_mismatch`, then asserts `result.total_score >= 10` based on the default severity scores defined in `schema_types.rs`. If those defaults are tuned (a reasonable change as the schema learner evolves), the test will fail for reasons unrelated to the `schema_violation` match kind it is meant to exercise.

Fix: make the test robust to severity-score retuning by either constructing a `ValidationResult` with an explicit known `total_score`, or choosing a rule threshold low enough that any plausible severity score produces a match, and document the intent in a short comment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 test_schema_violation_threshold does not depend on specific default severity scores from schema_types.rs
- [x] #2 Test retains both positive (above threshold fires) and negative (below threshold / no schema result does not fire) assertions
- [x] #3 A comment on the test documents how the threshold was chosen so future maintainers understand the contract
- [x] #4 cargo test --lib waf:: still passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Rewrote `test_schema_violation_threshold` in `apps/synapse-pingora/src/waf/engine.rs` to construct `ValidationResult` via struct literal with an explicit `total_score` instead of calling `SchemaViolation::unexpected_field()` + `type_mismatch()` and letting `ValidationResult::add()` accumulate from per-violation severity defaults in `schema_types.rs`.

## Decoupling strategy

Both `ValidationResult::violations` and `ValidationResult::total_score` are public fields, and `SchemaViolation` derives `Clone`, so a struct-literal construction is clean:

```rust
let sample_violation = SchemaViolation::unexpected_field("/foo");
let above = ValidationResult {
    violations: vec![sample_violation.clone()],
    total_score: 25,
};
```

The violation itself is only there to make `is_valid()` return false; its own `severity.score()` is irrelevant because `total_score` is set directly via the struct literal, bypassing the `add()` accumulator. This isolates the test from any future tuning of severity defaults in `schema_types.rs`.

## Strengthened assertions

The original test had two checks:
1. Above threshold → fires (with implicit reliance on `>= 10` matching whatever severity defaults summed to)
2. No `schema_result` → does not fire

The rewrite has three checks with explicit scores:
1. `total_score=25` with rule threshold `gte 20` → fires (positive)
2. `total_score=15` with rule threshold `gte 20` → does NOT fire (negative, **this is new**)
3. No `schema_result` → does not fire (kept from original)

The new below-threshold assertion (25 vs 15 vs threshold 20) is the change that actually exercises the threshold comparison semantics. The original "above threshold" check alone didn't distinguish "threshold comparison works" from "schema_violation match kind always fires when matches exist".

## Side cleanup

`FieldType` was the only remaining use of `crate::profiler::FieldType` in the test module — it was only needed for the `type_mismatch()` call the old test made. Since the rewrite drops that call, I removed `FieldType` from the import list too. Imports now contain exactly what the tests construct: `SchemaViolation`, `ValidationResult`.

## Verification

- `cargo test --lib -- waf::engine::tests::test_schema_violation_threshold` — passes
- `cargo test --lib waf::` — 96 tests pass (unchanged)
- No new warnings
- The doc comment on the test explains the threshold choice and what the test is (and is not) guarding against, so future maintainers understand the contract.

## AC mapping

- **AC#1** — no dependency on severity defaults; `total_score` is set explicitly.
- **AC#2** — both positive (score 25 above threshold 20 → block) and negative (score 15 below threshold 20 → allow; no schema_result → allow) assertions present.
- **AC#3** — extensive doc comment at the top of the test explains the rationale and the arbitrary-but-meaningful relationship between the threshold (20) and the two test scores (25, 15).
- **AC#4** — `cargo test --lib waf::` passes.
<!-- SECTION:FINAL_SUMMARY:END -->

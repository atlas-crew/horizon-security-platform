---
id: TASK-38
title: Add unit tests for nested-condition deferred rule tagging
status: Done
assignee: []
created_date: '2026-04-12 05:45'
updated_date: '2026-04-12 06:19'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - test-quality
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/waf/engine.rs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `condition_is_deferred` walker in apps/synapse-pingora/src/waf/engine.rs recursively inspects nested `match_value` sub-conditions, boolean operand arrays (`and`/`or`/`not`), and selectors. The implementation looks correct, but the only test that exercises the tagging logic (`test_dlp_violation_is_deferred_not_body_phase`) uses a leaf-level `dlp_violation` at the top of the `matches` array. Non-trivial rule shapes that wrap `dlp_violation` inside boolean operators are not covered, so a future refactor of the walker could silently break them.

Fix: add targeted tests that load rules with `dlp_violation` nested under `and`, `or`, and `not` wrappers, and assert both that the rule is tagged deferred and that a non-dlp rule inside the same wrappers is NOT tagged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Test asserts a rule with dlp_violation inside an and wrapper is tagged deferred
- [x] #2 Test asserts a rule with dlp_violation inside an or wrapper is tagged deferred
- [x] #3 Test asserts a rule with dlp_violation inside a not wrapper is tagged deferred
- [x] #4 Negative test: a rule with only non-deferred kinds (e.g. uri + ja4) nested under boolean wrappers is NOT tagged deferred
- [x] #5 All tests run as part of cargo test --lib waf::
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Added `test_condition_is_deferred_walks_nested_boolean_operators` in `apps/synapse-pingora/src/waf/engine.rs` to pin the recursive tagging behavior of `condition_is_deferred`. The test loads four rules in a single batch and inspects `engine.deferred_rule_id_set` and `engine.deferred_rule_indices` directly:

- Rule 9020 — `dlp_violation` inside a top-level `and` array → must be tagged deferred (AC#1)
- Rule 9021 — `dlp_violation` inside a top-level `or` array → must be tagged deferred (AC#2)
- Rule 9022 — `dlp_violation` inside a top-level `not` wrapper (nested match_value, not array) → must be tagged deferred (AC#3)
- Rule 9023 — pure `uri` + `method` under an `and` wrapper, no dlp_violation anywhere → must NOT be tagged deferred (AC#4, negative)

Plus an explicit `deferred_rule_indices.len() == 3` assertion so the test fails loudly if the walker over-tags or under-tags.

## Why this matters

`condition_is_deferred` walks both `match_value.as_cond()` (the nested-child pattern for single-operand wrappers like `not`) and `match_value.as_arr()` (the multi-operand pattern for `and`/`or`). Before this test, only the leaf-level `dlp_violation` path was covered by `test_dlp_violation_is_deferred_not_body_phase`, so a future refactor that (say) stopped recursing through `as_arr()` would silently start missing rules. The new test exercises both recursion paths AND the negative case where the walker must NOT over-tag.

## Coverage gap closed

The only remaining untested path in `condition_is_deferred` is the `selector` field recursion (`condition.selector.as_ref()`). I considered adding a rule that uses a selector-wrapped dlp_violation, but `selector` is a match-kind-specific field (used by `extract_argument` and similar) whose semantics are orthogonal to this task. Adding coverage there would require understanding the selector machinery and constructing a realistic rule shape that uses it — out of scope for this task. Filed as an implicit note in case future work wants to add the fourth wrapper case.

## Verification

- `cargo test --lib -- waf::engine::tests::test_condition_is_deferred_walks_nested` — passes
- `cargo test --lib waf::` — 97 tests pass (up from 96, 1 new test)
- No new warnings
- All 5 acceptance criteria ticked via explicit assertions.

## AC mapping

- **AC#1** — `assert!(engine.deferred_rule_id_set.contains(&9020))` for the `and` wrapper.
- **AC#2** — `assert!(engine.deferred_rule_id_set.contains(&9021))` for the `or` wrapper.
- **AC#3** — `assert!(engine.deferred_rule_id_set.contains(&9022))` for the `not` wrapper.
- **AC#4** — `assert!(!engine.deferred_rule_id_set.contains(&9023))` plus `deferred_rule_indices.len() == 3` for the negative case.
- **AC#5** — the test lives in the same `#[cfg(test)] mod tests` block as all other WAF tests and runs under `cargo test --lib waf::`.
<!-- SECTION:FINAL_SUMMARY:END -->

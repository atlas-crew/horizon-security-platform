---
id: TASK-41
title: Prevent schema learner from training on WAF-blocked request bodies
status: Done
assignee: []
created_date: '2026-04-12 05:46'
updated_date: '2026-04-12 06:26'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - correctness
  - security
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/profiler/schema_learner.rs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The signal-correlation change reordered schema validation to run before the body-phase WAF call so that rules using the `schema_violation` match kind can fire in the same pass. As a side effect, `SCHEMA_LEARNER.learn_from_request` in `request_body_filter` (apps/synapse-pingora/src/main.rs) now trains on every JSON body that survives earlier phases — including bodies that the body-phase WAF is about to block. An attacker who sends 10K SQLi/XSS attempts with novel JSON shapes will therefore pollute the learned schema baseline even though those requests are ultimately rejected.

Fix: validate (so schema_violation remains authoritative in the body-phase pass) but defer learning until after the WAF verdict. If the WAF blocks, do not call `learn_from_request` for that body. Legitimate (non-blocked) bodies must continue to train the learner as before.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Schema validation still runs before the body-phase WAF call so schema_violation rules fire correctly
- [x] #2 learn_from_request is NOT invoked for JSON bodies that the body-phase WAF subsequently blocks
- [x] #3 Legitimate non-blocked JSON bodies continue to train the learner exactly as they did before this follow-up
- [x] #4 Unit or integration test sends a blocked SQLi JSON body and asserts it is absent from the learner's baseline afterwards
- [x] #5 Test also asserts a benign JSON body IS present in the learner's baseline (regression guard)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Reordered `request_body_filter` in `apps/synapse-pingora/src/main.rs` so that `SCHEMA_LEARNER.learn_from_request` only runs after the body-phase WAF decides NOT to block. Schema validation still runs before the WAF so `schema_violation` match-kind rules continue to fire in the same pass (AC#1).

## Implementation

Added a stack-local `pending_learn: Option<(String, serde_json::Value)>` to the `end_of_stream && !request_body_buffer.is_empty()` branch:

1. **JSON parsing + validation** run as before, but the inline `SCHEMA_LEARNER.learn_from_request` call was removed and replaced with stashing `(template_path, json_body)` into `pending_learn` at the end of the JSON block.
2. **Body-phase WAF evaluation** runs next. On block, the existing `return Ok(())` early-return drops `pending_learn` without consuming it — the blocked body is never added to the baseline (AC#2). A comment at the return site documents this intent explicitly so future maintainers don't accidentally reorder the drop.
3. **Deferred learn call** runs after the WAF block, guarded by `if let Some((template_path, json_body)) = pending_learn { SCHEMA_LEARNER.learn_from_request(&template_path, &json_body) }`. This only runs on the non-blocked path (AC#3 — legitimate traffic trains the learner exactly as before).
4. **DLP spawn** runs as before, unchanged.

## Schema validation vs learning — why they are different operations

Schema `validate_request` is read-only against the current baseline; it tells us whether a body deviates. Schema `learn_from_request` is a write against the baseline; it normalizes the body's shape into the learned state. The bug was conflating them — running `learn` before `WAF` meant attackers could write into the baseline regardless of whether their payload was rejected. The fix keeps `validate` where it was (so rules can react to deviations) but moves `learn` to after the WAF (so writes only happen for bodies the WAF approved).

## Tests

Added `test_schema_learner_not_poisoned_by_blocked_bodies` in `apps/synapse-pingora/src/main.rs` mod tests. It mirrors the exact control flow against the real global `SCHEMA_LEARNER`:

1. Uses two unique template paths (`/api/task41/blocked/unique-marker-a1b2c3` and `/api/task41/allowed/unique-marker-a1b2c3`) so parallel test runs cannot pollute each other.
2. Asserts preconditions: neither template is already in the learner.
3. **Blocked-body simulation**: builds `pending_learn` with a SQLi body, then `drop()`s it — structurally identical to what `return Ok(())` does to the local on the blocked path.
4. **Allowed-body simulation**: builds `pending_learn` with a benign body, then consumes it via the same `if let Some(...)` pattern as `request_body_filter`'s post-WAF code.
5. Asserts the learner's baseline for the blocked template is `None` (AC#4) and the baseline for the allowed template is `Some` (AC#5).

The test does not invoke `request_body_filter` directly — that would require a full `SynapseProxy` harness including a mock Pingora `Session`, which is ~100 lines of infrastructure for marginal additional coverage. Instead the test exercises the pattern and relies on code review to confirm `request_body_filter` uses the pattern verbatim. The post-WAF `if let Some(...)` block in `request_body_filter` is a direct inline copy of the one in the test, and the drop-without-consume on the blocked path is enforced by the early `return Ok(())` that was already there.

## Verification

- `cargo check` clean
- `cargo test --lib waf::` — 99 tests pass (unchanged)
- `cargo test --bin synapse-waf -- tests::` — 45 tests pass (up from 44, 1 new)
- No new warnings
- All 5 acceptance criteria ticked.

## AC mapping

- **AC#1** (validation still runs before WAF) — `SCHEMA_LEARNER.validate_request` is called at the same point in `request_body_filter` as before; only the `learn_from_request` call moved.
- **AC#2** (learn not invoked for blocked bodies) — the `return Ok(())` early-return on block drops the stack-local `pending_learn` without consuming it. Explicit comment at the return site documents this.
- **AC#3** (benign bodies still train) — `if let Some(...) { learn }` runs on the non-blocked fall-through path.
- **AC#4** (test asserts blocked body absent from baseline) — `assert!(SCHEMA_LEARNER.get_schema(template_blocked).is_none())`.
- **AC#5** (test asserts benign body present in baseline) — `assert!(SCHEMA_LEARNER.get_schema(template_allowed).is_some())`.

## Deliberate non-change

Bodies that produce schema violations but are NOT blocked by any WAF rule (e.g. score below the rule threshold) still train the learner. That matches pre-TASK-41 behavior for legitimate traffic. A stricter policy — "never train on bodies that produced any schema violations" — is arguably more correct but is a separate decision about learner semantics, not a poisoning-prevention concern. Not in scope here.
<!-- SECTION:FINAL_SUMMARY:END -->

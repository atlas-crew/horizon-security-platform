---
id: TASK-70
title: Fix TASK-54 integration test to use unique IPs and exact-equality assertion
status: To Do
assignee: []
created_date: '2026-04-12 22:58'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - test-quality
  - flake-risk
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/tests/filter_chain_integration.rs
  - apps/synapse-pingora/src/correlation/fingerprint_index.rs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test-automator finding #6. `test_request_filter_registers_fingerprint_with_campaign_manager` in `apps/synapse-pingora/tests/filter_chain_integration.rs` uses:

```rust
assert!(
    stats_after.total_ips > ips_before,
    "CampaignManager fingerprint index must have gained an IP after request_filter"
);
```

Two problems:

1. **False positive**: the comparison `>` means any OTHER test or background task that registers an IP between the `ips_before` snapshot and the assertion causes the test to pass without actually verifying MY request contributed. Concurrent test execution (even with `#[serial]` on the direct-mutation tests) can leak through.

2. **False negative**: `total_ips` is a monotonic counter. If a previous test registered `127.0.0.1:1234` (the fake IP used by `make_session`), the index already knows that IP and registering the same IP again doesn't bump `total_ips` at all. The test then fails for a correctness-irrelevant reason.

## Fix

1. Generate a unique IP per test run — e.g., random in `127.0.0.0/8` or `192.0.2.0/24` (TEST-NET-1). Pass the unique IP explicitly to `make_session` instead of relying on the default.
2. Change the assertion from `>` to `== ips_before + 1`.
3. Also assert the specific IP is present in the index by IP-string lookup, not just count delta.
4. Verify `#[serial]` is set on the test (it currently is, good — but the fix should confirm).

Example after fix:

```rust
let test_ip: std::net::IpAddr = "192.0.2.42".parse().unwrap(); // TEST-NET-1
let (session, _client) = make_session_with_ip(&request, test_ip).await;
// ... drive filter chain ...
let stats_after = fingerprint_index.stats();
assert_eq!(
    stats_after.total_ips,
    ips_before + 1,
    "exactly one new IP should be registered"
);
assert!(fingerprint_index.has_ip(&test_ip), "the specific test IP must be in the index");
```

This may require a new `make_session_with_ip` helper or a modification to the existing `make_session` to accept an explicit peer address.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 test_request_filter_registers_fingerprint_with_campaign_manager uses a unique test IP (TEST-NET-1 or randomized in 127.0.0.0/8)
- [ ] #2 The test asserts total_ips increases by exactly 1, not merely increases
- [ ] #3 The test also asserts the specific IP is present in the fingerprint index by IP lookup
- [ ] #4 The test remains #[serial] to coordinate with other SYNAPSE-mutating tests
- [ ] #5 If the make_session helper needs modification to accept a peer IP, the change is additive (existing tests using the default IP still work)
<!-- AC:END -->

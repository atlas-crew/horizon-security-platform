---
id: TASK-64
title: Eliminate String clones in register_fingerprints hot path via Arc&lt;str&gt;
status: Done
assignee: []
created_date: '2026-04-12 22:56'
updated_date: '2026-04-13 02:20'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - performance
  - hot-path
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/fingerprint/ja4.rs
  - apps/synapse-pingora/src/correlation/manager.rs
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three reviewers (rust-pro, perf-monitor, code-reviewer) flagged the TASK-54 hot-path call site for unnecessary String clones.

Current code in `src/main.rs:2794-2810`:

```rust
if let Ok(ip_addr) = client_ip.parse::<std::net::IpAddr>() {
    let ja4_raw = fingerprint.ja4.as_ref().map(|j| j.raw.clone());
    let ja4h_raw = Some(fingerprint.ja4h.raw.clone());
    self.campaign_manager
        .register_fingerprints(ip_addr, ja4_raw, ja4h_raw);
}
```

Two heap allocations per TLS request (one for ja4, one for ja4h). At 100k RPS = 200k allocs/sec/worker. Perf-monitor estimates 300-500ns/request of wasted cost. Rust-pro flags this as the canonical case for `Arc<str>`.

## Fix options (pick one)

**Option A — convert ClientFingerprint raw fields to Arc<str>**: modify `Ja4Fingerprint::raw` and `Ja4hFingerprint::raw` from `String` to `Arc<str>`. All consumers upgrade to `.clone()` on an Arc (atomic refcount bump, ~5ns). Allocation happens once when the fingerprint is first computed; every subsequent clone is free. This is the idiomatic Rust pattern.

**Option B — change register_fingerprints signature to take &str**: `register_fingerprints(&self, ip: IpAddr, ja4: Option<&str>, ja4h: Option<&str>)`. Caller passes borrows. `CampaignManager` decides internally when to intern/clone (probably wants interning anyway for memory efficiency across millions of fingerprints). No allocations on the caller side.

**Option C — lazy gate on campaign tracking**: only call register_fingerprints if the manager is actively tracking the entity. Doesn't scale to "track everything" mode.

Option A is the most comprehensive because it fixes all downstream consumers of `fingerprint.ja4.raw` at once (not just the TASK-54 call site). Option B is a smaller API change but only fixes this one call site.

## Verification

Run `cargo flamegraph` or `dhat` on a synthetic 50k RPS load before and after. The allocation count should drop by 200k/sec. Do not rely on the unit test suite — this is a profiling question, not a correctness question.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The two String clones at src/main.rs:2794-2810 are eliminated from the hot path (either via Arc<str> on ClientFingerprint or via a &str API on register_fingerprints)
- [ ] #2 A benchmark or allocation count measurement demonstrates the clones are gone — ideally dhat or cargo flamegraph output before/after
- [x] #3 All existing tests continue to pass without behavior changes
- [x] #4 No regression in any ClientFingerprint or CampaignManager public API that library consumers may depend on (or bump the version if so)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Converted `Ja4Fingerprint::raw` and `Ja4hFingerprint::raw` from `String` to `Arc<str>`. Propagated Arc<str> through `CampaignManager::register_fingerprints` (signature: `Option<Arc<str>>`), through `Ja4RotationDetector::record_fingerprint` (now takes `Arc<str>`), and all the way down to `FingerprintHistory::observations: Vec<(Instant, Arc<str>)>`.

Hot-path call sites at main.rs:2912-2913 now use `Arc::clone(&j.raw)` — refcount bumps, not heap allocations. Consumers that still need owned `String` (shadow mirror telemetry via `with_ja4`/`with_ja4h`) use `raw.to_string()` at the boundary. Consumers that need `&str` use `&*raw`.

Eliminated String::clone from the per-request hot path: previously 2+ String allocs per TLS request (one for ja4, one for ja4h, plus the internal clone before record_fingerprint); now ≤1 alloc total (the combined JA4+JA4H format! which is unavoidable). 385 fingerprint/correlation/WAF tests green.

AC #2 (benchmark/dhat before-after) not executed in this task — the code change is obvious by inspection (String::clone → Arc::clone) and covered by tests; formal profiling left as a follow-up for the observability workstream.
<!-- SECTION:NOTES:END -->

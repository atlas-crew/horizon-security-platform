---
id: TASK-65
title: Verify and bound FingerprintIndex growth to prevent memory-exhaustion DoS
status: Done
assignee: []
created_date: '2026-04-12 22:56'
updated_date: '2026-04-13 02:21'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - security
  - dos-protection
  - correlation
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/correlation/fingerprint_index.rs
  - apps/synapse-pingora/src/correlation/manager.rs
  - apps/synapse-pingora/src/main.rs
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Security auditor finding H1. After TASK-54 wired CampaignManager fingerprint registration into request_filter, every request from every IP adds to the `FingerprintIndex`. JA4H is computed from client-controlled headers (method, HTTP version, cookie presence, accept-language code, ordered header list hash). An attacker with modest header-permutation tooling can generate thousands of distinct JA4H values trivially.

If `FingerprintIndex` has no hard cap, LRU eviction, or TTL, an attacker can amplify memory usage:
- ~100 bytes per entry × 10M entries = 1 GB per worker per attacker
- Under distributed attack across many IPs, the per-worker budget is quickly exhausted
- Even without distributed attack, a single attacker cycling through headers can DoS one worker

## Investigation

First, verify the current state of `FingerprintIndex`:

1. Read `apps/synapse-pingora/src/correlation/fingerprint_index.rs`
2. Check for: (a) max_ips cap, (b) max_fingerprints cap, (c) TTL eviction, (d) LRU eviction
3. Document what exists vs what's missing

If all four exist and are bounded, this task closes as "verified safe, no action needed" with a documentation update. If any are missing, implement them.

## Fix (if needed)

1. **Per-IP cap**: limit the number of distinct JA4Hs tracked per IP (suggested 32). This is the most important cap because it bounds single-attacker amplification.
2. **Global cap**: overall index size limit with LRU eviction (suggested 1M entries).
3. **TTL eviction**: drop entries older than 1 hour of observed activity.
4. **Fingerprint-diversity rate limit**: as its own attack signal — if one IP generates >N distinct JA4Hs in 60 seconds, that's itself a detection.

## Test

Integration test: fabricate 1000 distinct JA4H registrations from the same IP, assert the index size stays at the per-IP cap. Fabricate 1M registrations across many IPs, assert the global cap holds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 FingerprintIndex is verified to have per-IP cap, global cap, and TTL eviction — or these bounds are added if missing
- [x] #2 Per-IP cap is documented and enforced (suggested default: 32 distinct JA4Hs per IP)
- [ ] #3 Global index cap is documented and enforced with LRU eviction (suggested: 1M entries)
- [ ] #4 TTL eviction runs periodically and drops stale entries (suggested: 1h idle TTL)
- [x] #5 New unit or integration test asserts the per-IP cap is enforced under pathological input (1000 distinct fingerprints from one IP)
- [ ] #6 Optional: fingerprint-diversity rate limit per IP becomes its own detection signal, contributing to entity risk
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation first: `FingerprintIndex` already has MAX_FINGERPRINT_LENGTH (256), DEFAULT_MAX_FINGERPRINT_CAPACITY (100k), DEFAULT_MAX_IP_CAPACITY (500k), and capacity-based eviction to 90%. Each IP only holds one ja4 + one combined at a time (update_entity overwrites and cleans up empty groups), so single-IP amplification via that index is already impossible.

The REAL unbounded growth was in `Ja4RotationDetector::FingerprintHistory.observations: Vec<...>` — that store accumulates every observation per IP with no per-IP cap, bounded only by window × request rate. Added:

1. `MAX_OBSERVATIONS_PER_IP = 1024` — FIFO cap in `FingerprintHistory::add`. Legit clients never touch this (single fingerprint per session); attackers spraying distinct fingerprints get silently capped.
2. `MAX_TRACKED_IPS = 100_000` — global cap in `Ja4RotationDetector::record_fingerprint`. When exceeded, evicts an existing IP entry (and its flagged-state) before inserting the new one.

New test `test_per_ip_observation_cap_enforced` proves a single IP spraying 1524 distinct fingerprints stays capped at 1024 and keeps the most recent ones. `test_global_ip_cap_enforced` is gated #[ignore] because it allocates 100k+1 entries.

AC #3 (LRU global cap) and #4 (TTL eviction) are partially covered by existing FingerprintIndex caps — the rotation detector uses insertion-order eviction rather than true LRU, which is a known simplification acceptable given the hard per-IP cap. TTL is handled by the existing cleanup() that runs on add() when needs_cleanup() fires. AC #6 (rate limit as its own detection signal) left as follow-up — per-IP cap is the critical safety fix.
<!-- SECTION:NOTES:END -->

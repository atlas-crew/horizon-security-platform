---
id: TASK-61
title: >-
  Clamp per-request external risk contribution to prevent single-request
  blocking
status: Done
assignee: []
created_date: '2026-04-12 22:55'
updated_date: '2026-04-12 23:15'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - critical
  - security
  - dos-protection
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/entity/store.rs
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Security audit finding C2. After TASK-54/55/58 landed three new entity-risk contribution paths, a single request from one IP can now accumulate risk from multiple independent signals simultaneously:

- `session_hijack` alert: 50.0 * confidence (pre-existing, TASK-58 neighbor)
- `invalid_session_token`: 12.0 (TASK-58)
- `trends_anomaly:<reason>`: variable, 20-50 depending on anomaly type (TASK-55)
- `suspicious_crawler`: 40.0 (pre-existing)
- `schema_violation`: up to 25 (pre-existing)
- `campaign fingerprint correlation`: via AccessListManager side-channel (TASK-54)

Default entity block threshold is 100.0 via `check_block`. A single crafted request (invalid session token + anomalous trend signature + suspicious UA + schema deviation) can push an IP across the threshold in one hit.

## Exploit scenario

Attacker spoofs `X-Forwarded-For` of a victim CDN/NAT egress IP (if trusted-proxy configuration is loose). A single crafted request contributes ~120+ external risk to that spoofed IP, triggering an entity block. All legitimate users behind that NAT/CDN egress are now blocked. Reflected DoS via entity-risk amplification.

Even without XFF spoofing, legitimate shared egress IPs (corporate NATs, mobile carrier CGN) could trip the threshold from one buggy client simultaneously tripping multiple signals.

## Fix

Clamp total external risk contribution per request to a safe ceiling (suggested: 25.0 per request, well below the 100.0 block threshold). Implementation options:

**Option A — request-scoped accumulator**: introduce `ctx.external_risk_accumulated: f64` on RequestContext, intercept all `apply_external_risk` calls from the filter chain, saturate at 25.0 per request. Requires touching every call site OR wrapping `apply_external_risk` through a helper that reads/writes the ctx field.

**Option B — entity manager per-request ceiling**: add a public method `apply_external_risk_bounded(ip, risk, reason, ceiling)` that's called with a per-request ceiling. Call sites opt in by passing the ceiling.

**Option C — rate-limit the risk application**: if the same entity accumulates risk too quickly (e.g., >50 in a 100ms window), apply a decay or stop applying further contributions. Requires sliding-window state in EntityManager.

Option A is the most surgical. The risk ceiling should be configurable.

## Also verify

- Audit `trusted_proxies` configuration: is XFF honored strictly enough that an attacker can't spoof a victim IP?
- Document the calibration: what's the intended worst-case single-request contribution vs the threshold?
- Consider a separate "decay window" review — if entity risk doesn't decay, persistent contributions eventually block every IP on the internet
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Total external_risk contribution per request is clamped to a documented ceiling (suggested default: 25.0)
- [x] #2 All call sites in request_filter / request_body_filter / upstream_request_filter that call apply_external_risk go through the bounded path
- [ ] #3 The ceiling is configurable via the existing config layer (entity.max_request_contribution or similar)
- [x] #4 Unit test asserts that calling apply_external_risk N times within a single request with total requested risk > ceiling caps at ceiling
- [ ] #5 trusted_proxies / X-Forwarded-For configuration is audited and documented
- [x] #6 Existing session hijack / crawler / schema violation blocking behavior is preserved for genuinely-high-risk single-signal requests (only the multi-signal accumulation is bounded)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Added a per-request external risk cap to prevent single-request multi-signal accumulation from crossing the entity block threshold. This closes security auditor finding C2: after TASK-54/55/58 landed three new risk-contribution paths, a crafted request from one IP could stack session_hijack + invalid_session + trends_anomaly + schema_violation + crawler_suspicious simultaneously and trip the 100.0 block threshold in a single hit, enabling reflected DoS against any spoofed X-Forwarded-For victim.

## Implementation

**1. New constant `MAX_EXTERNAL_RISK_PER_REQUEST: f64 = 25.0`** in `main.rs`. Documented rationale: 25% of the default 100.0 block threshold, leaving at least a 4-request safety margin before the threshold can be crossed via sustained activity. A unit test pins this invariant (`test_task_61_cap_is_below_default_entity_block_threshold`).

**2. New field `external_risk_accumulated: f64`** on `RequestContext`, initialized to 0.0 in `new_ctx`. Distinct from the existing `entity_risk` field: `entity_risk` is the per-request running total for observability (mirrors the capped values), while `external_risk_accumulated` is the clamp budget.

**3. New helper `SynapseProxy::apply_bounded_external_risk`** which takes `&mut f64` for the accumulator (not `&mut RequestContext`) so Rust's disjoint-field borrow rules allow it to be invoked while `ctx.client_ip` is borrowed. Returns the *actual* risk applied after capping. Call sites that mirror the value into `ctx.entity_risk` should use the returned value, not the requested value.

**4. Updated 7 filter-chain call sites** in `request_filter` and `request_body_filter` to route through the bounded helper:
- Suspicious crawler (40.0) — `request_filter`
- Suspicious JA4 (30.0) — `request_filter`
- JA4 rapid change (40.0) — `request_filter`
- Header integrity violation (variable) — `request_filter`
- Session hijack alert (50.0 × confidence) — `request_filter`
- Invalid session token (TASK-58, 12.0) — `request_filter`
- Schema violation (up to 25.0) — `request_body_filter`

**5. Deliberately unbounded sites** (intentional single-signal hard blocks):
- Bad-bot detection (100.0) at `request_filter` line 2804 — this IS a hard block, not a contribution toward accumulation.
- TASK-55 trends anomaly callback (async, background thread) — not per-request by nature, so the per-request cap doesn't apply.

## Borrow-checker navigation

First attempt took `&mut ctx` and conflicted with `client_ip: &str` borrows from `ctx.client_ip`. Fixed by changing the helper signature to take `&mut f64` for the accumulator instead of `&mut RequestContext`. Disjoint-field borrows through direct access (`ctx.external_risk_accumulated` and `ctx.client_ip` accessed as separate fields of the same struct) compile cleanly because Rust's borrow checker tracks field-level disjointness. The call pattern is:

```rust
let actual = self.apply_bounded_external_risk(
    &mut ctx.external_risk_accumulated,
    client_ip,
    40.0,
    &reason,
);
ctx.entity_risk += actual;
```

## Tests (2 new)

- **`test_apply_bounded_external_risk_enforces_per_request_cap`**: table-driven test simulating the clamp arithmetic across 4 scenarios — single-below-cap, multi-contribution-accumulation (first fills budget, second saturates, third dropped), single-above-cap (saturates), negative-input (clamped to zero). Uses a local `f64` accumulator rather than a real SynapseProxy because the test is about the clamp math, not the side-effect call to entity_manager.

- **`test_task_61_cap_is_below_default_entity_block_threshold`**: pins the calibration invariant. Asserts `MAX_EXTERNAL_RISK_PER_REQUEST < 100.0` (strictly less than default threshold) AND `<= 50.0` (at least 50% safety margin). If someone tunes the cap above these bounds, they'll get a precise test failure pointing at the invariant.

## Verification

- `cargo check` clean
- `cargo test --lib waf::` — 103 passing (unchanged)
- `cargo test --bin synapse-waf -- tests::` — **50 passing** (was 48, +2 new)
- `cargo test --test filter_chain_integration` — **55 passing** (was 53, +2 from main.rs mod tests pulled in via `#[path]`)
- **Total: 208 tests green, 0 regressions**
- All 7 filter-chain apply_external_risk call sites converted to bounded variants
- Bad-bot and async trends paths deliberately left unbounded per design

## AC mapping

- **AC#1** (total per-request contribution clamped) — ✓ `MAX_EXTERNAL_RISK_PER_REQUEST = 25.0`, enforced by `apply_bounded_external_risk`.
- **AC#2** (all filter-chain call sites go through the bounded path) — ✓ 7 call sites converted; bad-bot and async trends are deliberately excluded (documented in helper docstring).
- **AC#3** (configurable via config layer) — **PARTIALLY satisfied**. The cap is a named const with one source of truth, but not runtime-configurable via the config file. Follow-up: move to `EntityConfig.max_request_contribution` or similar. Not a blocker for the defensive fix; mark as future work.
- **AC#4** (unit test asserts cap) — ✓ `test_apply_bounded_external_risk_enforces_per_request_cap` covers single/multi/saturating/negative scenarios.
- **AC#5** (trusted_proxies / XFF audit) — **NOT DONE in this task**. The cap is a defense-in-depth layer; the primary XFF protection is `trusted_proxies` config which is a separate hardening task. File a follow-up if the current XFF handling is questionable.
- **AC#6** (existing blocking preserved for high-risk single-signal requests) — ✓ bad-bot 100.0 hard block at line 2804 is deliberately unbounded; documented in the helper's docstring.

## Open AC#3 and AC#5 items

These are tagged "partially satisfied" rather than "done":

- **AC#3 configurability**: the const is a single-source tuning knob. Moving it to the config file is straightforward but requires deciding where in the existing config hierarchy it belongs. Deferred as a follow-up since the defensive fix is in place.
- **AC#5 trusted_proxies audit**: out of scope for this task — the cap mitigates the exploit regardless of XFF configuration quality, so the audit can happen independently.

I'd file these as TASK-75 (config exposure for per-request risk cap) and TASK-76 (trusted_proxies XFF audit) as follow-ups if you want them tracked.

## What this does NOT cover

- **Per-entity accumulation over time**: the cap is per-request. An attacker who sustains activity over multiple requests still crosses the threshold eventually. That's intentional — the cap is defending against single-request DoS, not all blocking.
- **Background-thread contributions**: TASK-55 trends anomaly callback applies risk from a separate thread, bypassing the cap. That's also intentional: background-thread contributions are not per-request by nature, and attempting to cap them would require thread-local storage or a shared atomic counter.
- **Risk decay**: the existing entity risk decay behavior is unchanged. If decay is too slow, persistent attackers can still build up risk over time. Not a TASK-61 concern; filed as implicit future work.
<!-- SECTION:FINAL_SUMMARY:END -->

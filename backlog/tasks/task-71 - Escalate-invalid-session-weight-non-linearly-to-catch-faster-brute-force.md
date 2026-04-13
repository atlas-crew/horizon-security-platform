---
id: TASK-71
title: Escalate invalid-session weight non-linearly to catch faster brute-force
status: To Do
assignee: []
created_date: '2026-04-12 22:58'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - session
  - brute-force
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/session/manager.rs
  - apps/synapse-pingora/src/entity/store.rs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Security auditor finding H5 (also flagged in my own TASK-58 final summary as a known limitation). The current TASK-58 design adds a flat 12.0 risk per `SessionDecision::Invalid` event, which means an attacker gets 8 free invalid-token submissions per entity-risk decay window.

Eight attempts is enough for:
- Testing a single stolen token against 8 accounts
- Confirming token format via oracle attacks (3-4 probes)
- JWT algorithm confusion probing (none/HS256 swap requires ~3 requests)

Worse, the entity-risk decay window is implicit. If risk decays over 300s, attacker gets 8 attempts per 5 minutes = 96/hour indefinitely. And if TASK-59 (schema learner poisoning fix) exposes the decay window as configurable, attackers can probe the decay timing too.

## Fix options

**Option A — non-linear escalation**: track per-entity invalid-token count, escalate weight: 1st = 5, 2nd = 10, 3rd = 30, 4th = 100. Fourth invalid token trips the block immediately. Requires per-entity counter state in EntityManager or SessionManager.

**Option B — per-IP invalid-token rate limit with independent threshold**: separate counter with 1-minute window, block at 3 events regardless of entity risk. Simpler state (a sliding window per IP) but duplicates the blocking decision path.

**Option C — distinguish Invalid variants**: if `SessionDecision::Invalid(reason)` has a reason code, treat `MalformedStructure` (+30, clear attack) differently from `Expired` (+2, legitimate client with stale cookie). Requires understanding what reason codes exist in the current implementation.

**Option D — keep current calibration + document decay window explicitly**: if the entity risk decay window is short (e.g., 60 seconds), 8 attempts per minute is still a real cap on brute-force rate. Accept the trade-off, document clearly.

Recommended: **Option A** as the most defensible calibration, but verify the per-entity counter can be added without a large refactor first. If it's too intrusive, fall back to Option D with explicit documentation.

## Test

Pin the calibration with a test that asserts:
- 1st Invalid: entity_risk = X (small)
- 2nd Invalid: entity_risk = X + Y (growing)
- 4th Invalid: entity_risk >= 100 (block threshold crossed)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Invalid-session weight escalates non-linearly — first event is small, fourth event crosses the entity blocking threshold (or the configured decay window is documented to justify the flat weight)
- [ ] #2 The calibration is documented in a const block with rationale
- [ ] #3 Tests pin the escalation behavior with assertions for the 1st, 2nd, 3rd, and 4th event
- [ ] #4 Option C (distinguish Invalid reason codes) is evaluated; if the reason codes exist, different weights can be applied per reason
- [ ] #5 Regression: legitimate clients with one occasionally-stale token still do not cross the block threshold
<!-- AC:END -->

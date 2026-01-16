# Bug Hunting: Signal Horizon + Synapse Integration

## Priority Areas

### 1. WebSocket Tunnel Lifecycle
The sensors connect to Signal Horizon via WebSocket. This is the fragile part.

Test scenarios:
- Kill Signal Horizon mid-connection — does sensor recover gracefully?
- Kill sensor mid-telemetry send — does Signal Horizon handle partial data?
- Network blip (disconnect/reconnect) — does state sync correctly?
- Multiple rapid reconnects — any race conditions?
- Sensor connects, Signal Horizon restarts — does reconnect auth work?

Look for:
- Memory leaks on reconnect cycles
- Stale connection handles
- Duplicate registrations in fleet view
- Telemetry gaps after reconnect

### 2. Blocklist / Fleet Intelligence Sync
Signal Horizon pushes blocklists to sensors. O(1) lookup claims need validation.

Test scenarios:
- Push large blocklist (10K+ IPs) — memory impact? sync time?
- Push update while sensor is processing traffic — any blocking?
- Conflicting updates (rapid fire) — last write wins? corruption?
- Sensor offline during push — does it catch up on reconnect?

Look for:
- Blocklist not applied after push
- Partial blocklist state
- Stale entries not expiring
- Sync confirmation that didn't actually sync

### 3. Telemetry Flow (Sensor to Signal Horizon)
Synapse sends events, Signal Horizon aggregates for dashboard/campaigns.

Test scenarios:
- High volume telemetry burst — backpressure handling?
- Malformed telemetry payload — does it crash the receiver?
- Out-of-order events — timestamp handling?
- Duplicate events (network retry) — deduplication?

Look for:
- Events missing from dashboard
- Duplicate events counted twice
- Memory growth under sustained load
- Campaign correlation missing cross-sensor attacks

### 4. Hot Reload / Policy Distribution
Rules pushed from Signal Horizon should apply without sensor restart.

Test scenarios:
- Push rule update mid-request — race condition?
- Push invalid rule — does sensor reject gracefully or crash?
- Rapid rule updates (10 in 5 seconds) — queueing behavior?
- Push rule, immediately roll back — correct state?

Look for:
- Rules not applied
- Old rules still matching after update
- Sensor crash on bad rule
- Inconsistent state across fleet

### 5. Multi-Tenant Isolation
If Signal Horizon is multi-tenant, sensors from tenant A shouldn't see tenant B data.

Test scenarios:
- Sensor from tenant A sends to tenant B endpoint — rejected?
- Dashboard queries — any cross-tenant data leakage?
- Blocklist from tenant A applied to tenant B sensor?

Look for:
- Any cross-tenant data in responses
- Tenant ID spoofing in headers
- Missing tenant validation on inbound

### 6. Graceful Degradation
Per the capability matrix — Synapse should keep blocking if Signal Horizon dies.

Test scenarios:
- Kill Signal Horizon entirely — does Synapse still block attacks?
- Bring Signal Horizon back — does telemetry backfill?
- Disk full on Signal Horizon — sensor impact?
- Signal Horizon database connection lost — what fails?

Look for:
- Synapse stops blocking when Signal Horizon is down (CRITICAL BUG)
- Telemetry lost forever (should queue locally)
- Cascading failure

### 7. Entity State Sync
Entity risk scores, block status should be consistent.

Test scenarios:
- Block entity in Signal Horizon UI — does sensor honor immediately?
- Entity crosses threshold on sensor — does Signal Horizon reflect?
- Two sensors see same IP — risk scores consistent?
- Unblock entity — does it actually unblock on sensors?

Look for:
- Block/unblock not propagating
- Risk score drift between sensor and Signal Horizon
- Entity shows different status in UI vs actual enforcement

## Low-Hanging Fruit

Quick things that often break:

- Empty state handling (no sensors, no entities, no events)
- Pagination on large result sets
- Timezone handling in timestamps
- Special characters in entity names/tags
- Very long hostnames or IPs
- IPv6 vs IPv4 handling
- Unicode in payloads

---

## risk-server Integration

### 8. Schema Enforcement
risk-server handles deep schema validation. synapse-pingora handles fast WAF.

Test scenarios:
- Request matches WAF rule AND violates schema — both fire?
- Schema violation only (no WAF match) — does it still contribute to risk?
- Learned profile with weird parameter types — does validation work?
- Profile with 100+ parameters — performance impact?
- Endpoint with no learned profile yet — fail open or fail closed?

Look for:
- Schema violations not contributing to block decision
- Crashes on malformed profiles
- Memory leaks in profile storage
- Stale profiles not updating

### 9. API Profile Learning
Profiles are learned from traffic and persisted.

Test scenarios:
- High cardinality endpoint (1000 unique param values) — explosion?
- Learning mode to enforcement mode transition — smooth?
- Profile persistence across restart — actually saved?
- Concurrent requests to same endpoint during learning — race?

Look for:
- Profiles not persisting (check profiles.json)
- Learning never stabilizing
- Parameter type inference wrong (string vs int)
- Profile corruption after restart

### 10. DLP Scanning
Both request and response bodies scanned for PII/secrets.

Test scenarios:
- SSN in response body — caught?
- Credit card in request body — caught?
- API key pattern in headers — caught?
- Very large response (>8KB) — handled correctly?
- Binary response (image) — skipped correctly?
- Partial match (almost looks like SSN) — false positive?

Look for:
- DLP misses on valid patterns
- False positives blocking legitimate data
- Performance degradation on large bodies
- Crashes on binary content

### 11. risk-server Down
synapse-pingora should keep working if risk-server dies.

Test scenarios:
- Kill risk-server — does synapse-pingora still block WAF matches?
- Bring risk-server back — does schema enforcement resume?
- risk-server slow (5s response) — timeout handling?
- risk-server returns 500 — fail open or closed?

Look for:
- WAF blocking stops (CRITICAL)
- Requests hang waiting for risk-server
- No fallback behavior
- Errors not logged

---

## synapse-pingora Internals

### 12. Entity Tracking
Risk accumulation per IP/fingerprint.

Test scenarios:
- Same IP, 100 requests, 1 attack — risk correct?
- Risk decay over time — actually decays?
- Threshold crossing — global block triggers?
- Entity with both IP and JA4 — tracked as one or two?
- Entity persistence across restart — loaded from disk?

Look for:
- Risk not accumulating
- Risk never decaying
- Threshold never triggering
- Entities lost on restart
- Duplicate entities for same attacker

### 13. JA4 Fingerprinting
TLS client fingerprint for detecting anomalies.

Test scenarios:
- curl vs browser vs python requests — different fingerprints?
- Same client, different requests — consistent fingerprint?
- Rapid fingerprint changes from same IP — flagged?
- Invalid TLS handshake — handled gracefully?
- HTTP/2 vs HTTP/1.1 — ALPN captured correctly?

Look for:
- Fingerprint calculation wrong
- Fingerprint not stored on entity
- Rapid change detection not firing
- Crashes on weird TLS clients

### 14. Tarpit Behavior
Suspicious entities get delayed responses.

Test scenarios:
- Entity crosses tarpit threshold — delay applied?
- Delay is actually 30s (not 3s or 300s)?
- Multiple concurrent requests from tarpitted entity — all delayed?
- Tarpit + block — which wins?
- Client disconnects during tarpit — resource leak?

Look for:
- Tarpit not activating
- Wrong delay duration
- Resource leaks on disconnect
- Tarpit blocking when it should just delay

### 15. Trap Endpoints (Honeypots)
Paths like /wp-admin, /.env that no legit user hits.

Test scenarios:
- Hit trap endpoint — instant high risk?
- Hit trap with clean IP — still flagged?
- Custom trap endpoint configured — works?
- Trap hit logged correctly?

Look for:
- Trap not triggering risk
- Trap paths not configurable
- Missing audit trail

### 16. Body Inspection Cap (8KB)
Bodies truncated to 8KB for inspection.

Test scenarios:
- 7KB body — fully inspected?
- 9KB body with attack at byte 8500 — missed (expected)?
- 100MB body — no memory explosion?
- Chunked transfer encoding — handled?
- Multipart form with file upload — handled?

Look for:
- Memory explosion on large bodies
- Attacks in first 8KB missed
- Chunked encoding not parsed
- Crashes on multipart

### 17. TLS/SNI Validation
TLS 1.3 termination with SNI enforcement.

Test scenarios:
- Mismatched SNI and Host header — flagged?
- No SNI sent — rejected or allowed?
- TLS 1.2 client — rejected per config?
- Invalid cert from upstream — handled?
- Domain fronting attempt — detected?

Look for:
- SNI mismatch not detected
- Old TLS versions allowed when shouldn't be
- Domain fronting not flagged
- Crashes on TLS edge cases

## Tools

- Network tab in browser for API calls
- wscat or similar for WebSocket testing
- Kill Signal Horizon process directly
- Flood with synthetic telemetry from curl/script
- Check logs on both sides during tests

## Report Format

For each bug found:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Severity (Critical / High / Medium / Low)
5. Screenshots/logs if applicable

Have fun breaking it.

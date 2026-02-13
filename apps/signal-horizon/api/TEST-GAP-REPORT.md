# Test Gap Report: Signal Horizon API

**Audit date:** 2026-02-10
**Source files audited:** 164 files across `api/src/`
**Test files audited:** 87 test files
**Current test count:** ~87 test suites (estimated 800+ individual tests)
**Estimated coverage:** Manual audit (no coverage tooling run)

---

## Summary

The Signal Horizon API has **strong test coverage in the core libraries** (lib/, crypto, JWT, regex validator, safe-compare) and **good coverage for the correlator and some middleware** (CSRF, replay protection, timeout, query limits). However, there are **significant gaps in the API routes layer** (most route handlers lack dedicated tests), **several security-critical middleware modules are entirely untested** (telemetry JWT, JSON depth, async error handler, API versioning), and **fleet management services have extensive logic with minimal test coverage**. The most concerning gaps involve authentication bypass paths, tenant isolation enforcement, and untested security middleware.

**Total behaviors identified:** ~880 across all modules

| Status | Count | Percentage |
|--------|-------|------------|
| Covered | ~400 | 45% |
| Shallow | ~190 | 22% |
| Missing | ~290 | 33% |

---

## Gaps by Priority

### P0 — Security / Correctness Critical

These gaps could allow security vulnerabilities, data corruption, or silent incorrect behavior in production.

| # | Module | Behavior | State | Why P0 | Suggested Test | Standard Violated |
|---|--------|----------|-------|--------|----------------|-------------------|
| 1 | `telemetry-jwt.ts` | **Entire module untested** — JWT validation, API key auth, sensor approval status, revocation checks, fail-open on DB error | Missing | Telemetry ingest is the primary data path. A bypass here means untrusted data enters the system. Fail-open on DB error (line 92) means DB outage = no revocation checking. | Test all auth paths: valid JWT, expired JWT, revoked token, sensor API key (approved vs pending), legacy API key, missing secret (503 path), DB failure (fail-open) | Failure Mode Tests (Required); every Result/error path needs a test |
| 2 | `auth.ts` (route) | `GET /dev/bootstrap` — IP restriction (localhost only) untested | Missing | Dev bootstrap mints API credentials. If IP check is bypassed, anyone can get admin cookies. | Test 403 for non-localhost IPs; verify cookie flags (httpOnly, secure, sameSite) | Contract Tests: every public function has at least one test |
| 3 | `auth.ts` (middleware) | API key expiration boundary — no test for exactly-at-expiry edge case | Missing | Off-by-one in expiry comparison (< vs <=) could allow expired keys. | Test with key.expiresAt === now, expiresAt === now - 1ms, expiresAt === now + 1ms | Boundary Tests: just past maximum |
| 4 | `fleet-control.ts` | Destructive command confirmation (`X-Confirm-Token`) not tested | Missing | Missing token check = restart/shutdown commands without confirmation. 428 PRECONDITION_REQUIRED path untested. | Test restart/shutdown without confirm token (expect 428), with token (expect success) | Failure Mode Tests; error path must be tested |
| 5 | `fleet-control.ts` | Sensor online status validation (2-minute heartbeat window) untested | Missing | Sending commands to offline sensors could corrupt state or hang. | Test with stale heartbeat > 2min (expect 503), fresh heartbeat (expect success) | Boundary Tests: maximum values |
| 6 | `docs.ts` | Path traversal defense (SH-001) untested | Missing | `GET /:id` and `GET /search` use canonicalization to prevent `../../../etc/passwd`. No test verifies this. | Test with `../../../etc/passwd`, `..%2f..%2f`, encoded traversal sequences | Security: parses untrusted input |
| 7 | `fleet-sessions.ts` | Tenant isolation in multi-sensor session search untested | Missing | Cross-tenant session search could leak data if sensor ownership not validated. | Test that tenant A's search never returns tenant B's session data | Security: tenant isolation |
| 8 | `playbook-service.ts` | Serializable isolation transaction guarantee not tested | Shallow | Concurrent playbook execution could exceed `maxConcurrentRuns` (5) if isolation level doesn't actually serialize. | Test concurrent `runPlaybook` calls that would exceed limit; verify exactly one succeeds | State Transition Tests; concurrent access |
| 9 | `blocklist.ts` | Fleet-admin enforcement for `fleetWide=true` blocks untested | Shallow | Non-admin creating fleet-wide blocks affects all tenants. | Test non-admin POST with `fleetWide=true` (expect 403) | Security: authorization |
| 10 | `hunt/index.ts` | SQL injection prevention — `validateIpAddress`, `validateIdentifier`, `validateRequestId` validation functions untested directly | Missing | These guard ClickHouse parameterized queries. Bypass = SQL injection into analytics. | Test with injection payloads: `'; DROP TABLE`, UNION SELECT, encoded characters | Security: parses untrusted input |

### P1 — Reliability / Edge Cases

Missing these won't cause security issues but will cause operational pain.

| # | Module | Behavior | State | Why P1 | Suggested Test | Standard Violated |
|---|--------|----------|-------|--------|----------------|-------------------|
| 1 | `async-handler.ts` | **Entire module untested** — error classification (HttpError, Prisma P2025/P2002, ZodError, default 500) | Missing | Global error handler shapes all API error responses. Wrong mapping = misleading status codes. | Test each error type: HttpError variants, Prisma P2025→404, P2002→409, ZodError→400, unknown→500; verify production hides details | Contract Tests (Required) |
| 2 | `json-depth.ts` | **Entire module untested** — BFS depth calc, circuit breaker at 100, 400 response | Missing | Protects against CWE-674 (Uncontrolled Recursion). Without tests, refactors could silently break protection. | Test: depth 1 (pass), depth 20 (pass), depth 21 (reject), depth 100+ (circuit breaker), arrays vs objects, empty body (skip) | Boundary Tests: zero, one, maximum, just past maximum |
| 3 | `versioning.ts` | **Entire module untested** — Accept header parsing, version validation, 406 response | Missing | Unsupported API version requests should get 406, not silently use wrong version. | Test: valid vendor type, invalid version, missing Accept, wildcard Accept, default version fallback | Contract Tests (Required) |
| 4 | `security.ts` | **Entire module untested** — HTTPS enforcement, HSTS headers | Missing | In production, non-HTTPS requests should be rejected. Misconfigured HSTS = downgrade attacks. | Test: enforceHttps with/without X-Forwarded-Proto, hsts header values | Contract Tests (Required) |
| 5 | `validation.ts` | **Entire module untested** — Zod param/query/body validation, error sanitization | Missing | Generic validation middleware used across routes. Broken sanitization = information leak in production. | Test: valid input passes, invalid input returns 400, production mode hides schema details | Failure Mode Tests |
| 6 | `retry-buffer.ts` | Exponential backoff boundary — max retries exceeded drops to DLQ | Shallow | Silent data loss if retries exhausted without notification. | Test: item reaching maxRetries (5), verify DLQ log entry, verify droppedItems counter | Failure Mode Tests; cascading failures |
| 7 | `fleet-aggregator.ts` | Alert generation thresholds (CPU 80%/95%, memory 85%/95%, disk 90%/98%) | Missing | Incorrect thresholds = missed alerts or alert storms. | Test at each threshold boundary: 79% (no alert), 80% (warning), 95% (critical) | Boundary Tests: maximum values |
| 8 | `fleet-commander.ts` | Command timeout management and retry logic | Missing | Timed-out commands not retried properly = stuck fleet operations. | Test: command exceeding timeout, retry up to maxRetries, permanent failure after max | State Transition Tests |
| 9 | `rate-limit.ts` (API) | Playbook-specific limits (create 10/min, execute 30/min, stepComplete 100/min) | Missing | Untested = could be misconfigured without anyone knowing. | Test each preset: verify limit, verify exceeded behavior, verify different limit per action | Contract Tests |
| 10 | `bandwidth-aggregator.ts` | Division by zero protection in average bytes/request calculation | Shallow | Zero requests could cause NaN propagation in dashboard metrics. | Test with totalRequests=0, verify result is 0 not NaN | Boundary Tests: zero |
| 11 | `config-manager.ts` | SHA-256 hash computation for config diff detection | Missing | Wrong hash = sensors always appear out-of-sync or never sync. | Test: same config → same hash, different config → different hash, key ordering irrelevant | Contract Tests |
| 12 | `rollout-orchestrator.ts` | Failure rate threshold (20%) abort behavior | Missing | Exceeding threshold without abort = bad firmware deployed fleet-wide. | Test: 19% failures (continue), 21% failures (abort), verify abort cleans up | Boundary Tests |
| 13 | `rule-distributor.ts` | Blue/green deployment atomic switch and abort | Shallow | Failed atomic switch could leave fleet in mixed rule state. | Test: staging success → switch, staging failure → abort, partial staging | State Transition Tests |
| 14 | `crypto.ts` | Tampered ciphertext decryption failure | Missing | Modified ciphertext should throw, not return garbage. AES-GCM auth tag protects this, but no test confirms. | Test: modify base64 ciphertext, verify decryption throws (not returns wrong data) | Failure Mode Tests |
| 15 | `replay-protection.ts` | Redis/Prisma backend fail-closed (503) behavior | Missing | Code says fail-closed on store unavailability, but no test verifies 503 response. | Test: store.checkAndAdd throws → middleware returns 503 | Failure Mode Tests |

### P2 — Completeness / Confidence

Tests that round out coverage and prevent regressions during future changes.

| # | Module | Behavior | State | Why P2 | Suggested Test |
|---|--------|----------|-------|--------|----------------|
| 1 | `scopes.ts` | MAX_ALIAS_DEPTH=10 boundary — expansion stops at depth 10 | Missing | Refactoring aliases without this test could introduce infinite expansion | Test alias chain of depth 9 (works), depth 11 (stops) |
| 2 | `content-type.ts` | Case insensitivity (`APPLICATION/JSON`) | Missing | Edge case but real clients send mixed case | Test uppercase and mixed-case content types |
| 3 | `csrf.ts` | Cookie attributes (sameSite, secure, path, maxAge) | Missing | Misconfigured cookies = CSRF bypass | Verify cookie options in response |
| 4 | `safe-stringify.ts` | Special objects (Date, RegExp, Error), null/undefined top-level | Missing | Serialization of rich objects could crash or lose data | Test each special type |
| 5 | `trace-headers.ts` | MAX_REQUEST_ID_LEN enforcement | Missing | Very long request IDs waste memory/logs | Test at and past length limit |
| 6 | `ws-rate-limiter.ts` | Stale connection cleanup interval | Shallow | Memory leak if cleanup doesn't actually run | Test with fake timers: advance past cleanup interval, verify removal |
| 7 | `epoch.ts` | Concurrent increment atomicity | Missing | Redis INCR is atomic, but no test proves the assumption | Test parallel increments, verify final count |
| 8 | `beam/threats.ts` | Risk score → severity boundary mapping (0, 24, 25, 49, 50, 74, 75, 100) | Missing | Off-by-one in mapping = wrong severity labels | Test each boundary value |
| 9 | `fleet-bandwidth.ts` | Timeline granularity bucket boundaries (1m, 5m, 1h) | Missing | Wrong buckets = misleading graphs | Test with known timestamps, verify bucket assignment |
| 10 | `fleet-diagnostics.ts` | SSE stream cleanup on client disconnect | Missing | Resource leak if cleanup handler missing | Test: start SSE, simulate disconnect, verify cleanup |
| 11 | `request-id.ts` | UUID case sensitivity and whitespace trimming | Missing | Edge case for non-standard clients | Test uppercase UUID, spaces around value |
| 12 | `rate-limiter.ts` | Window expiration (new window starts after TTL) | Missing | Stale windows could accumulate memory | Test with fake timers past window TTL |
| 13 | Various routes | ~20 route handlers with no dedicated test file | Missing | No regression protection for API contracts | Create integration tests for untested routes (docs, blocklist check, fleet-bandwidth, fleet-diagnostics, fleet-files, fleet-releases, fleet-sessions, campaigns, onboarding, users, warroom, api-intelligence) |

### Well-Tested (No Action Needed)

These modules have adequate coverage:

- **`correlator/index.ts`** + **`sequence-matcher.ts`** — Excellent coverage of campaign correlation, stage mapping, shallow copy fix, confidence accumulation, batch processing
- **`lib/regex-validator.ts`** — Comprehensive ReDoS attack pattern detection, safe regex creation, Zod integration
- **`lib/safe-compare.ts`** — All comparison functions, HMAC, token generation well-tested
- **`lib/jwt.ts`** — HS256 validation, expiry, audience, signing, revocation thoroughly covered
- **`lib/zod-sanitizer.ts`** — Production/dev mode error sanitization, middleware, combined validation
- **`middleware/csrf.ts`** — Double-submit pattern, timing-safe comparison, skip routes, custom config
- **`middleware/replay-protection.ts`** — Nonce store, capacity, TTL eviction, middleware flow well-covered
- **`middleware/timeout.ts`** — Timeout handling, custom routes, presets, cleanup all tested
- **`middleware/query-limits.ts`** — Parameter limits, custom limits, skip routes covered
- **`middleware/request-id.ts`** — UUID v4 generation, validation, rejection of v1
- **`lib/ws-rate-limiter.ts`** — Token bucket algorithm, burst, refill, stats well-covered
- **`storage/redis/keys.ts`** — Key building with encoding, validation covered
- **`storage/redis/ttl.ts`** — Jitter calculation with deterministic random
- **`api/middleware/scopes.ts`** — Alias expansion, transitive chains, wildcard, cycle detection
- **`api/middleware/auth.ts`** — JWT, cookie fallback, epoch validation, API key paths

---

## Shallow Test Details

### `warroom/index.ts` — `getLiveMetrics()` trend calculation
**Current test:** Verifies metrics are returned but may not validate trend detection logic (increasing/stable/decreasing).
**Problem:** Trend is based on comparing current vs. previous window with 10% threshold. No test verifies boundary at exactly 10%.
**Recommended fix:** Test with values producing exactly 10% change (stable), 11% (increasing), -11% (decreasing).

### `hunt/index.ts` — Hybrid query split at 24h threshold
**Current test:** Tests query routing but boundary at exactly ROUTING_THRESHOLD_MS (86400000) may not be verified.
**Problem:** Off-by-one at threshold could send queries to wrong backend.
**Recommended fix:** Test with startTime at exactly threshold-1ms (Postgres), threshold (ClickHouse), spanning both (hybrid).

### `fleet-control.ts` — Batch command partial failures
**Current test:** May test all-success but not partial failure (some sensors succeed, some fail).
**Problem:** Error aggregation in batch mode may not surface individual failures.
**Recommended fix:** Mock sensors where 2/5 fail, verify response includes both successes and failures.

### `intel/actors.ts` — Activity pattern classification
**Current test:** Tests basic actor aggregation but may not verify burst (<1 day) vs sustained (<7 days) vs sporadic (>7 days) boundaries.
**Problem:** Wrong classification = misleading threat intelligence.
**Recommended fix:** Test with activity spanning exactly 1 day, 7 days, and 8 days.

### `broadcaster/index.ts` — Buffer flush timing
**Current test:** Tests basic broadcast but buffer coalescing (100 blocks or 5s) may not be verified.
**Problem:** Buffer never flushing = delayed blocklist updates to sensors.
**Recommended fix:** Test with 99 blocks (no flush), 100th block (flush), timer-based flush at 5s.

---

## Notes

**Test infrastructure observations:**
- Vitest with good mock support is in use across the project
- Test naming is generally descriptive and follows conventions
- Co-located test files (`__tests__/` dirs and `.test.ts` siblings) — easy to find

**Patterns that would improve testing:**
1. **Test fixtures for common objects** — Many tests could share builders for `Sensor`, `Tenant`, `ApiKey`, `Campaign` etc. A `buildSensor({overrides})` pattern would reduce boilerplate.
2. **Shared mock factory for Prisma** — Multiple test files independently mock Prisma client. A shared `createMockPrisma()` factory would ensure consistency.
3. **Integration test harness** — The API routes layer has the largest gap. A lightweight integration test setup (supertest + mocked services) would cover many routes efficiently.

**Modules not fully inventoried (Agent 4 token limits):**
- `api-intelligence/index.ts`, `sigma-hunt/index.ts`, `aggregator/index.ts`, `impossible-travel.ts` (tests exist but source not fully inventoried)
- `synapse-direct.ts`, `synapse-proxy.ts`, `user-auth.ts`, `sensor-bridge.ts`, `metrics.ts`, `sensorConfigService.ts`

**Follow-up audit completed 2026-02-10** — see Addendum below.

---

# Addendum: Services Deep-Dive (2026-02-10)

Follow-up audit of the 10 service modules flagged above. This addendum covers the full public contract for each module.

**Source files audited:**
- `api/src/services/api-intelligence/index.ts`
- `api/src/services/sigma-hunt/index.ts`
- `api/src/services/aggregator/index.ts`
- `api/src/services/impossible-travel.ts`
- `api/src/services/synapse-direct.ts`
- `api/src/services/synapse-proxy.ts`
- `api/src/services/user-auth.ts`
- `api/src/services/sensor-bridge.ts`
- `api/src/services/metrics.ts`
- `api/src/services/sensorConfigService.ts`

**Test files audited:**
- `api/src/services/api-intelligence/__tests__/api-intelligence.test.ts`
- `api/src/services/sigma-hunt/__tests__/sigma-hunt.test.ts`
- `api/src/services/aggregator/aggregator.test.ts`
- `api/src/services/aggregator/privacy.test.ts`
- `api/src/services/impossible-travel.test.ts`
- `api/src/services/impossible-travel-store.test.ts`
- `api/src/services/synapse-proxy.test.ts`
- `api/src/services/__tests__/user-auth.test.ts`
- `api/src/services/sensor-bridge.test.ts`
- `api/src/services/__tests__/synapse-direct-trace-headers.test.ts`
- `api/src/__tests__/tenant-isolation.test.ts`

## Addendum Summary

Two distinct quality tiers emerged. **Well-tested** (api-intelligence, sigma-hunt, synapse-proxy) have deep contract and boundary coverage. **Undertested** (user-auth, sensor-bridge, metrics, sensorConfigService, synapse-direct) have security-critical paths with zero or near-zero coverage. The aggregator sits between — good queue/dedup coverage but missing idempotency and observability verification.

| Module | Behaviors | Covered | Shallow | Missing | Coverage |
|--------|-----------|---------|---------|---------|----------|
| api-intelligence | 38 | 30 | 5 | 3 | 79% |
| sigma-hunt | 48 | 44 | 2 | 2 | 92% |
| aggregator | 28 | 16 | 7 | 5 | 57% |
| impossible-travel | 16 | 9 | 4 | 3 | 56% |
| synapse-direct | 21 | 7 | 4 | 10 | 33% |
| synapse-proxy | 46 | 37 | 3 | 6 | 80% |
| user-auth | 17 | 3 | 2 | 12 | 18% |
| sensor-bridge | 14 | 3 | 2 | 9 | 21% |
| metrics | 10 | 0 | 0 | 10 | 0% |
| sensorConfigService | 13 | 0 | 1 | 12 | 8% |
| **TOTAL** | **251** | **149** | **30** | **72** | **59%** |

---

## Addendum P0 — Security / Correctness Critical

| # | Module | Behavior | State | Why P0 | Suggested Test |
|---|--------|----------|-------|--------|----------------|
| A1 | user-auth | `refreshSession()` — parses composite token (id:secret), validates expiry, checks revocation, verifies secret | Missing | Auth token refresh is the primary session continuity mechanism; untested means expired/revoked/forged tokens could pass. Ref: audit-workflow §P0 "Involves authentication" | Test valid refresh, expired token, revoked token, secret mismatch, malformed composite format |
| A2 | user-auth | `logout()` — blacklists JTI and revokes all refresh tokens for session | Missing | If blacklisting fails silently, logged-out sessions remain valid. Ref: audit-workflow §P0 "Involves authentication" | Test that JTI appears in blacklist after logout, refresh tokens marked revoked |
| A3 | user-auth | `switchTenant()` — validates user is member of target tenant before issuing new token | Missing | Broken tenant switching = cross-tenant access. Ref: audit-workflow §P0 "Involves authorization" | Test switch to valid tenant succeeds, switch to non-member tenant rejects |
| A4 | user-auth | `createSession()` — embeds epoch in JWT for bulk revocation support | Missing | If epoch isn't embedded, password-change revocation breaks silently. Ref: audit-workflow §P0 "correctness where wrong answer silently is worse than crash" | Test JWT payload contains epoch field matching user's current epoch |
| A5 | sensorConfigService | `getConfig()`/`updateConfig()` — verifies sensor belongs to requesting tenant | Missing | Tenant isolation on sensor configs. No test = no proof configs can't leak cross-tenant. Ref: audit-workflow §P0 "Involves access control" | Test getConfig with wrong tenantId returns null; updateConfig with wrong tenantId rejects |
| A6 | sensorConfigService | `updateConfig()` encrypts sensitive fields; `getConfig()` decrypts them | Missing | Crypto logic for secrets-at-rest. Untested encryption could store plaintext or fail to decrypt. Ref: audit-workflow §P0 "Involves cryptographic operations" | Test roundtrip: update with sensitive field → getConfig returns decrypted value; verify raw DB value is not plaintext |
| A7 | sensorConfigService | `updateConfig()` — validates config via SensorConfigSchema before storage | Missing | Invalid config pushed to sensors could brick them. Ref: audit-workflow §P0 "Parses untrusted input" | Test invalid config shape rejected with descriptive error |
| A8 | aggregator | Idempotency key generation and cross-instance dedup via `checkAndAdd()` | Missing | Without idempotency verification, duplicate signals inflate threat scores and trigger false alerts. Ref: audit-workflow §P0 "correctness requirements" | Test: store signal → store same signal again → second returns already-seen; verify key stability |
| A9 | user-auth | `login()` timing-safe comparison with dummy hash on missing user | Shallow | User enumeration via timing side-channel. Test verifies error message but doesn't verify `safeCompare` called on unknown user. Ref: testing-standards §Anti-Pattern 2 "Happy Path Only" | Verify `safeCompare` called even when user lookup returns null |
| Atlas Crew | sensor-bridge | `handleMessage()` auth-failed — closes connection on authentication failure | Missing | If auth failure doesn't close the connection, unauthenticated sensors stay connected. Ref: audit-workflow §P0 "Involves authentication" | Test: send auth-failed message → verify WebSocket closed, no heartbeat started |
| A11 | user-auth | `refreshSession()` — rejects token when user is no longer member of tenant | Missing | Stale refresh token grants access to tenant user was removed from. Ref: audit-workflow §P0 "Involves authorization" | Test: refresh token for user removed from tenant → rejects with membership error |

---

## Addendum P1 — Reliability / Edge Cases

| # | Module | Behavior | State | Why P1 | Suggested Test |
|---|--------|----------|-------|--------|----------------|
| A12 | sensor-bridge | `stop()` — cancels heartbeat and reconnect timers | Missing | Timer leak = resource leak + ghost heartbeats. Ref: audit-workflow §P1 "cleanup on shutdown" | Test: start → stop → verify no more heartbeat messages |
| A13 | sensor-bridge | `sendHeartbeat()` — calculates requests-per-minute delta | Missing | Wrong RPS in heartbeat = incorrect fleet dashboard data. Ref: audit-workflow §P1 "operational visibility" | Test: set known metrics → verify heartbeat RPS math |
| A14 | sensor-bridge | `scheduleReconnect()` — reconnection after disconnect | Missing | Silent reconnect failure = permanent sensor offline. Ref: audit-workflow §P1 "Handles a failure mode" | Test: disconnect → verify reconnect attempted after delay |
| A15 | impossible-travel | `ResilientUserHistoryStore` — falls back to in-memory on Redis failure | Missing | Redis dies + fallback broken = all impossible-travel detection stops. Ref: audit-workflow §P1 "fallible dependency failure case" | Test: mock Redis to throw → verify in-memory fallback works |
| A16 | synapse-direct | `fetchPrometheusMetrics()` — handles malformed/empty Prometheus output | Missing | Bad scrape data cascades as null metrics through dashboard. Ref: audit-workflow §P1 "Handles a failure mode" | Test: empty string, partial format, garbage → graceful null/default |
| A17 | synapse-direct | `getSensorStatus()` with uptime=0 — zero-division guard | Shallow | Division by zero → NaN propagates to dashboard. Ref: testing-standards "Boundary Tests - Zero" | Test: uptime=0 → RPS is 0, not NaN/Infinity |
| A18 | synapse-direct | `getSensorStatus()` returns null if health endpoint fails | Missing | Should degrade gracefully, not throw. Ref: audit-workflow §P1 "Handles a failure mode" | Test: mock fetch to reject → verify null returned |
| A19 | synapse-proxy | Cache expiry cleanup interval (60-second background timer) | Missing | Without cleanup, stale cache entries accumulate unbounded. Ref: audit-workflow §P1 "resource limits" | Test: insert entries → advance clock past TTL + cleanup → verify removed |
| A20 | synapse-proxy | Stale request garbage collection (60-second threshold) | Missing | Leaked pending requests = memory leak + concurrency slot exhaustion. Ref: audit-workflow §P1 "resource limits" | Test: create pending request → advance 61s → verify rejected with TIMEOUT |
| A21 | aggregator | Backpressure warning at 80% queue capacity | Missing | Without warning, operators have no lead time before drops. Ref: audit-workflow §P1 "operational visibility" | Test: fill to 80% → verify logger.warn called |
| A22 | aggregator | `retryQueue` behavior during concurrent flushing | Shallow | Signals during flush could be lost. Ref: audit-workflow §P1 "concurrency" | Test: trigger flush → queue signal during → verify retryQueue receives it |
| A23 | aggregator | ClickHouse async write path verification | Shallow | Silent write failures. Ref: audit-workflow §P1 "fallible dependency" | Test: verify insertSignalEvents called with correct shape |
| A24 | aggregator | `storeSignal()` → ImpossibleTravelService for geo signals | Shallow | Integration path never exercised. Ref: audit-workflow §P1 "module boundary" | Test: signal with geo metadata → verify processLogin called |
| A25 | impossible-travel | Logins with `timeDiffHours <= 0` or `> 24` — boundary rejection | Shallow | Off-by-one at boundary undetected. Ref: testing-standards "Boundary Tests" | Test: reverse timestamps → no alert; 25h gap → no alert |
| A26 | impossible-travel | RedisUserHistoryStore trimming at maxHistoryPerUser | Shallow | Unbounded history = Redis memory pressure. Ref: audit-workflow §P1 "resource limits" | Test: append 11 with max=10 → verify 10 stored |
| A27 | impossible-travel | RedisUserHistoryStore TTL application | Shallow | Missing TTL = permanent keys. Ref: audit-workflow §P1 "resource limits" | Test: verify kv.set includes ttlSeconds parameter |
| A28 | sigma-hunt | `lookbackMinutes` clamping (5–1440) | Shallow | lookback=0 → no data; lookback=100000 → OOM. Ref: testing-standards "Boundary Tests" | Test: 1 → clamped to 5; 2000 → clamped to 1440 |
| A29 | sigma-hunt | `maxRowsPerRule` clamping (10–5000) | Shallow | Same clamping gap. Ref: testing-standards "Boundary Tests" | Test: 5 → clamped to 10; 10000 → clamped to 5000 |
| A30 | metrics | All 10+ Prometheus metrics — counters, gauges, histograms | Missing | Zero test coverage. Label drift breaks dashboards silently. Ref: audit-workflow §P1 "operational visibility" | Smoke test: exercise methods → verify metric names and labels in registry |
| A31 | sensor-bridge | `isConnected()` — true only when OPEN and authenticated | Missing | Callers may send to disconnected sensor. Ref: audit-workflow §P1 "state transitions" | Test: before auth → false; after auth → true; after close → false |
| A32 | sensor-bridge | `buildHeartbeat()` — health status from metrics | Missing | Wrong health = fleet dashboard shows wrong state. Ref: audit-workflow §P1 "operational visibility" | Test: inject known metrics → verify health field |
| A33 | sensorConfigService | `updateConfig()` increments version number | Missing | Without version, config race conditions undetected. Ref: audit-workflow §P1 "state transitions" | Test: update twice → version incremented each time |
| A34 | sensorConfigService | `updateConfig()` sends config via FleetCommander | Missing | Fleet push fails silently → stale config. Ref: audit-workflow §P1 "module boundary" | Test: update → verify FleetCommander.sendCommand called |
| A35 | sensorConfigService | `updateConfig()` logs audit trail | Missing | Missing audit = compliance gap. Ref: audit-workflow §P1 "operational visibility" | Test: update → verify auditService.log called |

---

## Addendum P2 — Completeness / Confidence

| # | Module | Behavior | State | Why P2 | Suggested Test |
|---|--------|----------|-------|--------|----------------|
| A36 | api-intelligence | Buffer overflow trim at maxBufferedItems (5000) | Missing | Defensive cap; queue_full is primary guard | Enqueue 5001 → verify trim, oldest dropped |
| A37 | api-intelligence | Batch flush threshold (signalBatchSize=200) boundaries | Shallow | Threshold precision not verified | 199 → no flush; 200th → flush |
| A38 | api-intelligence | `getTopViolatingEndpoints()` Prisma.sql parameterized query (SH-002) | Shallow | Primary path mocked; fallback tested | Verify Prisma.sql tag used, not string concat |
| A39 | aggregator | Metrics recording (signalsIngestedTotal, signalsDroppedTotal) | Shallow | Values never asserted | Spy on metrics → verify increments with labels |
| A40 | aggregator | Dedup by template key for TEMPLATE_DISCOVERY signals | Missing | Only sourceIp dedup tested | Two same-template signals → merged |
| A41 | synapse-direct | `getTopEndpoints()` returns [] (hardcoded stub) | Missing | Document stub with test | Call → returns [] |
| A42 | synapse-direct | `getBandwidthAnalytics()` size estimation | Missing | Display math with estimates | Known count → verify byte math |
| A43 | synapse-direct | `getThreatSummary()` severity distribution | Shallow | Math.floor percentages should sum correctly | 100 blocked → 10+30+40+20 |
| A44 | synapse-direct | `buildResponseTimeDistribution()` edge cases | Missing | Complex histogram math untested | Zero/missing/single bucket → graceful output |
| A45 | synapse-direct | Singleton init/get adapter | Missing | Module init pattern | init → get returns instance; get before init → throws |
| A46 | synapse-proxy | `SynapseProxyError.toJSON()` suggestion mapping | Shallow | Code tested, suggestions not | Each error code → verify suggestion string |
| A47 | synapse-proxy | `getProfile()` URL encoding edge cases | Shallow | Happy path only | Special chars, unicode → correct encoding |
| A48 | user-auth | `login()` logs metadata (ip, ua) on failure | Missing | Audit trail | Failed login → logger called with ip, ua |
| A49 | user-auth | `verifyPassword()` malformed hash (no colon) | Missing | Returns false but should be explicit | "nocolon" hash → false without throw |
| A50 | user-auth | `login()` rejects user with no tenant memberships | Missing | Code throws but untested | Empty memberships → descriptive error |
| A51 | sensor-bridge | `handleMessage()` ping/pong | Missing | Protocol correctness | Send ping → pong response sent |
| A52 | sensor-bridge | `fetchPingoraMetrics()` timeout | Missing | 5s timeout untested | Mock hang → verify timeout |
| A53 | sensorConfigService | `getConfig()` legacy plaintext config | Missing | Backward compat | Unencrypted config → returned without error |

---

## Addendum Shallow Test Details

### user-auth: login() timing-safe comparison (A9)
**Current test:** Tests login with unknown user, verifies "Invalid credentials" error returned.
**Problem:** Doesn't verify `safeCompare` is called with a dummy hash when user is missing. Naive short-circuit on user-not-found would pass but leak existence via timing.
**Recommended fix:** Mock `safeCompare`, verify called even when user lookup returns null.

### synapse-direct: fetch<T>() null on error (A17, A18)
**Current test:** Trace header tests exercise getSensorStatus success path only.
**Problem:** A regression that throws instead of returning null would crash callers.
**Recommended fix:** Mock fetch to reject → verify null returned.

### synapse-direct: RPS with zero uptime (A17)
**Current test:** Only positive uptime tested.
**Problem:** `totalRequests / uptimeSeconds` with uptimeSeconds=0 → Infinity.
**Recommended fix:** Mock health endpoint with `{ uptime: 0, total_requests: 100 }` → verify RPS=0.

### aggregator: retryQueue concurrent flushing (A22)
**Current test:** Queue acceptance and batch flush tested independently.
**Problem:** No test simulates signal arrival while `isFlushing=true`.
**Recommended fix:** Mock storeSignal slow, queue during flush → verify retryQueue receives it.

### aggregator: ClickHouse write (A23)
**Current test:** ClickHouse mocked but `insertSignalEvents` call not verified.
**Problem:** Async write could silently stop; tests wouldn't catch it.
**Recommended fix:** Verify insertSignalEvents called with expected shape.

### aggregator: ImpossibleTravel integration (A24)
**Current test:** No signal with geo metadata created.
**Problem:** Integration call to `impossibleTravel.processLogin()` is dead code in tests.
**Recommended fix:** Signal with `metadata: { latitude: 40.7, longitude: -74.0 }` → verify call.

### impossible-travel: timeDiffHours boundaries (A25)
**Current test:** Normal 1h and 8h scenarios.
**Problem:** <=0 and >24 guards from code comments never hit.
**Recommended fix:** Reverse timestamps (negative diff) and 24h01m apart.

### impossible-travel: Redis trimming (A26)
**Current test:** Doesn't exceed maxHistoryPerUser.
**Problem:** Splice logic untested.
**Recommended fix:** max=3, append 4 → verify only 3 retained.

### impossible-travel: Redis TTL (A27)
**Current test:** TTL parameter not verified.
**Problem:** Missing TTL → permanent keys → memory growth.
**Recommended fix:** Mock kv.set → verify ttlSeconds present.

### sigma-hunt: lookbackMinutes clamping (A28)
**Current test:** Uses default 60.
**Problem:** `Math.max(5, Math.min(1440, v))` never boundary-tested.
**Recommended fix:** lookbackMinutes=1 → clamp to 5; 2000 → clamp to 1440.

### sigma-hunt: maxRowsPerRule clamping (A29)
**Current test:** Uses default 500.
**Problem:** Same clamping gap.
**Recommended fix:** 5 → 10; 10000 → 5000.

---

## Addendum Well-Tested (No Action Needed)

### sigma-hunt
Most thoroughly tested module (92%). SQL injection prevention has 20+ attack vectors: forbidden keywords, table functions, comment injection, unbalanced quotes, control characters, backtick/double-quote abuse. CRUD, tenant isolation, lead dedup, idempotent ack all well-covered.

### synapse-proxy
Comprehensive 900+ line suite (80%). SSRF protection (private IPs, metadata endpoint, credentials, port range), path traversal, tenant isolation, concurrency limits, timeout, retry logic, caching, graceful shutdown. Gaps limited to background cleanup timers.

### api-intelligence
Strong ingestion pipeline coverage (79%). Event emission, endpoint CRUD, tenant isolation, pagination, schema violations, fleet inventory, edge cases (unicode, long paths, special chars, null metadata). Gaps limited to internal buffer management.

### tenant-isolation (cross-cutting)
Dedicated test verifies fleet commands, signal types, rule distribution, and API intelligence queries all enforce tenantId boundaries.

---

## Addendum Notes

1. **Priority concentration:** 8 of 11 P0 gaps are in `user-auth.ts` and `sensorConfigService.ts`. These two files handle authentication, session management, and sensor config encryption — the most security-critical paths in the hub.

2. **metrics.ts full zero:** Entire Prometheus metrics service has no tests. A single smoke-test suite covering metric names and label sets would close this efficiently.

3. **sensor-bridge.ts integration concern:** Most gaps involve WebSocket lifecycle and timer management. Consider integration tests with a mock WebSocket server rather than unit-testing timer internals.

4. **Test infrastructure suggestion:** Several modules (aggregator, impossible-travel, sensor-bridge) would benefit from a shared `vi.useFakeTimers()` utility for time-dependent behavior (batch timers, TTL, reconnect delays, heartbeat intervals).

5. **Idempotency (aggregator, A8):** Architecturally important for multi-instance deployments. Test both "new signal" and "duplicate signal" paths, ideally with the real Redis-backed nonce store.

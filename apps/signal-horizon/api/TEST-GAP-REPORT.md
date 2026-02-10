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

These should be audited in a follow-up pass.

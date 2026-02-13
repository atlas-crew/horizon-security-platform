# Security Audit Remediation Tracker

**Last Updated**: 2026-02-01
**Total Findings**: ~140 across all audits
**Status**: In Progress
**Issue Tracking**: All outstanding findings tracked in beads (`bd list --label=security`)

---

## Beads Issue Summary

| Severity | Beads Issues | Application |
|----------|--------------|-------------|
| P0/Critical | 7 issues | 2 synapse-pingora, 5 signal-horizon |
| P1/High | 21 issues | 12 synapse-pingora, 7 signal-horizon, 2 dependency audits |
| P2/Medium | 15 issues | 15 synapse-pingora |

Run `bd list --priority=0` through `bd list --priority=2` to see all issues.

---

## Summary

| Severity | Total | Fixed | Verified N/A | Remaining |
|----------|-------|-------|--------------|-----------|
| P0/Critical | ~12 | 9 | 4 | ~3 |
| P1/High | ~35 | 3 | 2 | ~30 |
| P2/Medium | ~45 | 2 | 1 | ~42 |
| P3/Low | ~20 | 0 | 0 | ~20 |

---

## P0/Critical Findings

### Fixed

| ID | Finding | Location | Fix | Date |
|----|---------|----------|-----|------|
| SEC-001 | X-Forwarded-For IP Spoofing | `admin_server.rs` | Added trusted proxy validation | 2026-02-01 |
| WAF-P0-1 | ReDoS in SQL injection regex | `waf/synapse.rs:43-45` | Replaced with atomic groups | 2026-02-01 |
| SEC-003 | CORS wildcard with credentials | `admin_server.rs:63-72` | Restricted origins, added security headers | 2026-02-01 |
| SEC-002 | Authentication bypass | `admin_server.rs` | Added JWT validation | 2026-02-01 |
| SESS-P0-1 | Weak session ID (CRC32) | `session/mod.rs` | Replaced with Blake3 + getrandom | 2026-02-01 |
| CRYPT-001 | MD5 for content hashing | `fingerprint/integrity.rs` | Replaced with Blake3 | 2026-02-01 |
| CRYPT-002 | Hardcoded HMAC secret | `config.rs` | Removed default, require explicit config | 2026-02-01 |
| LOG-001 | API key exposure in logs | `horizon/client.rs` | Redacted sensitive fields | 2026-02-01 |
| SSRF-001 | IPv6-mapped IPv4 bypass | `access.rs` | Added IPv4-mapped detection | 2026-02-01 |

### Verified Not Applicable

| ID | Finding | Reason |
|----|---------|--------|
| TLS-001 | TLS verification bypass | Feature never implemented |
| ENT-P0-1 | Entity store memory exhaustion | Already has LRU eviction with max_actors |
| DLP-P1-1 | DLP scanner memory exhaustion | Already has stream limits |
| BIN-001 | Bincode deserialization DoS | Bincode not used in codebase |

### Outstanding

| ID | Finding | Location | Priority | Notes |
|----|---------|----------|----------|-------|
| SESS-P0-2 | TOCTOU race condition | `session/manager.rs:89-120` | **CRITICAL** | Read-modify-write race allows state corruption |
| ENT-P0-2 | Unbounded fingerprint memory | `entity/store.rs:109-124` | **CRITICAL** | Unique fingerprints accumulate without limit |

---

## P1/High Findings

### Fixed

| ID | Finding | Location | Fix | Date |
|----|---------|----------|-----|------|
| TARPIT-P1-3 | Connection exhaustion | `tarpit/manager.rs` | Added semaphore limit | 2026-02-01 |
| SHADOW-P1-1 | Header credential leakage | `shadow/protocol.rs` | Added header sanitization | 2026-02-01 |
| RATE-P1-2 | Insufficient tarpit delay | `tarpit/manager.rs` | Increased to 30s max | 2026-02-01 |

### Verified Not Applicable

| ID | Finding | Reason |
|----|---------|--------|
| SESS-P2-4 | Session infinite lifetime | `session_ttl_secs` already enforced |
| DLP-P1-3 | Stream memory limit | Already protected |

### Outstanding

| ID | Finding | Location | Notes |
|----|---------|----------|-------|
| RATE-P1-1 | Token bucket race condition | `ratelimit.rs` | 10-20% burst bypass under concurrent load |
| WAF-P1-1 | XSS HTML entity bypass | `waf/engine.rs` | `&#60;script&#62;` bypasses detection |
| WAF-P1-2 | Command injection gaps | `waf/synapse.rs:94-98` | Missing newline, backticks, brace expansion |
| WAF-P1-4 | Path traversal bypass | `waf/synapse.rs:67-71` | Double URL encoding, Unicode normalization |
| WAF-P1-5 | Weak private key validation | `validation.rs:156-178` | Accepts keys < 2048-bit RSA |
| SESS-P1-1 | JA4 fingerprint spoofing | `fingerprint/mod.rs:156-198` | Missing behavioral validation |
| SESS-P1-2 | Credential stuffing gaps | `credential_stuffing.rs` | Only per-actor, misses distributed attacks |
| SESS-P1-3 | Predictable risk decay | Risk scoring | Linear decay allows timed attacks |
| SESS-P1-4 | Actor correlation false positives | Correlation | Merges unrelated users behind NAT/VPN |
| SESS-P1-5 | Session fixation | Session generation | Deterministic from client inputs |
| ADMIN-P1-1 | No auth rate limiting | `admin_server.rs` | Allows brute-force attacks |
| ADMIN-P1-2 | Error info disclosure | `admin_server.rs:245-265` | Exposes stack traces, versions |

---

## P2/Medium Findings

### Fixed

| ID | Finding | Location | Fix | Date |
|----|---------|----------|-----|------|
| BODY-P2-4 | JSON nesting depth | `body.rs` | Added depth validation | 2026-02-01 |
| WS-P2-1 | Reconnection thundering herd | `horizon/client.rs` | Added jitter to backoff | 2026-02-01 |

### Outstanding

| ID | Finding | Location | Notes |
|----|---------|----------|-------|
| WAF-P2-1 | Missing NoSQL injection | `waf/synapse.rs` | No JSON injection patterns |
| WAF-P2-2 | SSRF detection gaps | `waf/synapse.rs:112-118` | Missing IPv6 localhost, cloud metadata |
| WAF-P2-5 | Rule panic on bad regex | `detection/rules.rs:67-78` | unwrap() on untrusted input |
| WAF-P2-6 | Unicode homograph attacks | `validation.rs:45-52` | Cyrillic characters bypass |
| SESS-P2-1 | Unbounded session HashMap | SessionManager | No size limit |
| SESS-P2-2 | Debug log data leakage | `profiler/mod.rs`, `credential_stuffing.rs` | Logs password hashes |
| SESS-P2-3 | Weak actor ID generation | Actor ID | Uses DefaultHasher |
| SESS-P2-5 | Correlation confidence manipulation | Correlation | High scores from spoofed signals |
| SESS-P2-6 | In-memory detector state | Credential stuffing | Lost on restart |
| SESS-P2-7 | No pre-analysis rate limit | Request handling | Expensive ops before limits |
| RATE-P2-1 | Slow cleanup interval | `entity/store.rs` | 60s allows 600K entries at 10K RPS |
| RATE-P2-2 | Relaxed atomic ordering | `shadow/rate_limiter.rs` | 5-10% exceedance on multi-core |
| RATE-P2-3 | No per-site rate limiting | `ratelimit.rs` | Cross-tenant via shared NAT |
| RATE-P2-4 | Global actor limit | Actor store | One site affects all tenants |
| RATE-P2-5 | DashMap hash collision | Entity/session stores | Lock contention hotspots |

---

## Signal Horizon Findings (Separate Application)

### Critical

| ID | Finding | Location | Status |
|----|---------|----------|--------|
| WS1-001 | SQL injection in ClickHouse | `hunt/clickhouse.ts:47-95` | **OUTSTANDING** |
| WS2-001 | Missing admin API auth | synapse-pingora admin | Fixed |
| WS3-001 | Plaintext API keys | signal-horizon `prisma/schema.prisma` | **OUTSTANDING** |
| WS2-002 | WebSocket session validation | WebSocket handlers | **OUTSTANDING** |
| WS3-002 | Plaintext PingoraConfig | Database schema | **OUTSTANDING** |
| WS2-006 | Tenant isolation bypass | Hunt queries | **OUTSTANDING** |

### High (24 total, partial list)

| ID | Finding | Status |
|----|---------|--------|
| WS9-001 | Actor fingerprint spoofing | Outstanding |
| WS1-002 | ReDoS in regex operators | Outstanding |
| WS1-003 | SSRF in Synapse proxy | Outstanding |
| WS1-004 | Template injection in fleet commands | Outstanding |
| WS2-003 | Missing rate limiting on auth | Outstanding |
| WS2-004 | Token scope not enforced | Outstanding |
| WS2-005 | Sensor identity verification missing | Outstanding |

### Dependencies

| Type | Count | Status |
|------|-------|--------|
| npm vulnerabilities | 32 | **OUTSTANDING** |
| cargo audit | Not run | **OUTSTANDING** |

---

## Remediation Sessions

### 2026-02-01 (Current Session)
- Fixed: Tarpit connection exhaustion (P1)
- Fixed: Shadow header sanitization (P1)
- Fixed: JSON nesting depth limit (P2)
- Fixed: WebSocket reconnection jitter (P2)
- Verified: 5 findings not applicable

### 2026-02-01 (Previous Session)
- Fixed: 9 critical findings (IP spoofing, ReDoS, CORS, auth bypass, session IDs, MD5, HMAC, logging, SSRF)

---

## Next Priority

1. **P0-SESS-2**: Session Manager TOCTOU race condition
2. **P0-ENT-2**: Unbounded fingerprint memory growth
3. **P1-RATE-1**: Token bucket race condition
4. **P1-WAF-1**: XSS HTML entity encoding bypass
5. **WS1-001**: SQL injection in Signal Horizon (different app)

---

## Notes

- Synapse-pingora deep dive found 71+ findings across 5 security domains
- Initial Jan 31 audit found 68 findings across 9 workstreams
- Many findings overlap between audits
- Signal Horizon findings require separate remediation effort
- npm/cargo dependency audits still needed

---
title: Synapse Feature Reference
---

# Synapse Feature Reference

Complete feature inventory for the Synapse WAF engine.

## Feature Matrix

| Feature | Module | Default | Performance |
| --- | --- | --- | --- |
| WAF Detection | `waf/` | Enabled | ~10–25 μs |
| Entity Tracking | `entity/` | Enabled | 45 ns lookup |
| Actor Fingerprinting | `actor/` | Enabled | — |
| Session Management | `session/` | Enabled | 304 ns |
| DLP Scanning | `dlp/` | Disabled | ~34 μs (4 KB) |
| Rate Limiting | `ratelimit/` | Enabled | 61 ns |
| Bot/Crawler Detection | `crawler/` | Enabled | — |
| Behavioral Profiling | `profiler/` | Enabled | — |
| Campaign Correlation | `correlation/` | Enabled | — |
| Geo/Impossible Travel | `geo/` | Enabled | — |
| Shadow Mirroring | `shadow/` | Disabled | — |
| Tarpit | `tarpit/` | Enabled | — |
| TLS/SNI | `tls/` | Disabled | — |
| CAPTCHA/JS Challenge | `interrogator/` | Enabled | — |
| Honeypot Traps | `trap/` | Enabled | 33 ns |
| Telemetry to Horizon | `telemetry/` | Disabled | — |
| Config Hot-Reload | `reload/` | Enabled | ~240 μs |
| Access Lists | `access/` | Enabled | 156 ns (100 rules) |

## Detection Engine

### WAF Rules

237 production rules covering:

- **SQL injection** — UNION SELECT, boolean conditions, tautologies, stacked queries, blind injection
- **XSS** — script injection, event handlers, SVG payloads, DOM manipulation
- **Path traversal** — directory traversal, null bytes, encoding evasion
- **Command injection** — shell commands, pipe injection, backtick execution

Each rule has a risk score (0–100). Scores accumulate per-request; the request is blocked when the total exceeds `waf_threshold` (default: 70).

**Detection actions:** `block` (HTTP 403), `log` (forward + log), `challenge` (CAPTCHA/JS).

**Evasion resistance:** hex encoding, double encoding, unicode normalization, polyglot payloads. Regex timeout at `waf_regex_timeout_ms` (default: 100 ms) prevents ReDoS.

### DLP Scanning

Data Loss Prevention scans request bodies for sensitive data.

**Supported pattern types (22):**

| Type | Detection Method |
| --- | --- |
| Credit card numbers | Regex + Luhn checksum validation |
| Social Security Numbers | Format validation |
| IBAN | International format matching |
| API keys / tokens | Common key patterns |
| Custom patterns | User-defined regex |

**DLP actions:** `mask` (redact in-place), `hash` (replace with hash), `block` (reject request), `log` (forward + log).

**Performance optimizations:**
- Aho-Corasick prefilter for multi-pattern detection (30–50% faster than sequential regex)
- Content-type short circuit — binary types automatically skipped
- Inspection depth cap — truncate body scan at `max_body_inspection_bytes` (default: 8 KB)

## Entity & Actor Tracking

### Entity Tracking

Track IP addresses and fingerprints across requests with cumulative risk scoring.

- **Risk accumulation** — entity risk grows with each detected threat
- **Automatic blocking** — entities exceeding the block threshold are rejected on sight
- **Decay** — risk scores decay over time to handle transient spikes

### Actor Fingerprinting

Identify devices and users across sessions using behavioral fingerprints.

- **JA4 TLS fingerprinting** — identify clients by their TLS handshake characteristics
- **Header profiling** — analyze header ordering and values for consistency
- **Device identification** — combine fingerprint signals for actor identity

### Session Management

Track user sessions and detect anomalies.

- **Session tracking** — follow sessions across requests
- **Hijack detection** — detect session tokens appearing from unexpected IPs or fingerprints
- **Validation** — 304 ns per-request session validation

## Network Security

### Rate Limiting

Per-client-IP rate limiting with configurable RPS threshold.

- **Pre-TLS** — rate limiting runs in `early_request_filter` before TLS handshake
- **Per-site** — hostname-aware rate limits when using virtual hosts
- **Performance** — 61 ns per check

### Access Lists

IP-based allow/deny lists per site.

- **CIDR support** — allow or deny ranges
- **Per-site** — different ACLs per virtual host
- **Performance** — 156 ns for 100 rules

### Tarpit

Progressive delays against malicious actors.

- **Escalating delays** — response time increases with each blocked request from the same actor
- **Resource conservation** — ties up attacker resources without consuming server resources
- **Configurable** — delay curves and maximum tarpit duration

## Bot Detection

### Crawler Verification

Distinguish legitimate search engine crawlers from bad bots.

- **DNS verification** — reverse/forward DNS check for claimed crawler identities
- **Bad bot blocking** — block known malicious user agents and behavior patterns
- **Honeypot integration** — traps that legitimate crawlers avoid but bots trigger

## Advanced Features

### Behavioral Profiling

Learn expected API behavior and detect anomalies.

- **Schema learning** — automatically learn expected request/response schemas per endpoint
- **Anomaly scoring** — flag requests that deviate from learned patterns
- **Adaptive** — profiles update as traffic patterns change

### Campaign Correlation

Detect coordinated attacks across requests and actors.

- **Pattern matching** — identify similar attack patterns from different sources
- **Temporal correlation** — group attacks happening within a time window
- **Signal aggregation** — combine signals into campaign objects for Horizon

### Shadow Mirroring

Test rules safely against production traffic.

- **Mirror mode** — duplicate traffic to a shadow detection pipeline
- **Comparison reports** — see what would be blocked by new rules
- **Zero impact** — shadow results don't affect production responses

### Impossible Travel Detection

GeoIP-based detection of physically impossible session movements.

- **Speed calculation** — compare geographic distance vs. time between requests
- **Configurable thresholds** — adjust for your user base's travel patterns

### CAPTCHA / JS Challenge

Challenge suspicious requests before blocking.

- **CAPTCHA** — present a CAPTCHA when `detection.action` is `"challenge"`
- **JS challenge** — lightweight JavaScript verification for bot detection
- **Cookie verification** — validate challenge completion tokens

### Honeypot Traps

Hidden endpoints that catch automated scanners.

- **Trap endpoints** — configure fake paths that only automated tools would visit
- **Instant flagging** — any request to a trap immediately escalates the actor's risk
- **Performance** — 33 ns trap matching

### Configuration Hot-Reload

Update configuration without downtime.

- **Atomic swap** — new config replaces old via `RwLock` swap in ~240 μs
- **No dropped requests** — in-flight requests continue on the old config
- **Validation** — new config is parsed and validated before swapping
- **Admin API** — `POST /reload` with admin key authentication

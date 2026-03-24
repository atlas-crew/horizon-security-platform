---
title: Synapse Configuration
---

# Synapse Configuration

Synapse is configured via a YAML file. Copy `config.example.yaml` to `config.yaml` and customize.

## Complete Reference

```yaml
# ── Server ───────────────────────────────────────────────
server:
  listen: "0.0.0.0:6190"     # Proxy listener address
  workers: 0                   # Worker threads (0 = auto-detect CPU count)

shutdown_timeout_secs: 30      # Graceful shutdown drain timeout
waf_threshold: 70              # Global risk threshold (0-100)
waf_enabled: true              # Master WAF enable/disable
log_level: "info"              # trace, debug, info, warn, error
waf_regex_timeout_ms: 100      # ReDoS protection (max 500ms)
# admin_api_key: "..."         # Optional; random key generated if unset

# ── Upstreams ────────────────────────────────────────────
upstreams:
  - host: "127.0.0.1"
    port: 8080
  # - host: "127.0.0.1"
  #   port: 8081              # Add more for round-robin load balancing

# ── Rate Limiting ────────────────────────────────────────
rate_limit:
  rps: 10000                   # Requests per second per client IP
  enabled: true

# ── Logging ──────────────────────────────────────────────
logging:
  level: "info"                # trace, debug, info, warn, error
  format: "text"               # text or json
  access_log: true             # Log every proxied request

# ── Detection ────────────────────────────────────────────
detection:
  sqli: true                   # SQL injection detection
  xss: true                    # Cross-site scripting detection
  path_traversal: true         # Path traversal detection
  command_injection: true      # Command injection detection
  action: "block"              # block, log, or challenge
  block_status: 403            # HTTP status for blocked requests

# ── TLS ──────────────────────────────────────────────────
tls:
  enabled: false
  # cert_path: "/etc/synapse/certs/default.pem"
  # key_path: "/etc/synapse/keys/default.key"
  min_version: "1.2"           # "1.2" or "1.3"
  # per_domain_certs:
  #   - domain: "api.example.com"
  #     cert_path: "/etc/synapse/certs/api.pem"
  #     key_path: "/etc/synapse/keys/api.key"

# ── DLP (Data Loss Prevention) ───────────────────────────
dlp:
  enabled: false
  max_body_size_bytes: 1048576        # 1 MB hard limit
  max_body_inspection_bytes: 8192     # 8 KB inspection cap
  scan_text_only: true                # Skip binary content types
  action: "mask"                      # mask, hash, block, or log
  patterns:
    - name: "credit_card"
      pattern: "\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b"
      action: "mask"
    - name: "ssn"
      pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b"
      action: "block"

# ── Telemetry (Horizon Integration) ─────────────────────
# telemetry:
#   enabled: true
#   horizon_url: "wss://horizon.example.com/ws/sensors"
#   sensor_id: "sensor-abc123"
#   token: "sensor-token-xyz789"
#   batch_size: 50
#   flush_interval_ms: 5000
```

## Section Details

### Server

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `server.listen` | string | `"0.0.0.0:6190"` | Proxy listener `host:port` |
| `server.workers` | integer | `0` | Worker threads. `0` = auto-detect CPU count |
| `shutdown_timeout_secs` | integer | `30` | Seconds to drain connections on shutdown |
| `waf_threshold` | integer | `70` | Risk score threshold for blocking (0–100) |
| `waf_enabled` | boolean | `true` | Master switch for WAF detection |
| `waf_regex_timeout_ms` | integer | `100` | Per-regex timeout for ReDoS protection (max 500) |
| `admin_api_key` | string | (random) | Admin API authentication key |

### Detection

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `detection.sqli` | boolean | `true` | SQL injection detection |
| `detection.xss` | boolean | `true` | Cross-site scripting detection |
| `detection.path_traversal` | boolean | `true` | Path traversal detection |
| `detection.command_injection` | boolean | `true` | Command injection detection |
| `detection.action` | string | `"block"` | `block`, `log`, or `challenge` |
| `detection.block_status` | integer | `403` | HTTP status for blocked requests |

### DLP

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `dlp.enabled` | boolean | `false` | Enable DLP body scanning |
| `dlp.max_body_size_bytes` | integer | `1048576` | Hard limit — reject bodies larger than this |
| `dlp.max_body_inspection_bytes` | integer | `8192` | Inspection cap — truncate (not reject) at this size |
| `dlp.scan_text_only` | boolean | `true` | Skip binary content types automatically |
| `dlp.action` | string | `"mask"` | Default action: `mask`, `hash`, `block`, or `log` |
| `dlp.patterns[].name` | string | — | Pattern identifier |
| `dlp.patterns[].pattern` | string | — | Regex pattern |
| `dlp.patterns[].action` | string | — | Per-pattern action override |

::: tip DLP performance tuning
- **High-security:** Set `max_body_inspection_bytes` to 32768+ for deeper inspection
- **High-throughput APIs:** Keep the default 8 KB cap for sub-100 μs scan times
- Binary content types (images, video, archives) are always skipped automatically
:::

### TLS

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `tls.enabled` | boolean | `false` | Enable TLS termination |
| `tls.cert_path` | string | — | Path to default certificate PEM file |
| `tls.key_path` | string | — | Path to default private key file |
| `tls.min_version` | string | `"1.2"` | Minimum TLS version (`"1.2"` or `"1.3"`) |
| `tls.per_domain_certs` | array | — | Per-domain SNI certificate overrides |

### Hot-Reload

Reload configuration without restarting:

```sh
curl -X POST http://localhost:6191/reload -H "X-Admin-Key: $ADMIN_KEY"
```

Takes ~240 μs via atomic `RwLock` swap. In-flight requests are unaffected.

---
title: Feature Toggles
---

# Feature Toggles

This page documents how to enable and disable features across Horizon and Synapse.

## Synapse Detection Categories

Toggle individual detection categories in `config.yaml`:

```yaml
detection:
  sqli: true              # SQL injection
  xss: true               # Cross-site scripting
  path_traversal: true    # Path traversal
  command_injection: true # Command injection
  action: "block"         # block | log | challenge
```

Set `action: "log"` to monitor without blocking — useful during initial deployment or rule tuning.

::: tip Shadow mode
For zero-risk evaluation, enable [shadow mirroring](../reference/synapse-features#shadow-mirroring) to test detection against live traffic without affecting responses.
:::

## Detection Actions

| Action | Behavior |
| --- | --- |
| `block` | Return HTTP 403 (or `block_status`) immediately |
| `log` | Forward request to upstream, log the detection event |
| `challenge` | Present a CAPTCHA or JS challenge before forwarding |

## DLP (Data Loss Prevention)

```yaml
dlp:
  enabled: true          # Toggle DLP scanning
  action: "mask"         # mask | hash | block | log
  scan_text_only: true   # Skip binary content types
```

DLP supports 22 built-in pattern types including credit cards (with Luhn validation), SSN, IBAN, and API keys.

## Rate Limiting

```yaml
rate_limit:
  enabled: true
  rps: 10000             # Per client IP
```

Set `enabled: false` to disable rate limiting entirely (e.g., behind an upstream rate limiter).

## TLS Termination

```yaml
tls:
  enabled: true
  cert_path: "/etc/synapse/certs/default.pem"
  key_path: "/etc/synapse/keys/default.key"
  min_version: "1.3"     # Recommended for production
```

## Bot / Crawler Detection

Bot detection is part of the `crawler` module. It performs DNS verification of known crawlers and blocks bad bots. Configuration is managed via the admin API.

## Telemetry to Horizon

Enable or disable the Horizon telemetry connection:

```yaml
telemetry:
  enabled: true           # Set to false for standalone mode
  horizon_url: "wss://horizon.example.com/ws/sensors"
  sensor_id: "sensor-id"
  token: "sensor-token"
```

When `enabled: false`, Synapse runs in standalone mode with no hub dependency.

## ClickHouse (Horizon)

Toggle ClickHouse integration in the Horizon `.env`:

```sh
CLICKHOUSE_ENABLED=true   # or false
```

When disabled, hunt queries route exclusively to PostgreSQL and time-series endpoints return HTTP 503.

## WAF Master Switch

Disable all WAF detection while keeping the proxy running:

```yaml
waf_enabled: false
```

This passes all traffic through without inspection — useful for maintenance or debugging.

## Feature Summary

| Feature | Component | Toggle | Default |
| --- | --- | --- | --- |
| SQLi detection | Synapse | `detection.sqli` | `true` |
| XSS detection | Synapse | `detection.xss` | `true` |
| Path traversal | Synapse | `detection.path_traversal` | `true` |
| Command injection | Synapse | `detection.command_injection` | `true` |
| DLP scanning | Synapse | `dlp.enabled` | `false` |
| Rate limiting | Synapse | `rate_limit.enabled` | `true` |
| TLS termination | Synapse | `tls.enabled` | `false` |
| Bot detection | Synapse | Admin API | Enabled |
| Telemetry | Synapse | `telemetry.enabled` | `false` |
| ClickHouse | Horizon | `CLICKHOUSE_ENABLED` | `false` |
| WAF (master) | Synapse | `waf_enabled` | `true` |

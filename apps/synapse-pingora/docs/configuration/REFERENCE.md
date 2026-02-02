# Synapse-Pingora Configuration Reference

Complete reference for all configuration parameters, types, and default values.

## Configuration File Structure

Synapse-Pingora uses YAML configuration files with the following top-level structure:

```yaml
server:     # Global server settings
  ...
sites:      # Per-site configurations (required)
  - ...
rate_limit: # Global rate limiting
  ...
profiler:   # Behavior learning configuration
  ...
```

## Global Server Settings (`server`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `http_addr` | string | `"0.0.0.0:80"` | HTTP listen address |
| `https_addr` | string | `"0.0.0.0:443"` | HTTPS listen address |
| `workers` | integer | `0` | Number of worker threads (0 = auto-detect based on CPU cores) |
| `shutdown_timeout_secs` | integer | `30` | Graceful shutdown timeout in seconds |
| `waf_threshold` | integer | `70` | Global WAF risk threshold (1-100) |
| `waf_enabled` | boolean | `true` | Global WAF enable/disable |
| `log_level` | string | `"info"` | Log level: trace, debug, info, warn, error |
| `admin_api_key` | string | (auto-generated) | API key for admin server (secure random if unset) |
| `trap_config` | object | (see below) | Honeypot trap endpoint configuration |

### Trap Configuration (`server.trap_config`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable trap endpoint detection |
| `paths` | array[string] | (see below) | Path patterns to match as traps (glob syntax) |
| `apply_max_risk` | boolean | `true` | Apply maximum risk score (100.0) on trap hit |
| `extended_tarpit_ms` | integer | `5000` | Extended delay for trapped requests (ms) |
| `alert_telemetry` | boolean | `true` | Send telemetry alerts on trap hits |

**Default trap paths:**
- `/.git/*`, `/.env`, `/.env.*`
- `/admin/backup*`, `/wp-admin/*`, `/phpmyadmin/*`
- `/.svn/*`, `/.htaccess`, `/web.config`, `/config.php`

## Rate Limiting (`rate_limit`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `rps` | integer | `10000` | Requests per second limit |
| `enabled` | boolean | `true` | Enable rate limiting |
| `burst` | integer | `rps * 2` | Burst capacity (defaults to 2x RPS) |

## Profiler Configuration (`profiler`)

Endpoint behavior learning and anomaly detection settings.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable behavior profiling |
| `max_profiles` | integer | `1000` | Maximum endpoint profiles to maintain |
| `max_schemas` | integer | `500` | Maximum learned schemas to maintain |
| `min_samples_for_validation` | integer | `100` | Samples required before validation |

### Anomaly Detection Thresholds

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `payload_z_threshold` | float | `3.0` | Z-score threshold for payload size anomalies |
| `param_z_threshold` | float | `4.0` | Z-score threshold for parameter value anomalies |
| `response_z_threshold` | float | `4.0` | Z-score threshold for response size anomalies |
| `min_stddev` | float | `0.01` | Minimum standard deviation (prevents div/0) |
| `type_ratio_threshold` | float | `0.9` | Type-based anomaly threshold (90% = flag non-conforming) |

### Security Controls

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_type_counts` | integer | `10` | Max type categories per parameter (memory protection) |
| `redact_pii` | boolean | `true` | Redact PII values in anomaly descriptions |
| `freeze_after_samples` | integer | `0` | Freeze baseline after N samples (0 = disabled) |

## Site Configuration (`sites[]`)

Each site represents a virtual host with its own upstream backends and security settings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hostname` | string | Yes | Hostname or wildcard pattern (e.g., `*.example.com`) |
| `upstreams` | array[object] | Yes | Backend servers |
| `tls` | object | No | TLS configuration |
| `waf` | object | No | Site-specific WAF settings |
| `rate_limit` | object | No | Site-specific rate limiting |
| `access_control` | object | No | IP-based access control |
| `headers` | object | No | Header manipulation rules |
| `shadow_mirror` | object | No | Shadow mirroring to honeypots |

### Upstream Configuration (`sites[].upstreams[]`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | string | (required) | Backend host address |
| `port` | integer | (required) | Backend port |
| `weight` | integer | `1` | Load balancing weight |

### TLS Configuration (`sites[].tls`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cert_path` | string | (required) | Path to certificate file (PEM) |
| `key_path` | string | (required) | Path to private key file (PEM) |
| `min_version` | string | `"1.2"` | Minimum TLS version (`1.2` or `1.3`) |

### Site WAF Configuration (`sites[].waf`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable WAF for this site |
| `threshold` | integer | (global) | Risk threshold override (1-100) |
| `rule_overrides` | map[string, string] | `{}` | Rule ID to action overrides |

### Access Control (`sites[].access_control`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `allow` | array[string] | `[]` | CIDR ranges to allow |
| `deny` | array[string] | `[]` | CIDR ranges to deny |
| `default_action` | string | `""` | Default action if no rule matches (`allow` or `deny`) |

### Header Configuration (`sites[].headers`)

```yaml
headers:
  request:
    add: { "X-Custom": "value" }     # Append header
    set: { "X-Override": "value" }   # Replace header
    remove: ["X-Internal"]           # Remove header
  response:
    add: { "X-Frame-Options": "DENY" }
    set: {}
    remove: []
```

### Shadow Mirroring (`sites[].shadow_mirror`)

Mirror suspicious traffic to honeypot endpoints for threat intelligence.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable shadow mirroring |
| `min_risk_score` | float | `40.0` | Minimum risk to trigger mirroring |
| `max_risk_score` | float | `70.0` | Maximum risk (above this, block instead) |
| `honeypot_urls` | array[string] | `[]` | Honeypot endpoint URLs |
| `sampling_rate` | float | `1.0` | Sampling rate 0.0-1.0 (1.0 = 100%) |
| `per_ip_rate_limit` | integer | `10` | Per-IP requests per minute |
| `timeout_secs` | integer | `5` | Honeypot delivery timeout |
| `hmac_secret` | string | (none) | HMAC secret for payload signing |
| `include_body` | boolean | `true` | Include request body in mirror |
| `max_body_size` | integer | `1048576` | Maximum body size to mirror (1MB) |
| `include_headers` | array[string] | (common headers) | Headers to include in mirror |

**Default included headers:** User-Agent, Referer, Origin, Accept, Accept-Language, Accept-Encoding

## Signal Horizon Integration

Configure connection to Signal Horizon Hub for centralized threat intelligence.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable Horizon integration |
| `hub_url` | string | (required if enabled) | WebSocket URL (e.g., `wss://horizon.example.com/ws`) |
| `api_key` | string | (required if enabled) | API key for authentication |
| `sensor_id` | string | (required if enabled) | Unique sensor identifier |
| `sensor_name` | string | (none) | Human-readable sensor name |
| `version` | string | (auto) | Sensor version string |

### Connection Settings

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `reconnect_delay_ms` | integer | `5000` | Reconnect delay in milliseconds |
| `max_reconnect_attempts` | integer | `0` | Max reconnect attempts (0 = unlimited) |
| `circuit_breaker_threshold` | integer | `5` | Consecutive failures before circuit break |
| `circuit_breaker_cooldown_ms` | integer | `300000` | Circuit breaker cooldown (5 minutes) |

### Signal Batching

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `signal_batch_size` | integer | `100` | Signals per batch |
| `signal_batch_delay_ms` | integer | `1000` | Batch delay in milliseconds |
| `heartbeat_interval_ms` | integer | `30000` | Heartbeat interval (30 seconds) |
| `max_queued_signals` | integer | `1000` | Max signals to queue when disconnected |
| `blocklist_cache_ttl_secs` | integer | `3600` | Blocklist cache TTL (1 hour) |

## Minimal Configuration Example

```yaml
sites:
  - hostname: example.com
    upstreams:
      - host: 127.0.0.1
        port: 8080
```

## Full Configuration Example

```yaml
server:
  http_addr: "0.0.0.0:8080"
  https_addr: "0.0.0.0:8443"
  workers: 4
  waf_threshold: 70
  waf_enabled: true
  log_level: info
  trap_config:
    enabled: true
    apply_max_risk: true
    extended_tarpit_ms: 5000

rate_limit:
  rps: 10000
  enabled: true
  burst: 20000

profiler:
  enabled: true
  max_profiles: 1000
  min_samples_for_validation: 100
  payload_z_threshold: 3.0
  redact_pii: true

sites:
  - hostname: api.example.com
    upstreams:
      - host: 10.0.1.10
        port: 8080
        weight: 2
      - host: 10.0.1.11
        port: 8080
        weight: 1
    tls:
      cert_path: /etc/certs/api.example.com.pem
      key_path: /etc/keys/api.example.com.key
      min_version: "1.2"
    waf:
      enabled: true
      threshold: 60
    rate_limit:
      rps: 5000
      enabled: true
    access_control:
      allow:
        - "10.0.0.0/8"
      deny:
        - "0.0.0.0/0"
      default_action: deny
    headers:
      response:
        set:
          X-Frame-Options: "DENY"
          X-Content-Type-Options: "nosniff"
    shadow_mirror:
      enabled: true
      min_risk_score: 40
      max_risk_score: 70
      honeypot_urls:
        - "https://honeypot.internal/mirror"
      sampling_rate: 0.5
      per_ip_rate_limit: 10
```

## Environment Variable Overrides

Critical secrets should be loaded from environment variables:

| Environment Variable | Configuration Path | Description |
|---------------------|-------------------|-------------|
| `SYNAPSE_ADMIN_API_KEY` | `server.admin_api_key` | Admin API authentication key |
| `SYNAPSE_HORIZON_API_KEY` | `horizon.api_key` | Signal Horizon API key |
| `SYNAPSE_HMAC_SECRET` | `sites[].shadow_mirror.hmac_secret` | Honeypot payload signing |

## Validation Rules

The configuration loader enforces these validation rules:

1. **File size limit**: Maximum 10MB configuration file
2. **TLS paths**: Certificate and key files must exist, no path traversal
3. **TLS version**: Must be `1.2` or `1.3`
4. **Hostnames**: No duplicate hostnames across sites
5. **WAF threshold**: Must be 1-100 (0 effectively disables protection)
6. **Shadow mirror**: `min_risk_score` must be less than `max_risk_score`
7. **Sampling rate**: Must be between 0.0 and 1.0
8. **Honeypot URLs**: Must start with `http://` or `https://`
9. **Upstreams**: Each site must have at least one upstream

## Security Considerations

- Store API keys and secrets in environment variables, not config files
- Use `redact_pii: true` in profiler to prevent sensitive data logging
- Set `waf_enabled: true` globally unless intentionally bypassing protection
- Review trap paths to ensure they match your application's attack surface
- Use HMAC signing for shadow mirroring to prevent honeypot spoofing

# Prometheus Metrics (Synapse Pingora Sensor)

Source of truth: `src/metrics.rs` (`MetricsRegistry::render_prometheus()`).

Endpoint:
- Admin API: `GET /metrics` (Prometheus exposition) (`src/api.rs`).

Conventions:
- Prefix: `synapse_`
- Units: `*_us` microseconds, `*_ms` milliseconds
- Histograms: `*_bucket{le="..."}`, `*_sum`, `*_count`
- Label cardinality guards: most `{endpoint=...}` / `{type=...}` maps capped by `MAX_METRICS_MAP_SIZE` (1000) (`src/metrics.rs`).

## Exported Metrics (Current)

HTTP / request lifecycle
- `synapse_requests_total` (counter) Total requests.
- `synapse_requests_by_status{status="2xx|3xx|4xx|5xx"}` (counter) Request totals by status class.
- `synapse_requests_blocked` (counter) Requests treated as blocked/denied.
  - Currently incremented for WAF blocks, rate limits, and challenge failures; no reason breakdown. (`src/main.rs`)
- `synapse_active_requests` (gauge) In-flight requests (RAII guard).
- `synapse_request_duration_us` (histogram) Request duration in microseconds.

WAF
- `synapse_waf_analyzed` (counter) Requests analyzed by WAF.
- `synapse_waf_blocked` (counter) Requests blocked by WAF.
- `synapse_waf_detection_avg_us` (gauge) Average WAF detection time (microseconds).

Profiling (Phase 2)
- `synapse_profiles_active_count` (gauge) Count of tracked endpoints (effectively “unique endpoints seen”; capped).
- `synapse_profiles_total` (gauge) Exported but not updated in prod.
- `synapse_schemas_total` (gauge) Exported but not updated in prod.
- `synapse_profile_updates_total` (counter) Exported but not updated in prod.
- `synapse_schema_violations_total{endpoint="..."}` (counter) Exported but not updated in prod.
- `synapse_anomalies_detected_total{type="..."}` (counter) Exported but not updated in prod.
- `synapse_avg_anomaly_score` (gauge) Exported but not updated in prod.

Backends (upstream)
- `synapse_backend_requests{backend="..."}` (counter) Exported but not updated in prod.
- `synapse_backend_healthy{backend="..."}` (gauge) Exported but not updated in prod.

Shadow mirroring (Phase 7)
- `synapse_shadow_mirrored` (counter) Exported but not updated in prod.
- `synapse_shadow_rate_limited` (counter) Exported but not updated in prod.
- `synapse_shadow_failed` (counter) Exported but not updated in prod.
- `synapse_shadow_bytes_total` (counter) Exported but not updated in prod.
- `synapse_shadow_delivery_avg_us` (gauge) Exported but not updated in prod.

DLP (Phase 4/5)
- `synapse_dlp_scans_total` (counter) Exported but not updated in prod.
- `synapse_dlp_matches_total` (counter) Exported but not updated in prod.
- `synapse_dlp_matches_by_type{type="..."}` (counter) Exported but not updated in prod.
- `synapse_dlp_matches_by_severity{severity="low|medium|high|critical"}` (counter) Exported but not updated in prod.
- `synapse_dlp_violations_dropped` (counter) Exported but not updated in prod.

Signal dispatch (sensor -> hub / horizon facade)
- `synapse_signal_dispatch_total` (counter) Dispatch attempts.
- `synapse_signal_dispatch_success` (counter) Dispatch successes.
- `synapse_signal_dispatch_failure` (counter) Dispatch failures.
- `synapse_signal_dispatch_timeout` (counter) Dispatch timeouts.
- `synapse_signal_dispatch_duration_us` (histogram) Dispatch latency (microseconds).

Tunnel
- Tunnel metrics are exported and separately documented:
  - `docs/observability/TUNNEL_METRICS.md`

Service
- `synapse_uptime_seconds` (gauge) Process uptime in seconds.

## Exported But Not Wired (Dead Today)

These are present in `/metrics` output but never incremented/updated by runtime code paths:
- Backend metrics: `synapse_backend_requests`, `synapse_backend_healthy`
  - `MetricsRegistry::record_backend()` exists but is never called.
- Shadow metrics: `synapse_shadow_*`
  - `MetricsRegistry::record_shadow_*()` exists but is never called.
- DLP metrics: `synapse_dlp_*`
  - `DlpScanner` runs in the proxy but does not currently call `metrics_registry.dlp_metrics().record_*()` methods.
- Profiling metrics (most of them):
  - `synapse_profiles_total`, `synapse_schemas_total`, `synapse_profile_updates_total`,
    `synapse_schema_violations_total`, `synapse_anomalies_detected_total`, `synapse_avg_anomaly_score`
  - `ProfilingMetrics` has APIs to update these, but they are not invoked from prod flows.

## Collected Internally But Not Exported

WAF (in-memory only)
- Challenged/logged counts exist (`WafMetrics.challenged`, `WafMetrics.logged`) but are not emitted to Prometheus.
- Rule match counts exist (rule-id -> count) but are not emitted to Prometheus.

Profiling/bandwidth (in-memory only)
- Request/response bytes totals, max sizes, and a 60-point timeline buffer exist, but are not emitted to Prometheus.

DLP (in-memory only)
- Graph export duration samples exist (`DlpMetrics.graph_export_durations`) but are not emitted to Prometheus.

## Not Yet Covered (Missing Metric Concepts)

High-signal gaps for “what the sensor does” that currently lack first-class Prometheus metrics:
- Deny reasons split (rate-limit vs WAF vs challenge vs horizon blocklist vs access list, etc.).
- Challenge system outcomes: served/validated/invalid/expired by challenge kind.
- Rate-limit detail: per-IP vs global hit rates; current limiter state/queueing if applicable.
- WAF action breakdown: allow/log/challenge/block (currently only “blocked” is exported).
- DLP latency + skip reasons (request vs response; content-type skips; size skips).
- Backend/upstream latency and failure classification (connect vs read timeout vs 5xx, etc.).
- Shadow mirroring throughput/latency and failure reasons.
- Tarpit activity (applied count + delay distribution).
- Horizon/telemetry circuit breaker state + request outcomes.


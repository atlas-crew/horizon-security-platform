// Default configuration values for sensor configuration schemas.
// Rationale notes focus on production tradeoffs (latency, safety, and cost).

// Server
export const DEFAULT_SERVER_HTTP_ADDR = "0.0.0.0:80"; // Standard HTTP port for sensor listener.
export const DEFAULT_SERVER_HTTPS_ADDR = "0.0.0.0:443"; // Standard HTTPS port for TLS listener.
export const DEFAULT_SERVER_WORKERS = 0; // Auto-detect CPU count in production.
export const DEFAULT_SERVER_SHUTDOWN_TIMEOUT_SECS = 30; // Allows in-flight requests to drain on shutdown.
export const DEFAULT_SERVER_WAF_THRESHOLD = 70; // Aligns with default block threshold used across risk scoring.
export const DEFAULT_SERVER_WAF_ENABLED = true; // WAF protection on by default.
export const DEFAULT_SERVER_LOG_LEVEL = "info"; // Balanced verbosity for production.

// Upstreams
export const DEFAULT_UPSTREAM_WEIGHT = 1; // Even load distribution unless explicitly weighted.

// TLS
export const DEFAULT_TLS_MIN_VERSION = "1.2"; // Baseline secure TLS while preserving broad compatibility.

// Access Control
export const DEFAULT_ACCESS_CONTROL_ACTION = "allow"; // Fail-open by default; tighten per site as needed.

// Site WAF
export const DEFAULT_SITE_WAF_ENABLED = true; // Site-level WAF inherits global protection by default.

// Rate Limit
export const DEFAULT_RATE_LIMIT_RPS = 10000; // High default to avoid throttling legit traffic.
export const DEFAULT_RATE_LIMIT_ENABLED = true; // Rate limiting on by default to mitigate abuse.

// Profiler
export const DEFAULT_PROFILER_ENABLED = true; // Enable behavioral learning by default.
export const DEFAULT_PROFILER_MAX_PROFILES = 1000; // Bounded memory footprint for profile cache.
export const DEFAULT_PROFILER_MAX_SCHEMAS = 500; // Limits schema explosion for high-cardinality endpoints.
export const DEFAULT_PROFILER_MIN_SAMPLES = 100; // Avoids premature profiling with too few samples.
export const DEFAULT_PROFILER_PAYLOAD_Z = 3.0; // 3σ threshold for payload anomalies.
export const DEFAULT_PROFILER_PARAM_Z = 4.0; // Slightly stricter for params to reduce noise.
export const DEFAULT_PROFILER_RESPONSE_Z = 4.0; // Aligns with param threshold for response anomalies.
export const DEFAULT_PROFILER_MIN_STDDEV = 0.01; // Prevents division by zero and overfitting.
export const DEFAULT_PROFILER_TYPE_RATIO = 0.9; // Allows minor variance while keeping type integrity.
export const DEFAULT_PROFILER_MAX_TYPE_COUNTS = 10; // Caps learned enum size for memory safety.
export const DEFAULT_PROFILER_REDACT_PII = true; // Avoids storing sensitive values.
export const DEFAULT_PROFILER_FREEZE_AFTER_SAMPLES = 0; // 0 means continuous learning.

// DLP (Data Loss Prevention)
export const DEFAULT_DLP_ENABLED = true; // On by default to detect sensitive data leaks.
export const DEFAULT_DLP_FAST_MODE = false; // Full pattern set for higher detection fidelity.
export const DEFAULT_DLP_SCAN_TEXT_ONLY = true; // Skip binary to reduce false positives and CPU.
export const DEFAULT_DLP_MAX_SCAN_SIZE_BYTES = 5 * 1024 * 1024; // 5MB cap to bound latency and memory.
export const DEFAULT_DLP_MAX_BODY_INSPECTION_BYTES = 8 * 1024; // 8KB sample keeps scanning cheap.
export const DEFAULT_DLP_MAX_MATCHES = 100; // Prevents match explosion in hot paths.

// Block Page
export const DEFAULT_BLOCK_PAGE_SHOW_REQUEST_ID = true; // Helps support correlate incidents.
export const DEFAULT_BLOCK_PAGE_SHOW_TIMESTAMP = true; // Aids timeline reconstruction.
export const DEFAULT_BLOCK_PAGE_SHOW_CLIENT_IP = false; // Avoids exposing client IP on shared screens.
export const DEFAULT_BLOCK_PAGE_SHOW_RULE_ID = false; // Prevents rule fingerprinting.

// Crawler/Bot Detection
export const DEFAULT_CRAWLER_ENABLED = true; // Reduce automated abuse by default.
export const DEFAULT_CRAWLER_VERIFY_LEGIT = true; // DNS verification reduces false positives.
export const DEFAULT_CRAWLER_BLOCK_BAD_BOTS = true; // Block known bad bots early.
export const DEFAULT_CRAWLER_DNS_FAILURE_POLICY = "apply_risk_penalty" as const; // Fail-soft on transient DNS.
export const DEFAULT_CRAWLER_DNS_CACHE_TTL_SECS = 300; // 5m cache to reduce DNS load.
export const DEFAULT_CRAWLER_VERIFICATION_CACHE_TTL_SECS = 3600; // 1h cache for known good crawlers.
export const DEFAULT_CRAWLER_MAX_CACHE_ENTRIES = 50000; // Bound memory for crawler cache.
export const DEFAULT_CRAWLER_DNS_TIMEOUT_MS = 2000; // 2s timeout avoids long tail latency.
export const DEFAULT_CRAWLER_MAX_CONCURRENT_DNS_LOOKUPS = 100; // Prevent DNS fan-out overload.
export const DEFAULT_CRAWLER_DNS_FAILURE_RISK_PENALTY = 20; // Moderate penalty to surface suspicious bots.

// Tarpit (Slow-Drip Defense)
export const DEFAULT_TARPIT_ENABLED = true; // Enabled to slow abusive actors.
export const DEFAULT_TARPIT_BASE_DELAY_MS = 1000; // 1s base delay impacts bots more than humans.
export const DEFAULT_TARPIT_MAX_DELAY_MS = 30000; // 30s cap avoids tying up workers too long.
export const DEFAULT_TARPIT_PROGRESSIVE_MULTIPLIER = 1.5; // Gentle exponential ramp.
export const DEFAULT_TARPIT_MAX_STATES = 10000; // Bound memory for tarpit state.
export const DEFAULT_TARPIT_DECAY_THRESHOLD_MS = 5 * 60 * 1000; // 5m decay keeps state manageable.
export const DEFAULT_TARPIT_CLEANUP_THRESHOLD_MS = 30 * 60 * 1000; // 30m cleanup prevents stale buildup.
export const DEFAULT_TARPIT_MAX_CONCURRENT = 1000; // Concurrency cap protects throughput.

// Impossible Travel
export const DEFAULT_TRAVEL_MAX_SPEED_KMH = 800; // Commercial jet cruise speed baseline.
export const DEFAULT_TRAVEL_MIN_DISTANCE_KM = 100; // Ignore small hops to reduce noise.
export const DEFAULT_TRAVEL_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h window balances accuracy vs storage.
export const DEFAULT_TRAVEL_MAX_HISTORY_PER_USER = 100; // Caps memory per user.

// Entity Store
export const DEFAULT_ENTITY_ENABLED = true; // Track repeat offenders by default.
export const DEFAULT_ENTITY_MAX_ENTITIES = 100000; // Fits in memory for mid-size fleets.
export const DEFAULT_ENTITY_RISK_DECAY_PER_MINUTE = 10; // Predictable decay while retaining signal.
export const DEFAULT_ENTITY_BLOCK_THRESHOLD = 70; // Aligns with global WAF default threshold.
export const DEFAULT_ENTITY_MAX_RULES_PER_ENTITY = 50; // Prevents unbounded rule history.
export const DEFAULT_ENTITY_MAX_RISK = 100; // Normalized risk scale for UI/reporting.
export const DEFAULT_ENTITY_MAX_ANOMALIES = 100; // Bounds anomaly list size.

// Default configuration values for the Pingora advanced config UI.
// Rationale notes focus on production impact: latency, cost, and safety tradeoffs.

// DLP (Data Loss Prevention)
export const DEFAULT_DLP_ENABLED = true; // On by default to catch sensitive data exfiltration.
export const DEFAULT_DLP_FAST_MODE = false; // Full pattern set for higher fidelity at moderate CPU cost.
export const DEFAULT_DLP_SCAN_TEXT_ONLY = true; // Avoids binary payload scanning to reduce false positives.
export const DEFAULT_DLP_MAX_SCAN_SIZE_BYTES = 5 * 1024 * 1024; // 5MB cap balances detection depth vs. request latency.
export const DEFAULT_DLP_MAX_BODY_INSPECTION_BYTES = 8 * 1024; // 8KB sampling keeps CPU bounded for large bodies.
export const DEFAULT_DLP_MAX_MATCHES = 100; // Limits match explosion to protect CPU and response size.

// Block Page
export const DEFAULT_BLOCK_PAGE_SHOW_REQUEST_ID = true; // Helps support triage without exposing internal details.
export const DEFAULT_BLOCK_PAGE_SHOW_TIMESTAMP = true; // Aids incident correlation in logs.
export const DEFAULT_BLOCK_PAGE_SHOW_CLIENT_IP = false; // Avoids exposing client IP on shared screens.
export const DEFAULT_BLOCK_PAGE_SHOW_RULE_ID = false; // Prevents rule fingerprinting by attackers.

// Crawler/Bot Detection
export const DEFAULT_CRAWLER_ENABLED = true; // Enabled to reduce automated abuse by default.
export const DEFAULT_CRAWLER_VERIFY_LEGIT = true; // DNS verification reduces false positives for real crawlers.
export const DEFAULT_CRAWLER_BLOCK_BAD_BOTS = true; // Block known bad bots early to save resources.
export const DEFAULT_CRAWLER_DNS_FAILURE_POLICY = 'apply_risk_penalty' as const; // Fail-soft: avoid blocking on transient DNS.
export const DEFAULT_CRAWLER_DNS_CACHE_TTL_SECS = 300; // 5m cache lowers DNS load without staleness risk.
export const DEFAULT_CRAWLER_DNS_TIMEOUT_MS = 2000; // 2s balances verification accuracy vs latency.
export const DEFAULT_CRAWLER_MAX_CONCURRENT_DNS_LOOKUPS = 100; // Prevents DNS fan-out from starving workers.
export const DEFAULT_CRAWLER_DNS_FAILURE_RISK_PENALTY = 20; // Moderate penalty to surface noisy bots.

// Tarpit (Slow-Drip Defense)
export const DEFAULT_TARPIT_ENABLED = true; // Enabled to slow abusive actors by default.
export const DEFAULT_TARPIT_BASE_DELAY_MS = 1000; // 1s delay is noticeable to bots but tolerable for humans.
export const DEFAULT_TARPIT_MAX_DELAY_MS = 30000; // 30s cap avoids tying up workers too long.
export const DEFAULT_TARPIT_PROGRESSIVE_MULTIPLIER = 1.5; // Gentle exponential ramp; avoids sudden hard blocks.
export const DEFAULT_TARPIT_MAX_CONCURRENT = 1000; // Concurrency cap protects overall throughput.
export const DEFAULT_TARPIT_DECAY_THRESHOLD_MS = 5 * 60 * 1000; // 5m decay keeps memory bounded.

// Entity Store
export const DEFAULT_ENTITY_ENABLED = true; // On by default to track repeat offenders.
export const DEFAULT_ENTITY_MAX_ENTITIES = 100000; // Fits in memory for most mid-size fleets.
export const DEFAULT_ENTITY_RISK_DECAY_PER_MINUTE = 10; // Decays risk predictably while keeping persistence.
export const DEFAULT_ENTITY_BLOCK_THRESHOLD = 70; // Aligns with global WAF default threshold.
export const DEFAULT_ENTITY_MAX_RISK = 100; // Normalized risk scale for UI/reporting.
export const DEFAULT_ENTITY_MAX_RULES_PER_ENTITY = 50; // Prevents unbounded rule history growth.

// Impossible Travel
export const DEFAULT_TRAVEL_MAX_SPEED_KMH = 800; // Commercial jet cruise speed baseline.
export const DEFAULT_TRAVEL_MIN_DISTANCE_KM = 100; // Ignore small local hops to reduce noise.
export const DEFAULT_TRAVEL_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h window balances accuracy vs storage.
export const DEFAULT_TRAVEL_MAX_HISTORY_PER_USER = 100; // Protects memory for high-volume users.

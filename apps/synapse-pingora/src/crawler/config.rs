//! Configuration for crawler detection.
//!
//! ## Security
//! - `dns_failure_policy` controls fail-secure behavior during DNS outages
//! - `max_concurrent_dns_lookups` prevents resource exhaustion at scale
//! - `max_stats_entries` bounds memory usage from novel bot names

use serde::{Deserialize, Serialize};

/// Policy for handling DNS verification failures.
///
/// This determines what happens when DNS lookup fails (timeout, server error, etc.)
/// for a request claiming to be a legitimate crawler like Googlebot.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum DnsFailurePolicy {
    /// Allow request through (fail-open) - NOT RECOMMENDED for production
    /// Use only for debugging or low-security environments.
    Allow,

    /// Apply risk penalty and continue (default, fail-cautious)
    /// Request proceeds but with elevated risk score for downstream decisions.
    #[default]
    ApplyRiskPenalty,

    /// Block request entirely (fail-secure)
    /// Most restrictive - may cause false positives during DNS outages.
    Block,
}

/// Configuration for crawler detection and verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerConfig {
    /// Enable crawler detection
    pub enabled: bool,

    /// DNS cache TTL in seconds (default: 300 = 5 min)
    pub dns_cache_ttl_secs: u64,

    /// Verification result cache TTL in seconds (default: 3600 = 1 hour)
    pub verification_cache_ttl_secs: u64,

    /// Maximum cache entries (default: 50000 for high-traffic deployments)
    pub max_cache_entries: u64,

    /// DNS lookup timeout in milliseconds (default: 2000 - reduced from 5000)
    pub dns_timeout_ms: u64,

    /// Maximum concurrent DNS lookups to prevent resource exhaustion (default: 100)
    pub max_concurrent_dns_lookups: usize,

    /// Verify legitimate crawlers via DNS
    pub verify_legitimate_crawlers: bool,

    /// Block detected bad bots
    pub block_bad_bots: bool,

    /// Policy when DNS verification fails (timeout, server error, etc.)
    #[serde(default)]
    pub dns_failure_policy: DnsFailurePolicy,

    /// Risk penalty to apply when DNS verification fails (only used with ApplyRiskPenalty policy)
    pub dns_failure_risk_penalty: u32,

    /// Maximum entries in per-crawler/per-bot stats maps (prevents unbounded growth)
    pub max_stats_entries: usize,
}

impl Default for CrawlerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            dns_cache_ttl_secs: 300,
            verification_cache_ttl_secs: 3600,
            // Increased from 10,000 for high-traffic deployments
            max_cache_entries: 50_000,
            // Reduced from 5000ms to prevent bottlenecks
            dns_timeout_ms: 2_000,
            // Limit concurrent DNS lookups to prevent resource exhaustion
            max_concurrent_dns_lookups: 100,
            verify_legitimate_crawlers: true,
            block_bad_bots: true,
            // Default to fail-cautious: apply risk penalty but don't block
            dns_failure_policy: DnsFailurePolicy::ApplyRiskPenalty,
            dns_failure_risk_penalty: 50,
            // Limit stats map sizes to prevent unbounded growth
            max_stats_entries: 1000,
        }
    }
}

impl CrawlerConfig {
    /// Validate configuration values
    pub fn validate(&self) -> Result<(), String> {
        if self.dns_timeout_ms == 0 {
            return Err("dns_timeout_ms must be greater than 0".to_string());
        }
        if self.dns_timeout_ms > 30_000 {
            return Err("dns_timeout_ms should not exceed 30 seconds".to_string());
        }
        if self.max_concurrent_dns_lookups == 0 {
            return Err("max_concurrent_dns_lookups must be greater than 0".to_string());
        }
        if self.dns_failure_risk_penalty > 100 {
            return Err("dns_failure_risk_penalty should not exceed 100".to_string());
        }
        Ok(())
    }
}

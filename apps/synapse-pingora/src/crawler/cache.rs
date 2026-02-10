//! Caching for crawler verification results.

use moka::sync::Cache;
use std::net::IpAddr;
use std::time::Duration;

use super::config::CrawlerConfig;
use super::detector::CrawlerVerificationResult;

/// Cache for crawler verification results and DNS lookups.
#[derive(Debug)]
pub struct VerificationCache {
    /// Cache for full verification results
    verification_cache: Cache<String, CrawlerVerificationResult>,
    /// Cache for DNS lookups (IP -> hostname)
    dns_cache: Cache<IpAddr, Option<String>>,
}

impl VerificationCache {
    /// Create a new verification cache.
    pub fn new(config: &CrawlerConfig) -> Self {
        let verification_cache = Cache::builder()
            .max_capacity(config.max_cache_entries)
            .time_to_live(Duration::from_secs(config.verification_cache_ttl_secs))
            .build();

        let dns_cache = Cache::builder()
            .max_capacity(config.max_cache_entries)
            .time_to_live(Duration::from_secs(config.dns_cache_ttl_secs))
            .build();

        Self {
            verification_cache,
            dns_cache,
        }
    }

    /// Generate cache key for verification result.
    pub fn cache_key(user_agent: &str, ip: IpAddr) -> String {
        // Use a simple hash of UA + IP as the key
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        user_agent.hash(&mut hasher);
        ip.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Get cached verification result.
    pub fn get_verification(&self, key: &str) -> Option<CrawlerVerificationResult> {
        self.verification_cache.get(key)
    }

    /// Cache a verification result.
    pub fn put_verification(&self, key: String, result: CrawlerVerificationResult) {
        self.verification_cache.insert(key, result);
    }

    /// Get cached DNS result.
    pub fn get_dns(&self, ip: IpAddr) -> Option<Option<String>> {
        self.dns_cache.get(&ip)
    }

    /// Cache a DNS result.
    pub fn put_dns(&self, ip: IpAddr, hostname: Option<String>) {
        self.dns_cache.insert(ip, hostname);
    }

    /// Get cache statistics.
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            verification_entries: self.verification_cache.entry_count() as usize,
            dns_entries: self.dns_cache.entry_count() as usize,
        }
    }
}

/// Cache statistics.
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub verification_entries: usize,
    pub dns_entries: usize,
}

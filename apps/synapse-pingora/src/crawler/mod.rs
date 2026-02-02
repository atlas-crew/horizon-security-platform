//! Crawler Detection and Bad Bot Identification.
//!
//! Features:
//! - 18 legitimate crawler definitions with DNS verification
//! - 45+ bad bot signatures for attack tools and scrapers
//! - Async DNS verification using trust-dns-resolver
//! - LRU cache with TTL using moka crate

pub mod config;
pub mod known_crawlers;
pub mod bad_bots;
pub mod dns_resolver;
pub mod cache;
pub mod detector;

pub use config::{CrawlerConfig, DnsFailurePolicy};
pub use known_crawlers::{CrawlerDefinition, KNOWN_CRAWLERS};
pub use bad_bots::{BadBotSignature, BadBotSeverity, BAD_BOT_SIGNATURES};
pub use dns_resolver::DnsResolver;
pub use cache::VerificationCache;
pub use detector::{
    CrawlerDetector, CrawlerDetection, CrawlerVerificationResult,
    CrawlerStats, CrawlerStatsSnapshot, VerificationMethod,
};

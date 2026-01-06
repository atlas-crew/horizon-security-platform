//! Synapse-Pingora: High-performance WAF proxy using Cloudflare Pingora.
//!
//! This library provides multi-site reverse proxy capabilities with integrated
//! WAF detection using the libsynapse engine.
//!
//! # Phase 1 Modules (Core Features)
//!
//! - [`vhost`] - Virtual host matching for multi-site routing
//! - [`config`] - Configuration loading and validation
//! - [`tls`] - TLS certificate management with SNI support
//! - [`health`] - Health check endpoint for monitoring
//! - [`site_waf`] - Per-site WAF configuration management
//!
//! # Phase 2 Modules (Management Features)
//!
//! - [`metrics`] - Prometheus metrics endpoint
//! - [`reload`] - Configuration hot-reload via SIGHUP
//! - [`access`] - CIDR-based allow/deny access lists
//! - [`ratelimit`] - Per-site rate limiting with token bucket
//! - [`api`] - Management HTTP API

// Phase 1: Core Features
pub mod config;
pub mod health;
pub mod site_waf;
pub mod tls;
pub mod vhost;

// Phase 2: Management Features
pub mod access;
pub mod api;
pub mod metrics;
pub mod ratelimit;
pub mod reload;

// Re-export commonly used types from Phase 1
pub use config::{ConfigFile, ConfigLoader, GlobalConfig};
pub use health::{HealthChecker, HealthResponse, HealthStatus};
pub use site_waf::{SiteWafConfig, SiteWafManager, WafAction};
pub use tls::{TlsManager, TlsVersion};
pub use vhost::{SiteConfig, VhostMatcher};

// Re-export commonly used types from Phase 2
pub use access::{AccessList, AccessListManager, AccessDecision};
pub use api::{ApiHandler, ApiResponse};
pub use metrics::MetricsRegistry;
pub use ratelimit::{RateLimitConfig, RateLimitManager, RateLimitDecision};
pub use reload::{ConfigReloader, ReloadResult};

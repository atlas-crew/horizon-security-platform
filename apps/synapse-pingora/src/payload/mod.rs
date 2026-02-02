//! Payload Profiling subsystem for bandwidth tracking and anomaly detection.
//!
//! Features:
//! - Per-endpoint statistics with sliding windows
//! - Per-entity (IP) bandwidth tracking
//! - Anomaly detection: oversized payloads, bandwidth spikes, exfiltration patterns

pub mod config;
pub mod endpoint_stats;
pub mod entity_bandwidth;
pub mod anomaly;
pub mod manager;

pub use config::PayloadConfig;
pub use endpoint_stats::{EndpointPayloadStats, EndpointPayloadStatsSnapshot, PayloadWindow, SizeStats};
pub use entity_bandwidth::{EntityBandwidth, BandwidthBucket};
pub use anomaly::{PayloadAnomaly, PayloadAnomalyType, PayloadAnomalySeverity, PayloadAnomalyMetadata};
pub use manager::{PayloadManager, PayloadSummary, EndpointSortBy};

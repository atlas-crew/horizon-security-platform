//! Configuration for the Payload Profiling subsystem.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::anomaly::PayloadAnomalyType;

/// Configuration for payload profiling.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayloadConfig {
    /// Enable payload profiling
    pub enabled: bool,
    /// Window duration in milliseconds (default: 60000 = 1 minute)
    pub window_duration_ms: u64,
    /// Maximum number of windows to keep (default: 60 = 1 hour)
    pub max_windows: usize,
    /// Maximum endpoints to track (LRU eviction)
    pub max_endpoints: usize,
    /// Maximum entities to track (LRU eviction)
    pub max_entities: usize,
    /// Threshold for oversized payload detection (multiplier of p99)
    pub oversize_threshold: f64,
    /// Threshold for bandwidth spike detection (multiplier of avg)
    pub bandwidth_spike_threshold: f64,
    /// Minimum requests before anomaly detection activates
    pub warmup_requests: u32,
    /// Threshold for exfiltration pattern (response/request ratio)
    pub exfiltration_ratio_threshold: f64,
    /// Threshold for upload pattern (request/response ratio)
    pub upload_ratio_threshold: f64,
    /// Minimum payload size to flag as large (bytes)
    pub min_large_payload_bytes: u64,
    /// Maximum timeline buckets for bandwidth history
    pub timeline_max_buckets: usize,
    /// Risk scores per anomaly type
    pub anomaly_risk: HashMap<PayloadAnomalyType, f64>,
}

impl Default for PayloadConfig {
    fn default() -> Self {
        let mut anomaly_risk = HashMap::new();
        anomaly_risk.insert(PayloadAnomalyType::OversizedRequest, 20.0);
        anomaly_risk.insert(PayloadAnomalyType::OversizedResponse, 15.0);
        anomaly_risk.insert(PayloadAnomalyType::BandwidthSpike, 25.0);
        anomaly_risk.insert(PayloadAnomalyType::ExfiltrationPattern, 40.0);
        anomaly_risk.insert(PayloadAnomalyType::UploadPattern, 35.0);

        Self {
            enabled: true,
            window_duration_ms: 60_000,
            max_windows: 60,
            max_endpoints: 5_000,
            max_entities: 10_000,
            oversize_threshold: 3.0,
            bandwidth_spike_threshold: 5.0,
            warmup_requests: 100,
            exfiltration_ratio_threshold: 100.0,
            upload_ratio_threshold: 100.0,
            min_large_payload_bytes: 100_000,
            timeline_max_buckets: 1_440,
            anomaly_risk,
        }
    }
}

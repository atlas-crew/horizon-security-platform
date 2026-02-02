//! Configuration for the trends subsystem.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::types::AnomalyType;

/// Configuration for the trends subsystem.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendsConfig {
    /// Whether trends tracking is enabled
    pub enabled: bool,

    /// Size of each time bucket in milliseconds (default: 60000 = 1 minute)
    pub bucket_size_ms: u64,

    /// How long to retain data in hours (default: 24)
    pub retention_hours: u32,

    /// Maximum signals per bucket (default: 10000)
    pub max_signals_per_bucket: usize,

    /// Anomaly detection check interval in milliseconds (default: 60000)
    pub anomaly_check_interval_ms: u64,

    /// Risk scores to apply for each anomaly type (0 = detection only)
    pub anomaly_risk: HashMap<AnomalyType, u32>,

    /// Maximum entities to track (LRU eviction)
    pub max_entities: usize,

    /// Maximum recent signals to cache per entity
    pub max_recent_signals: usize,

    /// Maximum anomalies to retain
    pub max_anomalies: usize,
}

impl Default for TrendsConfig {
    fn default() -> Self {
        let mut anomaly_risk = HashMap::new();

        // Authentication/session anomalies
        anomaly_risk.insert(AnomalyType::FingerprintChange, 30);
        anomaly_risk.insert(AnomalyType::SessionSharing, 50);
        anomaly_risk.insert(AnomalyType::TokenReuse, 40);
        anomaly_risk.insert(AnomalyType::VelocitySpike, 15);
        anomaly_risk.insert(AnomalyType::RotationPattern, 35);
        anomaly_risk.insert(AnomalyType::TimingAnomaly, 10);
        anomaly_risk.insert(AnomalyType::ImpossibleTravel, 25);

        // JA4 fingerprint anomalies
        anomaly_risk.insert(AnomalyType::Ja4RotationPattern, 45);
        anomaly_risk.insert(AnomalyType::Ja4IpCluster, 35);
        anomaly_risk.insert(AnomalyType::Ja4BrowserSpoofing, 60);
        anomaly_risk.insert(AnomalyType::Ja4hChange, 25);

        // Payload anomalies
        anomaly_risk.insert(AnomalyType::OversizedRequest, 20);
        anomaly_risk.insert(AnomalyType::OversizedResponse, 15);
        anomaly_risk.insert(AnomalyType::BandwidthSpike, 25);
        anomaly_risk.insert(AnomalyType::ExfiltrationPattern, 40);
        anomaly_risk.insert(AnomalyType::UploadPattern, 35);

        Self {
            enabled: true,
            bucket_size_ms: 60_000, // 1 minute
            retention_hours: 24,
            max_signals_per_bucket: 10_000,
            anomaly_check_interval_ms: 60_000,
            anomaly_risk,
            max_entities: 10_000,
            max_recent_signals: 100,
            max_anomalies: 1_000,
        }
    }
}

impl TrendsConfig {
    /// Create a disabled configuration.
    pub fn disabled() -> Self {
        Self {
            enabled: false,
            ..Default::default()
        }
    }

    /// Get the risk score for an anomaly type.
    pub fn get_anomaly_risk(&self, anomaly_type: &AnomalyType) -> u32 {
        self.anomaly_risk.get(anomaly_type).copied().unwrap_or(0)
    }

    /// Calculate bucket count based on retention.
    pub fn bucket_count(&self) -> usize {
        let retention_ms = self.retention_hours as u64 * 60 * 60 * 1000;
        (retention_ms / self.bucket_size_ms) as usize
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = TrendsConfig::default();
        assert!(config.enabled);
        assert_eq!(config.bucket_size_ms, 60_000);
        assert_eq!(config.retention_hours, 24);
        assert_eq!(config.max_signals_per_bucket, 10_000);
    }

    #[test]
    fn test_disabled_config() {
        let config = TrendsConfig::disabled();
        assert!(!config.enabled);
    }

    #[test]
    fn test_anomaly_risk_lookup() {
        let config = TrendsConfig::default();
        assert_eq!(config.get_anomaly_risk(&AnomalyType::FingerprintChange), 30);
        assert_eq!(config.get_anomaly_risk(&AnomalyType::SessionSharing), 50);
    }

    #[test]
    fn test_bucket_count() {
        let config = TrendsConfig::default();
        // 24 hours * 60 min/hour = 1440 buckets
        assert_eq!(config.bucket_count(), 1440);
    }
}

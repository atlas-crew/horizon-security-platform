//! Payload anomaly types and detection results.

use serde::{Deserialize, Serialize};
use std::time::Instant;

/// Types of payload anomalies detected.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PayloadAnomalyType {
    /// Request size exceeds baseline p99 × threshold
    OversizedRequest,
    /// Response size exceeds baseline p99 × threshold
    OversizedResponse,
    /// Sudden increase in bytes/min for entity
    BandwidthSpike,
    /// Large responses with small requests (data theft pattern)
    ExfiltrationPattern,
    /// Large requests with small responses (malware upload pattern)
    UploadPattern,
}

/// Severity of detected anomaly.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PayloadAnomalySeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Metadata for different anomaly types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PayloadAnomalyMetadata {
    /// Oversized request/response metadata
    Oversize {
        actual_bytes: u64,
        expected_bytes: u64,
        threshold: f64,
        percentile: f64,
    },
    /// Bandwidth spike metadata
    BandwidthSpike {
        current_bytes_per_min: u64,
        avg_bytes_per_min: u64,
        threshold: f64,
    },
    /// Exfiltration/upload pattern metadata
    DataPattern {
        request_bytes: u64,
        response_bytes: u64,
        ratio: f64,
        threshold: f64,
    },
}

/// A detected payload anomaly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayloadAnomaly {
    /// Unique identifier
    pub id: String,
    /// Type of anomaly
    pub anomaly_type: PayloadAnomalyType,
    /// Severity level
    pub severity: PayloadAnomalySeverity,
    /// Detection timestamp (Unix ms for serialization)
    #[serde(skip)]
    pub detected_at_instant: Option<Instant>,
    /// Detection timestamp as Unix milliseconds
    pub detected_at: i64,
    /// Endpoint template where anomaly was detected
    pub template: String,
    /// Entity (IP) that triggered the anomaly
    pub entity_id: String,
    /// Human-readable description
    pub description: String,
    /// Type-specific metadata
    pub metadata: PayloadAnomalyMetadata,
    /// Risk score applied to entity (if auto-risk enabled)
    pub risk_applied: Option<f64>,
}

impl PayloadAnomaly {
    /// Create a new anomaly with current timestamp.
    pub fn new(
        anomaly_type: PayloadAnomalyType,
        severity: PayloadAnomalySeverity,
        template: String,
        entity_id: String,
        description: String,
        metadata: PayloadAnomalyMetadata,
    ) -> Self {
        let now = Instant::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            anomaly_type,
            severity,
            detected_at_instant: Some(now),
            detected_at: chrono::Utc::now().timestamp_millis(),
            template,
            entity_id,
            description,
            metadata,
            risk_applied: None,
        }
    }

    /// Set the risk score that was applied.
    pub fn with_risk(mut self, risk: f64) -> Self {
        self.risk_applied = Some(risk);
        self
    }
}

impl PayloadAnomalyType {
    /// Get default severity for this anomaly type.
    pub fn default_severity(&self) -> PayloadAnomalySeverity {
        match self {
            Self::OversizedRequest => PayloadAnomalySeverity::Medium,
            Self::OversizedResponse => PayloadAnomalySeverity::Low,
            Self::BandwidthSpike => PayloadAnomalySeverity::High,
            Self::ExfiltrationPattern => PayloadAnomalySeverity::Critical,
            Self::UploadPattern => PayloadAnomalySeverity::High,
        }
    }
}

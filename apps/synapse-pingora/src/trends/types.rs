//! Type definitions for the Trends subsystem.
//!
//! Tracks time-series signals for auth tokens, device fingerprints,
//! network signals, and behavioral patterns.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// ============================================================================
// Signal Categories & Types
// ============================================================================

/// High-level signal categories for fingerprinting and tracking.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SignalCategory {
    /// JWT, session tokens, API keys
    AuthToken,
    /// HTTP fingerprint, client hints
    Device,
    /// IP, TLS fingerprint, ASN
    Network,
    /// Request timing, navigation patterns
    Behavioral,
}

impl std::fmt::Display for SignalCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SignalCategory::AuthToken => write!(f, "auth_token"),
            SignalCategory::Device => write!(f, "device"),
            SignalCategory::Network => write!(f, "network"),
            SignalCategory::Behavioral => write!(f, "behavioral"),
        }
    }
}

/// Specific signal types within each category.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SignalType {
    // Auth token types
    Jwt,
    ApiKey,
    SessionCookie,
    Bearer,
    Basic,
    CustomAuth,

    // Device types
    HttpFingerprint,
    HeaderOrder,
    ClientHints,
    AcceptPattern,

    // Network types
    Ip,
    TlsFingerprint,
    Asn,
    Geo,
    Ja4,
    Ja4h,

    // Behavioral types
    Timing,
    Navigation,
    RequestPattern,
    DlpMatch,
}

impl SignalType {
    /// Get the category for this signal type.
    pub fn category(&self) -> SignalCategory {
        match self {
            SignalType::Jwt
            | SignalType::ApiKey
            | SignalType::SessionCookie
            | SignalType::Bearer
            | SignalType::Basic
            | SignalType::CustomAuth => SignalCategory::AuthToken,

            SignalType::HttpFingerprint
            | SignalType::HeaderOrder
            | SignalType::ClientHints
            | SignalType::AcceptPattern => SignalCategory::Device,

            SignalType::Ip
            | SignalType::TlsFingerprint
            | SignalType::Asn
            | SignalType::Geo
            | SignalType::Ja4
            | SignalType::Ja4h => SignalCategory::Network,

            SignalType::Timing
            | SignalType::Navigation
            | SignalType::RequestPattern
            | SignalType::DlpMatch => SignalCategory::Behavioral,
        }
    }
}

// ============================================================================
// Signal Data Structures
// ============================================================================

/// Base signal interface - recorded for every relevant request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signal {
    /// UUID
    pub id: String,
    /// Unix timestamp in milliseconds
    pub timestamp: i64,
    /// Signal category
    pub category: SignalCategory,
    /// Signal type
    pub signal_type: SignalType,
    /// The actual fingerprint/token hash/signal value
    pub value: String,
    /// Entity ID (usually IP address)
    pub entity_id: String,
    /// Session ID if available
    pub session_id: Option<String>,
    /// Category-specific metadata
    pub metadata: SignalMetadata,
}

/// Metadata varies by signal category.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SignalMetadata {
    AuthToken(AuthTokenMetadata),
    Device(DeviceMetadata),
    Network(NetworkMetadata),
    Behavioral(BehavioralMetadata),
}

impl Default for SignalMetadata {
    fn default() -> Self {
        SignalMetadata::Behavioral(BehavioralMetadata::default())
    }
}

/// Metadata for auth token signals.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuthTokenMetadata {
    /// Header name where token was found
    pub header_name: String,
    /// Token prefix (Bearer, Basic, etc.)
    pub token_prefix: Option<String>,
    /// SHA-256 hash (never store raw tokens)
    pub token_hash: String,
    /// JWT claims if applicable
    pub jwt_claims: Option<JwtClaims>,
}

/// Parsed JWT claims.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: Option<String>,
    pub iss: Option<String>,
    pub exp: Option<i64>,
    pub iat: Option<i64>,
    pub aud: Option<String>,
}

/// Metadata for device signals.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeviceMetadata {
    pub user_agent: String,
    pub accept_language: Option<String>,
    pub header_count: usize,
    pub client_hints: Option<ClientHints>,
}

/// Client hints from Sec-CH-* headers.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ClientHints {
    pub brands: Vec<String>,
    pub mobile: Option<bool>,
    pub platform: Option<String>,
    pub platform_version: Option<String>,
    pub architecture: Option<String>,
    pub model: Option<String>,
    pub bitness: Option<String>,
}

/// Metadata for network signals.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NetworkMetadata {
    pub ip: String,
    pub tls_version: Option<String>,
    pub tls_cipher: Option<String>,
    pub alpn_protocol: Option<String>,
    pub tls_fingerprint: Option<String>,
    // JA4+ fingerprinting
    pub ja4: Option<String>,
    pub ja4h: Option<String>,
    pub ja4_combined: Option<String>,
    pub ja4_tls_version: Option<u8>,
    pub ja4_http_version: Option<u8>,
    pub ja4_protocol: Option<String>,
    pub ja4_bot_match: Option<String>,
    pub ja4_bot_category: Option<String>,
    pub ja4_bot_risk: Option<u8>,
}

/// Metadata for behavioral signals.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BehavioralMetadata {
    /// Time since last request in milliseconds
    pub time_since_last_request: Option<i64>,
    /// Requests per minute
    pub requests_per_minute: Option<f64>,
    /// Normalized path template
    pub path_pattern: Option<String>,
    /// Last N methods
    pub method_sequence: Vec<String>,
    /// Referer pattern
    pub referer_pattern: Option<String>,
}

// ============================================================================
// Time-Series Storage
// ============================================================================

/// A bucket aggregates signals over a time period.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalBucketData {
    /// Bucket start time (Unix ms)
    pub timestamp: i64,
    /// Bucket end time (Unix ms)
    pub end_timestamp: i64,
    /// Raw signals (up to max_signals_per_bucket)
    pub signals: Vec<Signal>,
    /// Aggregated statistics
    pub summary: BucketSummary,
}

/// Summary statistics for a bucket.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BucketSummary {
    pub total_count: usize,
    pub by_category: HashMap<SignalCategory, CategorySummary>,
}

/// Summary for a specific category.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CategorySummary {
    pub count: usize,
    pub unique_values: HashSet<String>,
    pub unique_entities: HashSet<String>,
    pub by_type: HashMap<SignalType, usize>,
}

// ============================================================================
// Trend Queries & Results
// ============================================================================

/// Query options for retrieving trends.
#[derive(Debug, Clone, Default)]
pub struct TrendQueryOptions {
    pub category: Option<SignalCategory>,
    pub signal_type: Option<SignalType>,
    pub from: Option<i64>,
    pub to: Option<i64>,
    pub resolution: Option<TrendResolution>,
    pub entity_id: Option<String>,
    pub limit: Option<usize>,
}

/// Resolution for trend histogram.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrendResolution {
    Minute,
    Hour,
    Day,
}

/// Trend data for a signal type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalTrend {
    pub signal_type: SignalType,
    pub category: SignalCategory,
    pub count: usize,
    pub unique_values: usize,
    pub unique_entities: usize,
    pub first_seen: i64,
    pub last_seen: i64,
    pub histogram: Vec<TrendHistogramBucket>,
    /// Percentage change from previous period
    pub change_rate: f64,
}

/// A bucket in the trend histogram.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendHistogramBucket {
    pub timestamp: i64,
    pub count: usize,
    pub unique_values: usize,
    pub unique_entities: usize,
}

/// Overall trends summary.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TrendsSummary {
    pub time_range: TimeRange,
    pub total_signals: usize,
    pub by_category: HashMap<SignalCategory, CategoryTrendSummary>,
    pub top_signal_types: Vec<TopSignalType>,
    pub anomaly_count: usize,
}

/// Time range for trends.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TimeRange {
    pub from: i64,
    pub to: i64,
}

/// Category trend summary.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CategoryTrendSummary {
    pub count: usize,
    pub unique_values: usize,
    pub unique_entities: usize,
    pub change_rate: f64,
}

/// Top signal type entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopSignalType {
    pub signal_type: SignalType,
    pub category: SignalCategory,
    pub count: usize,
}

// ============================================================================
// Anomaly Detection
// ============================================================================

/// Types of anomalies we detect.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnomalyType {
    /// Same session, different fingerprint
    FingerprintChange,
    /// Same token across multiple IPs
    SessionSharing,
    /// Sudden increase in unique values
    VelocitySpike,
    /// Geolocation anomaly
    ImpossibleTravel,
    /// Same token, different fingerprints
    TokenReuse,
    /// Systematic fingerprint rotation
    RotationPattern,
    /// Unusual request timing patterns
    TimingAnomaly,
    // JA4 fingerprint anomalies
    /// Systematic JA4 fingerprint rotation (bot farm)
    Ja4RotationPattern,
    /// Same JA4 fingerprint across multiple IPs
    Ja4IpCluster,
    /// UA claims browser but JA4 shows bot/script
    Ja4BrowserSpoofing,
    /// JA4H fingerprint changed (header manipulation)
    Ja4hChange,
    // Payload anomaly types
    /// Request size > p99 × threshold
    OversizedRequest,
    /// Response size > p99 × threshold
    OversizedResponse,
    /// Sudden increase in bytes/min
    BandwidthSpike,
    /// Large responses, small requests (data theft)
    ExfiltrationPattern,
    /// Large requests, small responses (malware upload)
    UploadPattern,
}

impl std::fmt::Display for AnomalyType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AnomalyType::FingerprintChange => write!(f, "fingerprint_change"),
            AnomalyType::SessionSharing => write!(f, "session_sharing"),
            AnomalyType::VelocitySpike => write!(f, "velocity_spike"),
            AnomalyType::ImpossibleTravel => write!(f, "impossible_travel"),
            AnomalyType::TokenReuse => write!(f, "token_reuse"),
            AnomalyType::RotationPattern => write!(f, "rotation_pattern"),
            AnomalyType::TimingAnomaly => write!(f, "timing_anomaly"),
            AnomalyType::Ja4RotationPattern => write!(f, "ja4_rotation_pattern"),
            AnomalyType::Ja4IpCluster => write!(f, "ja4_ip_cluster"),
            AnomalyType::Ja4BrowserSpoofing => write!(f, "ja4_browser_spoofing"),
            AnomalyType::Ja4hChange => write!(f, "ja4h_change"),
            AnomalyType::OversizedRequest => write!(f, "oversized_request"),
            AnomalyType::OversizedResponse => write!(f, "oversized_response"),
            AnomalyType::BandwidthSpike => write!(f, "bandwidth_spike"),
            AnomalyType::ExfiltrationPattern => write!(f, "exfiltration_pattern"),
            AnomalyType::UploadPattern => write!(f, "upload_pattern"),
        }
    }
}

/// Anomaly severity levels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnomalySeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// A detected anomaly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anomaly {
    pub id: String,
    pub detected_at: i64,
    pub category: SignalCategory,
    pub anomaly_type: AnomalyType,
    pub severity: AnomalySeverity,
    pub description: String,
    pub signals: Vec<Signal>,
    pub entities: Vec<String>,
    pub metadata: AnomalyMetadata,
    /// Risk score applied to entity (if auto-risk enabled)
    pub risk_applied: Option<u32>,
}

/// Anomaly metadata varies by type.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AnomalyMetadata {
    pub previous_value: Option<String>,
    pub new_value: Option<String>,
    pub ip_count: Option<usize>,
    pub change_count: Option<usize>,
    pub time_delta: Option<i64>,
    pub threshold: Option<f64>,
    pub actual: Option<f64>,
    // Payload profiler context
    pub template: Option<String>,
    pub source: Option<String>,
    // Impossible travel context
    pub unique_ip_count: Option<usize>,
    pub ips: Option<Vec<String>>,
    pub time_delta_ms: Option<i64>,
    pub time_delta_minutes: Option<f64>,
    pub token_hash_prefix: Option<String>,
    pub detection_method: Option<String>,
}

/// Query options for anomalies.
#[derive(Debug, Clone, Default)]
pub struct AnomalyQueryOptions {
    pub severity: Option<AnomalySeverity>,
    pub anomaly_type: Option<AnomalyType>,
    pub category: Option<SignalCategory>,
    pub from: Option<i64>,
    pub to: Option<i64>,
    pub entity_id: Option<String>,
    pub limit: Option<usize>,
    pub include_resolved: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_signal_type_category() {
        assert_eq!(SignalType::Jwt.category(), SignalCategory::AuthToken);
        assert_eq!(SignalType::Ja4.category(), SignalCategory::Network);
        assert_eq!(SignalType::Timing.category(), SignalCategory::Behavioral);
        assert_eq!(SignalType::HeaderOrder.category(), SignalCategory::Device);
    }

    #[test]
    fn test_anomaly_type_display() {
        assert_eq!(
            AnomalyType::FingerprintChange.to_string(),
            "fingerprint_change"
        );
        assert_eq!(
            AnomalyType::Ja4RotationPattern.to_string(),
            "ja4_rotation_pattern"
        );
    }

    #[test]
    fn test_severity_ordering() {
        assert!(AnomalySeverity::Low < AnomalySeverity::Medium);
        assert!(AnomalySeverity::Medium < AnomalySeverity::High);
        assert!(AnomalySeverity::High < AnomalySeverity::Critical);
    }
}

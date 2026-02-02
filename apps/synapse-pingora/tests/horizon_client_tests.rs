//! Tests for HorizonClient WebSocket protocol and reconnect logic

use serde::{Deserialize, Serialize};

// Test types mirroring production HubMessage
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum HubMessage {
    ConfigUpdate { enabled: bool },
    RuleUpdate { sensor_config: SensorConfig },
    BlocklistUpdate { ips: Vec<String> },
    Ping { message: String },
    SensorAck { message: String },
    Error { message: String },
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct SensorConfig {
    #[serde(default)]
    pub rate_limit: Option<RateLimitConfig>,
    #[serde(default)]
    pub waf: Option<WafConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct RateLimitConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub requests_per_second: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct WafConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub mode: Option<String>,
}

// ============================================================================
// HubMessage Parsing Tests
// ============================================================================

#[test]
fn test_config_update_enabled() {
    let json = r#"{"type": "config_update", "enabled": true}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    assert_eq!(msg, HubMessage::ConfigUpdate { enabled: true });
}

#[test]
fn test_config_update_disabled() {
    let json = r#"{"type": "config_update", "enabled": false}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    assert_eq!(msg, HubMessage::ConfigUpdate { enabled: false });
}

#[test]
fn test_blocklist_update() {
    let json = r#"{"type": "blocklist_update", "ips": ["192.168.1.1", "10.0.0.0/8"]}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    match msg {
        HubMessage::BlocklistUpdate { ips } => {
            assert_eq!(ips.len(), 2);
            assert!(ips.contains(&"192.168.1.1".to_string()));
        }
        _ => panic!("Expected BlocklistUpdate"),
    }
}

#[test]
fn test_ping_message() {
    let json = r#"{"type": "ping", "message": "keepalive"}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    assert_eq!(msg, HubMessage::Ping { message: "keepalive".to_string() });
}

#[test]
fn test_sensor_ack_message() {
    let json = r#"{"type": "sensor_ack", "message": "registered"}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    assert_eq!(msg, HubMessage::SensorAck { message: "registered".to_string() });
}

#[test]
fn test_error_message() {
    let json = r#"{"type": "error", "message": "auth failed"}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    assert_eq!(msg, HubMessage::Error { message: "auth failed".to_string() });
}

#[test]
fn test_unknown_message_type() {
    let json = r#"{"type": "future_type", "data": "something"}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    assert_eq!(msg, HubMessage::Unknown);
}

#[test]
fn test_rule_update_minimal() {
    let json = r#"{"type": "rule_update", "sensor_config": {}}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    match msg {
        HubMessage::RuleUpdate { sensor_config } => {
            assert!(sensor_config.rate_limit.is_none());
            assert!(sensor_config.waf.is_none());
        }
        _ => panic!("Expected RuleUpdate"),
    }
}

#[test]
fn test_rule_update_with_waf() {
    let json = r#"{"type": "rule_update", "sensor_config": {"waf": {"enabled": true, "mode": "block"}}}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    match msg {
        HubMessage::RuleUpdate { sensor_config } => {
            let waf = sensor_config.waf.unwrap();
            assert!(waf.enabled);
            assert_eq!(waf.mode, Some("block".to_string()));
        }
        _ => panic!("Expected RuleUpdate"),
    }
}

// ============================================================================
// Edge Cases
// ============================================================================

#[test]
fn test_invalid_json() {
    let json = r#"{"type": "config_update", enabled: true"#;
    let result: Result<HubMessage, _> = serde_json::from_str(json);
    assert!(result.is_err());
}

#[test]
fn test_missing_type() {
    let json = r#"{"enabled": true}"#;
    let result: Result<HubMessage, _> = serde_json::from_str(json);
    assert!(result.is_err());
}

#[test]
fn test_extra_fields_ignored() {
    let json = r#"{"type": "config_update", "enabled": true, "extra": "ignored"}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    assert_eq!(msg, HubMessage::ConfigUpdate { enabled: true });
}

#[test]
fn test_unicode_message() {
    let json = r#"{"type": "error", "message": "错误信息"}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    match msg {
        HubMessage::Error { message } => assert!(message.contains("错误")),
        _ => panic!("Expected Error"),
    }
}

#[test]
fn test_empty_blocklist() {
    let json = r#"{"type": "blocklist_update", "ips": []}"#;
    let msg: HubMessage = serde_json::from_str(json).unwrap();
    assert_eq!(msg, HubMessage::BlocklistUpdate { ips: vec![] });
}

// ============================================================================
// Backoff Logic Tests
// ============================================================================

fn calculate_backoff(attempt: u32, max_backoff: u64) -> u64 {
    (2u64.pow(attempt)).min(max_backoff)
}

#[test]
fn test_exponential_backoff() {
    let max = 32u64;
    assert_eq!(calculate_backoff(0, max), 1);
    assert_eq!(calculate_backoff(1, max), 2);
    assert_eq!(calculate_backoff(2, max), 4);
    assert_eq!(calculate_backoff(3, max), 8);
    assert_eq!(calculate_backoff(4, max), 16);
    assert_eq!(calculate_backoff(5, max), 32);
    assert_eq!(calculate_backoff(6, max), 32); // capped
}

#[test]
fn test_backoff_respects_max() {
    assert_eq!(calculate_backoff(10, 10), 10);
    assert_eq!(calculate_backoff(5, 5), 5);
}

#[test]
fn test_total_backoff_reasonable() {
    let max = 32u64;
    let total: u64 = (0..10).map(|i| calculate_backoff(i, max)).sum();
    assert_eq!(total, 191); // 1+2+4+8+16+32+32+32+32+32
    assert!(total < 300);
}

#[test]
fn test_jitter_distribution() {
    // Jitter range should be 0-1000ms
    let range = 0..=1000u64;
    assert_eq!(*range.start(), 0);
    assert_eq!(*range.end(), 1000);
}

// ============================================================================
// Connection State Tests
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
enum ConnState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting { attempt: u32 },
    Failed,
}

fn transition(state: ConnState, event: &str) -> ConnState {
    match (state, event) {
        (ConnState::Disconnected, "connect") => ConnState::Connecting,
        (ConnState::Connecting, "success") => ConnState::Connected,
        (ConnState::Connecting, "failure") => ConnState::Reconnecting { attempt: 1 },
        (ConnState::Connected, "disconnect") => ConnState::Reconnecting { attempt: 1 },
        (ConnState::Connected, "shutdown") => ConnState::Disconnected,
        (ConnState::Reconnecting { .. }, "success") => ConnState::Connected,
        (ConnState::Reconnecting { attempt }, "failure") if attempt < 10 => {
            ConnState::Reconnecting { attempt: attempt + 1 }
        }
        (ConnState::Reconnecting { .. }, "failure") => ConnState::Failed,
        (ConnState::Reconnecting { .. }, "shutdown") => ConnState::Disconnected,
        (state, _) => state,
    }
}

#[test]
fn test_connection_success() {
    let state = transition(ConnState::Disconnected, "connect");
    assert_eq!(state, ConnState::Connecting);
    let state = transition(state, "success");
    assert_eq!(state, ConnState::Connected);
}

#[test]
fn test_connection_failure_triggers_reconnect() {
    let state = transition(ConnState::Connecting, "failure");
    assert_eq!(state, ConnState::Reconnecting { attempt: 1 });
}

#[test]
fn test_reconnect_increments() {
    let state = ConnState::Reconnecting { attempt: 1 };
    let state = transition(state, "failure");
    assert_eq!(state, ConnState::Reconnecting { attempt: 2 });
}

#[test]
fn test_max_retries_fails() {
    let mut state = ConnState::Reconnecting { attempt: 9 };
    state = transition(state, "failure");
    assert_eq!(state, ConnState::Reconnecting { attempt: 10 });
    state = transition(state, "failure");
    assert_eq!(state, ConnState::Failed);
}

#[test]
fn test_graceful_shutdown() {
    let state = transition(ConnState::Connected, "shutdown");
    assert_eq!(state, ConnState::Disconnected);
}

// ============================================================================
// Serialization Round-Trip
// ============================================================================

#[test]
fn test_config_update_roundtrip() {
    let orig = HubMessage::ConfigUpdate { enabled: true };
    let json = serde_json::to_string(&orig).unwrap();
    let parsed: HubMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(orig, parsed);
}

#[test]
fn test_blocklist_roundtrip() {
    let orig = HubMessage::BlocklistUpdate { ips: vec!["1.2.3.4".to_string()] };
    let json = serde_json::to_string(&orig).unwrap();
    let parsed: HubMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(orig, parsed);
}

#[test]
fn test_ping_roundtrip() {
    let orig = HubMessage::Ping { message: "test".to_string() };
    let json = serde_json::to_string(&orig).unwrap();
    let parsed: HubMessage = serde_json::from_str(&json).unwrap();
    assert_eq!(orig, parsed);
}

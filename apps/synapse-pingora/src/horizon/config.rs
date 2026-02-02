//! Configuration for Signal Horizon Hub integration.

use serde::{Deserialize, Serialize};

/// Configuration for Signal Horizon Hub integration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizonConfig {
    /// Whether Horizon integration is enabled
    pub enabled: bool,

    /// WebSocket URL for the Hub (e.g., "wss://horizon.example.com/ws")
    pub hub_url: String,

    /// API key for authentication
    pub api_key: String,

    /// Unique sensor identifier
    pub sensor_id: String,

    /// Human-readable sensor name
    pub sensor_name: Option<String>,

    /// Sensor version string
    pub version: String,

    /// Reconnect delay in milliseconds (default: 5000)
    pub reconnect_delay_ms: u64,

    /// Maximum reconnection attempts (0 = unlimited)
    pub max_reconnect_attempts: u32,

    /// Circuit breaker threshold for consecutive failures (0 = disabled)
    #[serde(default = "default_circuit_breaker_threshold")]
    pub circuit_breaker_threshold: u32,

    /// Circuit breaker cooldown in milliseconds
    #[serde(default = "default_circuit_breaker_cooldown_ms")]
    pub circuit_breaker_cooldown_ms: u64,

    /// Signal batch size (default: 100)
    pub signal_batch_size: usize,

    /// Signal batch delay in milliseconds (default: 1000)
    pub signal_batch_delay_ms: u64,

    /// Heartbeat interval in milliseconds (default: 30000)
    pub heartbeat_interval_ms: u64,

    /// Maximum signals to queue when disconnected (default: 1000)
    pub max_queued_signals: usize,

    /// Blocklist cache TTL in seconds (default: 3600)
    pub blocklist_cache_ttl_secs: u64,
}

impl Default for HorizonConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            hub_url: String::new(),
            api_key: String::new(),
            sensor_id: String::new(),
            sensor_name: None,
            version: env!("CARGO_PKG_VERSION").to_string(),
            reconnect_delay_ms: 5_000,
            max_reconnect_attempts: 0, // Unlimited
            circuit_breaker_threshold: default_circuit_breaker_threshold(),
            circuit_breaker_cooldown_ms: default_circuit_breaker_cooldown_ms(),
            signal_batch_size: 100,
            signal_batch_delay_ms: 1_000,
            heartbeat_interval_ms: 30_000,
            max_queued_signals: 1_000,
            blocklist_cache_ttl_secs: 3_600,
        }
    }
}

impl HorizonConfig {
    /// Create a new configuration with the given hub URL.
    pub fn with_hub_url(mut self, url: &str) -> Self {
        self.hub_url = url.to_string();
        self.enabled = !url.is_empty();
        self
    }

    /// Set the API key.
    pub fn with_api_key(mut self, key: &str) -> Self {
        self.api_key = key.to_string();
        self
    }

    /// Set the sensor ID.
    pub fn with_sensor_id(mut self, id: &str) -> Self {
        self.sensor_id = id.to_string();
        self
    }

    /// Set the sensor name.
    pub fn with_sensor_name(mut self, name: &str) -> Self {
        self.sensor_name = Some(name.to_string());
        self
    }

    /// Set the version.
    pub fn with_version(mut self, version: &str) -> Self {
        self.version = version.to_string();
        self
    }

    /// Set the reconnect delay.
    pub fn with_reconnect_delay_ms(mut self, delay: u64) -> Self {
        self.reconnect_delay_ms = delay;
        self
    }

    /// Set the batch size.
    pub fn with_batch_size(mut self, size: usize) -> Self {
        self.signal_batch_size = size;
        self
    }

    /// Set the heartbeat interval.
    pub fn with_heartbeat_interval_ms(mut self, interval: u64) -> Self {
        self.heartbeat_interval_ms = interval;
        self
    }

    /// Validate the configuration.
    pub fn validate(&self) -> Result<(), super::error::HorizonError> {
        if self.enabled {
            if self.hub_url.is_empty() {
                return Err(super::error::HorizonError::ConfigError(
                    "hub_url is required when enabled".to_string(),
                ));
            }
            if self.api_key.is_empty() {
                return Err(super::error::HorizonError::ConfigError(
                    "api_key is required when enabled".to_string(),
                ));
            }
            if self.sensor_id.is_empty() {
                return Err(super::error::HorizonError::ConfigError(
                    "sensor_id is required when enabled".to_string(),
                ));
            }
        }
        Ok(())
    }
}

fn default_circuit_breaker_threshold() -> u32 {
    5
}

fn default_circuit_breaker_cooldown_ms() -> u64 {
    300_000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = HorizonConfig::default();
        assert!(!config.enabled);
        assert!(config.hub_url.is_empty());
    }

    #[test]
    fn test_builder_pattern() {
        let config = HorizonConfig::default()
            .with_hub_url("wss://example.com/ws")
            .with_api_key("test-key")
            .with_sensor_id("sensor-1");

        assert!(config.enabled);
        assert_eq!(config.hub_url, "wss://example.com/ws");
        assert_eq!(config.api_key, "test-key");
        assert_eq!(config.sensor_id, "sensor-1");
    }

    #[test]
    fn test_validation() {
        let config = HorizonConfig::default();
        assert!(config.validate().is_ok()); // Disabled config is valid

        let config = HorizonConfig::default().with_hub_url("wss://example.com");
        assert!(config.validate().is_err()); // Missing api_key

        let config = HorizonConfig::default()
            .with_hub_url("wss://example.com")
            .with_api_key("key")
            .with_sensor_id("sensor");
        assert!(config.validate().is_ok());
    }
}

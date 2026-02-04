//! Signal Horizon Hub integration for fleet-wide threat intelligence.
//!
//! This module provides WebSocket-based communication with the Signal Horizon
//! Hub for sharing threat signals and receiving blocklist updates across the
//! sensor fleet.
//!
//! # Architecture
//!
//! - [`config`] - Configuration for Horizon integration
//! - [`types`] - Protocol message types (sensor ↔ hub)
//! - [`blocklist`] - Local blocklist cache with O(1) lookup
//! - [`client`] - WebSocket client with auto-reconnect
//! - [`manager`] - High-level manager with batching
//!
//! # Example
//!
//! ```rust,no_run
//! use synapse_pingora::horizon::{HorizonManager, HorizonConfig, ThreatSignal, SignalType, Severity};
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! let config = HorizonConfig::default()
//!     .with_hub_url("wss://horizon.example.com/ws")
//!     .with_api_key("sk_live_xxx")
//!     .with_sensor_id("sensor-001");
//!
//! let manager = HorizonManager::new(config).await?;
//! manager.start().await?;
//!
//! // Report a threat
//! manager.report_signal(ThreatSignal::new(SignalType::IpThreat, Severity::High)
//!     .with_source_ip("192.168.1.100")
//!     .with_confidence(0.95));
//!
//! // Check blocklist (O(1) lookup)
//! if manager.is_ip_blocked("10.0.0.1") {
//!     println!("IP is blocked!");
//! }
//! # Ok(())
//! # }
//! ```

mod blocklist;
mod client;
mod config;
mod error;
mod manager;
mod signal_buffer;
mod types;

pub use blocklist::{BlockType, BlocklistCache, BlocklistEntry, BlocklistUpdate};
pub use client::{ClientStats, HorizonClient, MetricsProvider, NoopMetricsProvider, SignalSink};
pub use config::HorizonConfig;
pub use error::HorizonError;
pub use manager::{HorizonManager, HorizonStats, HorizonStatsSnapshot};
pub use signal_buffer::{SignalBuffer, SignalBufferConfig, SignalBufferError, SignalBufferStats};
pub use types::{
    ConnectionState, HeartbeatPayload, HubMessage, SensorMessage, Severity, SignalType,
    ThreatSignal,
};

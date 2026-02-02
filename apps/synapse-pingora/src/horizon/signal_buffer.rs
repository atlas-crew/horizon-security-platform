//! Persistent signal buffer for offline signal storage.
//!
//! Provides durable storage for threat signals when the WebSocket connection
//! is unavailable. Signals are persisted to disk using an append-only JSONL
//! format and replayed when the connection is restored.
//!
//! # Architecture
//!
//! ```text
//! ThreatSignal → SignalBuffer → signals.jsonl
//!                      │
//!                      └── On reconnect: drain() → WebSocket
//! ```

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use tracing::{debug, info, warn};

use super::types::ThreatSignal;

/// Default maximum buffer size (10MB)
const DEFAULT_MAX_BUFFER_SIZE: u64 = 10 * 1024 * 1024;

/// Default maximum signals to buffer
const DEFAULT_MAX_SIGNALS: usize = 10_000;

/// Configuration for the signal buffer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalBufferConfig {
    /// Whether persistent buffering is enabled
    pub enabled: bool,
    /// Path to the buffer file
    pub buffer_path: PathBuf,
    /// Maximum buffer file size in bytes
    pub max_buffer_size: u64,
    /// Maximum number of signals to buffer
    pub max_signals: usize,
}

impl Default for SignalBufferConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            buffer_path: PathBuf::from("/var/lib/synapse/signals.jsonl"),
            max_buffer_size: DEFAULT_MAX_BUFFER_SIZE,
            max_signals: DEFAULT_MAX_SIGNALS,
        }
    }
}

impl SignalBufferConfig {
    /// Create a new config with the given buffer path.
    pub fn with_path<P: AsRef<Path>>(path: P) -> Self {
        Self {
            enabled: true,
            buffer_path: path.as_ref().to_path_buf(),
            ..Default::default()
        }
    }

    /// Validate the configuration.
    pub fn validate(&self) -> Result<(), SignalBufferError> {
        if self.enabled && self.buffer_path.as_os_str().is_empty() {
            return Err(SignalBufferError::InvalidConfig(
                "buffer_path is required when enabled".into(),
            ));
        }
        if self.max_buffer_size == 0 {
            return Err(SignalBufferError::InvalidConfig(
                "max_buffer_size must be > 0".into(),
            ));
        }
        if self.max_signals == 0 {
            return Err(SignalBufferError::InvalidConfig(
                "max_signals must be > 0".into(),
            ));
        }
        Ok(())
    }
}

/// Errors from signal buffer operations.
#[derive(Debug, thiserror::Error)]
pub enum SignalBufferError {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Buffer full: {0}")]
    BufferFull(String),
}

/// Statistics for the signal buffer.
#[derive(Debug, Clone, Default, Serialize)]
pub struct SignalBufferStats {
    /// Number of signals currently buffered
    pub buffered_signals: usize,
    /// Total signals written to buffer
    pub signals_written: u64,
    /// Total signals drained from buffer
    pub signals_drained: u64,
    /// Total signals dropped due to buffer full
    pub signals_dropped: u64,
    /// Current buffer file size in bytes
    pub buffer_size_bytes: u64,
}

/// Persistent signal buffer backed by a JSONL file.
///
/// Provides append-only storage for signals during WebSocket disconnection.
/// Thread-safe and designed for concurrent access.
pub struct SignalBuffer {
    config: SignalBufferConfig,
    /// In-memory buffer for fast access
    signals: RwLock<Vec<ThreatSignal>>,
    /// Statistics
    signals_written: AtomicU64,
    signals_drained: AtomicU64,
    signals_dropped: AtomicU64,
}

impl SignalBuffer {
    /// Create a new signal buffer with the given configuration.
    ///
    /// # Errors
    /// Returns an error if the configuration is invalid.
    pub fn new(config: SignalBufferConfig) -> Result<Self, SignalBufferError> {
        config.validate()?;

        Ok(Self {
            config,
            signals: RwLock::new(Vec::new()),
            signals_written: AtomicU64::new(0),
            signals_drained: AtomicU64::new(0),
            signals_dropped: AtomicU64::new(0),
        })
    }

    /// Create a disabled buffer (no-op operations).
    pub fn disabled() -> Self {
        Self {
            config: SignalBufferConfig::default(),
            signals: RwLock::new(Vec::new()),
            signals_written: AtomicU64::new(0),
            signals_drained: AtomicU64::new(0),
            signals_dropped: AtomicU64::new(0),
        }
    }

    /// Load existing signals from the buffer file on startup.
    ///
    /// Call this when the client starts to recover any signals that
    /// were buffered before a restart.
    pub fn load_existing(&self) -> Result<usize, SignalBufferError> {
        if !self.config.enabled {
            return Ok(0);
        }

        let path = &self.config.buffer_path;
        if !path.exists() {
            debug!("No existing buffer file at {:?}", path);
            return Ok(0);
        }

        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let mut signals = self.signals.write();
        let mut loaded = 0;

        for line in reader.lines() {
            let line = line?;
            if line.is_empty() {
                continue;
            }
            match serde_json::from_str::<ThreatSignal>(&line) {
                Ok(signal) => {
                    if signals.len() < self.config.max_signals {
                        signals.push(signal);
                        loaded += 1;
                    }
                }
                Err(e) => {
                    warn!("Skipping invalid signal line: {}", e);
                }
            }
        }

        if loaded > 0 {
            info!("Loaded {} signals from buffer file {:?}", loaded, path);
        }

        Ok(loaded)
    }

    /// Append a signal to the buffer.
    ///
    /// Signals are stored both in memory and persisted to disk for durability.
    ///
    /// # Returns
    /// - `Ok(true)` if the signal was buffered
    /// - `Ok(false)` if buffering is disabled
    /// - `Err` if buffering failed
    pub fn append(&self, signal: ThreatSignal) -> Result<bool, SignalBufferError> {
        if !self.config.enabled {
            return Ok(false);
        }

        // Check capacity
        let mut signals = self.signals.write();
        if signals.len() >= self.config.max_signals {
            self.signals_dropped.fetch_add(1, Ordering::Relaxed);
            debug!(
                "Signal buffer full ({}/{}), dropping signal",
                signals.len(),
                self.config.max_signals
            );
            return Err(SignalBufferError::BufferFull(format!(
                "max_signals ({}) reached",
                self.config.max_signals
            )));
        }

        // Persist to disk first for durability
        self.append_to_file(&signal)?;

        // Then add to memory
        signals.push(signal);
        self.signals_written.fetch_add(1, Ordering::Relaxed);

        Ok(true)
    }

    /// Append a signal to the buffer file (atomic operation).
    fn append_to_file(&self, signal: &ThreatSignal) -> Result<(), SignalBufferError> {
        // Ensure parent directory exists
        if let Some(parent) = self.config.buffer_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Open file in append mode
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.config.buffer_path)?;

        // Check file size
        let metadata = file.metadata()?;
        if metadata.len() >= self.config.max_buffer_size {
            return Err(SignalBufferError::BufferFull(format!(
                "max_buffer_size ({}) reached",
                self.config.max_buffer_size
            )));
        }

        // Write signal as JSONL
        let mut writer = BufWriter::new(file);
        serde_json::to_writer(&mut writer, signal)?;
        writeln!(writer)?;
        writer.flush()?;

        Ok(())
    }

    /// Drain all buffered signals.
    ///
    /// Returns the signals and clears both the in-memory buffer and the file.
    /// Use this when the WebSocket connection is restored.
    pub fn drain(&self) -> Result<Vec<ThreatSignal>, SignalBufferError> {
        if !self.config.enabled {
            return Ok(Vec::new());
        }

        let mut signals = self.signals.write();
        let drained: Vec<ThreatSignal> = signals.drain(..).collect();
        let count = drained.len() as u64;

        // Clear the file
        if self.config.buffer_path.exists() {
            fs::remove_file(&self.config.buffer_path)?;
        }

        if count > 0 {
            self.signals_drained.fetch_add(count, Ordering::Relaxed);
            info!("Drained {} signals from buffer", count);
        }

        Ok(drained)
    }

    /// Clear all buffered signals without returning them.
    pub fn clear(&self) -> Result<(), SignalBufferError> {
        if !self.config.enabled {
            return Ok(());
        }

        let mut signals = self.signals.write();
        let count = signals.len();
        signals.clear();

        // Clear the file
        if self.config.buffer_path.exists() {
            fs::remove_file(&self.config.buffer_path)?;
        }

        if count > 0 {
            debug!("Cleared {} signals from buffer", count);
        }

        Ok(())
    }

    /// Get the number of buffered signals.
    pub fn len(&self) -> usize {
        self.signals.read().len()
    }

    /// Check if the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.signals.read().is_empty()
    }

    /// Check if buffering is enabled.
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// Get buffer statistics.
    pub fn stats(&self) -> SignalBufferStats {
        let signals = self.signals.read();
        let buffer_size = self
            .config
            .buffer_path
            .metadata()
            .map(|m| m.len())
            .unwrap_or(0);

        SignalBufferStats {
            buffered_signals: signals.len(),
            signals_written: self.signals_written.load(Ordering::Relaxed),
            signals_drained: self.signals_drained.load(Ordering::Relaxed),
            signals_dropped: self.signals_dropped.load(Ordering::Relaxed),
            buffer_size_bytes: buffer_size,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_signal() -> ThreatSignal {
        use super::super::types::{Severity, SignalType};
        ThreatSignal::new(SignalType::IpThreat, Severity::High)
            .with_source_ip("192.168.1.100")
            .with_confidence(0.95)
    }

    #[test]
    fn test_disabled_buffer() {
        let buffer = SignalBuffer::disabled();
        assert!(!buffer.is_enabled());

        let signal = create_test_signal();
        let result = buffer.append(signal).unwrap();
        assert!(!result); // Should return false when disabled

        assert!(buffer.drain().unwrap().is_empty());
    }

    #[test]
    fn test_append_and_drain() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("signals.jsonl");

        let config = SignalBufferConfig::with_path(&path);
        let buffer = SignalBuffer::new(config).unwrap();

        // Append signals
        for _ in 0..3 {
            buffer.append(create_test_signal()).unwrap();
        }

        assert_eq!(buffer.len(), 3);
        assert!(path.exists());

        // Drain signals
        let signals = buffer.drain().unwrap();
        assert_eq!(signals.len(), 3);
        assert!(buffer.is_empty());
        assert!(!path.exists()); // File should be deleted
    }

    #[test]
    fn test_load_existing() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("signals.jsonl");

        // Create a buffer and add signals
        {
            let config = SignalBufferConfig::with_path(&path);
            let buffer = SignalBuffer::new(config).unwrap();
            buffer.append(create_test_signal()).unwrap();
            buffer.append(create_test_signal()).unwrap();
        }

        // Create a new buffer and load existing
        let config = SignalBufferConfig::with_path(&path);
        let buffer = SignalBuffer::new(config).unwrap();
        let loaded = buffer.load_existing().unwrap();

        assert_eq!(loaded, 2);
        assert_eq!(buffer.len(), 2);
    }

    #[test]
    fn test_max_signals_limit() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("signals.jsonl");

        let config = SignalBufferConfig {
            enabled: true,
            buffer_path: path,
            max_buffer_size: DEFAULT_MAX_BUFFER_SIZE,
            max_signals: 2,
        };
        let buffer = SignalBuffer::new(config).unwrap();

        // First two should succeed
        assert!(buffer.append(create_test_signal()).is_ok());
        assert!(buffer.append(create_test_signal()).is_ok());

        // Third should fail
        let result = buffer.append(create_test_signal());
        assert!(matches!(result, Err(SignalBufferError::BufferFull(_))));

        let stats = buffer.stats();
        assert_eq!(stats.signals_dropped, 1);
    }

    #[test]
    fn test_stats() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("signals.jsonl");

        let config = SignalBufferConfig::with_path(&path);
        let buffer = SignalBuffer::new(config).unwrap();

        buffer.append(create_test_signal()).unwrap();
        buffer.append(create_test_signal()).unwrap();

        let stats = buffer.stats();
        assert_eq!(stats.buffered_signals, 2);
        assert_eq!(stats.signals_written, 2);
        assert_eq!(stats.signals_drained, 0);

        buffer.drain().unwrap();

        let stats = buffer.stats();
        assert_eq!(stats.buffered_signals, 0);
        assert_eq!(stats.signals_drained, 2);
    }

    #[test]
    fn test_config_validation() {
        // Invalid: empty path when enabled
        let config = SignalBufferConfig {
            enabled: true,
            buffer_path: PathBuf::new(),
            ..Default::default()
        };
        assert!(config.validate().is_err());

        // Invalid: zero max_signals
        let config = SignalBufferConfig {
            enabled: true,
            buffer_path: PathBuf::from("/tmp/test.jsonl"),
            max_signals: 0,
            ..Default::default()
        };
        assert!(config.validate().is_err());

        // Valid
        let config = SignalBufferConfig::with_path("/tmp/test.jsonl");
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_clear() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("signals.jsonl");

        let config = SignalBufferConfig::with_path(&path);
        let buffer = SignalBuffer::new(config).unwrap();

        buffer.append(create_test_signal()).unwrap();
        buffer.append(create_test_signal()).unwrap();
        assert_eq!(buffer.len(), 2);
        assert!(path.exists());

        buffer.clear().unwrap();
        assert!(buffer.is_empty());
        assert!(!path.exists());
    }
}

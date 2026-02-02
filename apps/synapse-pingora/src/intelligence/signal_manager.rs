//! SignalManager - aggregates security signals into time buckets.
//!
//! Signals are categorized into high-level buckets:
//! - Attack
//! - Anomaly
//! - Behavior
//! - Intelligence
//!
//! This manager provides lightweight, in-memory storage optimized for
//! last-24-hour visibility and dashboard queries.

use std::collections::{HashMap, VecDeque};

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// High-level signal categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SignalCategory {
    Attack,
    Anomaly,
    Behavior,
    Intelligence,
}

/// Security signal recorded by the sensor.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signal {
    /// Unique signal ID.
    pub id: String,
    /// Unix timestamp in milliseconds.
    pub timestamp_ms: u64,
    /// Signal category.
    pub category: SignalCategory,
    /// Signal type identifier (string for extensibility).
    pub signal_type: String,
    /// Optional entity identifier (IP, actor ID, fingerprint).
    pub entity_id: Option<String>,
    /// Human-readable description.
    pub description: Option<String>,
    /// Arbitrary structured metadata.
    pub metadata: serde_json::Value,
}

impl Signal {
    pub fn new(
        category: SignalCategory,
        signal_type: impl Into<String>,
        entity_id: Option<String>,
        description: Option<String>,
        metadata: serde_json::Value,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp_ms: now_ms(),
            category,
            signal_type: signal_type.into(),
            entity_id,
            description,
            metadata,
        }
    }
}

/// Query options for listing signals.
#[derive(Debug, Clone, Default)]
pub struct SignalQueryOptions {
    pub category: Option<SignalCategory>,
    pub limit: Option<usize>,
    pub since_ms: Option<u64>,
}

/// Summary of signals for dashboards.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalSummary {
    pub total_signals: usize,
    pub by_category: HashMap<SignalCategory, usize>,
    pub top_signal_types: Vec<TopSignalType>,
}

/// Top signal type counts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopSignalType {
    pub signal_type: String,
    pub count: usize,
}

/// Signal manager configuration.
#[derive(Debug, Clone)]
pub struct SignalManagerConfig {
    /// Bucket size in milliseconds (default: 5 minutes).
    pub bucket_size_ms: u64,
    /// Total retention window in milliseconds (default: 24 hours).
    pub retention_ms: u64,
    /// Maximum stored signals per bucket (default: 1000).
    pub max_signals_per_bucket: usize,
    /// Maximum number of signals returned per query (default: 500).
    pub max_query_results: usize,
}

impl Default for SignalManagerConfig {
    fn default() -> Self {
        Self {
            bucket_size_ms: 5 * 60 * 1000,
            retention_ms: 24 * 60 * 60 * 1000,
            max_signals_per_bucket: 1000,
            max_query_results: 500,
        }
    }
}

// ============================================================================
// Internal Structures
// ============================================================================

#[derive(Debug, Clone)]
struct SignalBucket {
    timestamp_ms: u64,
    end_timestamp_ms: u64,
    signals: Vec<Signal>,
    by_category: HashMap<SignalCategory, usize>,
    by_type: HashMap<String, usize>,
}

impl SignalBucket {
    fn new(timestamp_ms: u64, bucket_size_ms: u64) -> Self {
        Self {
            timestamp_ms,
            end_timestamp_ms: timestamp_ms + bucket_size_ms,
            signals: Vec::new(),
            by_category: HashMap::new(),
            by_type: HashMap::new(),
        }
    }

    fn add_signal(&mut self, signal: Signal, max_signals: usize) {
        *self.by_category.entry(signal.category).or_insert(0) += 1;
        *self.by_type.entry(signal.signal_type.clone()).or_insert(0) += 1;

        if self.signals.len() < max_signals {
            self.signals.push(signal);
        }
    }
}

#[derive(Debug, Default)]
struct SignalStore {
    buckets: VecDeque<SignalBucket>,
}

// ============================================================================
// Signal Manager
// ============================================================================

/// In-memory signal aggregation manager.
pub struct SignalManager {
    config: SignalManagerConfig,
    store: RwLock<SignalStore>,
}

impl SignalManager {
    pub fn new(config: SignalManagerConfig) -> Self {
        Self {
            config,
            store: RwLock::new(SignalStore::default()),
        }
    }

    /// Record a signal into the time store.
    pub fn record(&self, signal: Signal) {
        let mut store = self.store.write();
        let bucket_ts = bucket_timestamp(signal.timestamp_ms, self.config.bucket_size_ms);

        let bucket = match store.buckets.back_mut() {
            Some(last) if last.timestamp_ms == bucket_ts => last,
            Some(last) if bucket_ts > last.timestamp_ms => {
                // Add buckets until we reach the target (handles gaps).
                let mut ts = last.timestamp_ms + self.config.bucket_size_ms;
                while ts <= bucket_ts {
                    store
                        .buckets
                        .push_back(SignalBucket::new(ts, self.config.bucket_size_ms));
                    ts += self.config.bucket_size_ms;
                }
                store.buckets.back_mut().expect("bucket just added")
            }
            _ => {
                // Either empty or out-of-order; add a fresh bucket.
                store
                    .buckets
                    .push_back(SignalBucket::new(bucket_ts, self.config.bucket_size_ms));
                store.buckets.back_mut().expect("bucket just added")
            }
        };

        bucket.add_signal(signal, self.config.max_signals_per_bucket);
        self.evict_old_buckets(&mut store);
    }

    /// Convenience method to build and record a signal.
    pub fn record_event(
        &self,
        category: SignalCategory,
        signal_type: impl Into<String>,
        entity_id: Option<String>,
        description: Option<String>,
        metadata: serde_json::Value,
    ) {
        self.record(Signal::new(
            category,
            signal_type,
            entity_id,
            description,
            metadata,
        ));
    }

    /// List recent signals with optional filtering.
    pub fn list_signals(&self, options: SignalQueryOptions) -> Vec<Signal> {
        let store = self.store.read();
        let limit = options
            .limit
            .unwrap_or(self.config.max_query_results)
            .min(self.config.max_query_results);

        let mut results = Vec::with_capacity(limit);
        for bucket in store.buckets.iter().rev() {
            for signal in bucket.signals.iter().rev() {
                if let Some(category) = options.category {
                    if signal.category != category {
                        continue;
                    }
                }
                if let Some(since_ms) = options.since_ms {
                    if signal.timestamp_ms < since_ms {
                        continue;
                    }
                }
                results.push(signal.clone());
                if results.len() >= limit {
                    return results;
                }
            }
        }
        results
    }

    /// Build a summary of signals for dashboards.
    pub fn summary(&self) -> SignalSummary {
        let store = self.store.read();
        let mut by_category: HashMap<SignalCategory, usize> = HashMap::new();
        let mut by_type: HashMap<String, usize> = HashMap::new();
        let mut total = 0usize;

        for bucket in store.buckets.iter() {
            total += bucket.signals.len();
            for (category, count) in &bucket.by_category {
                *by_category.entry(*category).or_insert(0) += count;
            }
            for (signal_type, count) in &bucket.by_type {
                *by_type.entry(signal_type.clone()).or_insert(0) += count;
            }
        }

        let mut top_signal_types: Vec<TopSignalType> = by_type
            .into_iter()
            .map(|(signal_type, count)| TopSignalType { signal_type, count })
            .collect();
        top_signal_types.sort_by(|a, b| b.count.cmp(&a.count));
        top_signal_types.truncate(10);

        SignalSummary {
            total_signals: total,
            by_category,
            top_signal_types,
        }
    }

    fn evict_old_buckets(&self, store: &mut SignalStore) {
        let max_buckets = (self.config.retention_ms / self.config.bucket_size_ms).max(1) as usize;
        while store.buckets.len() > max_buckets {
            store.buckets.pop_front();
        }
    }
}

#[inline]
fn bucket_timestamp(timestamp_ms: u64, bucket_size_ms: u64) -> u64 {
    timestamp_ms - (timestamp_ms % bucket_size_ms)
}

#[inline]
fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

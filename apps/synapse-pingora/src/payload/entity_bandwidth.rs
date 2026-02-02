//! Per-entity (IP) bandwidth tracking.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::time::Instant;

/// A time bucket for bandwidth tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandwidthBucket {
    /// Bucket timestamp (Unix ms)
    pub timestamp_ms: i64,
    /// Request bytes in this bucket
    pub request_bytes: u64,
    /// Response bytes in this bucket
    pub response_bytes: u64,
    /// Request count in this bucket
    pub request_count: u64,
}

impl BandwidthBucket {
    /// Create a new bucket with current timestamp.
    pub fn new() -> Self {
        Self {
            timestamp_ms: chrono::Utc::now().timestamp_millis(),
            request_bytes: 0,
            response_bytes: 0,
            request_count: 0,
        }
    }

    /// Total bytes in this bucket.
    pub fn total_bytes(&self) -> u64 {
        self.request_bytes + self.response_bytes
    }
}

impl Default for BandwidthBucket {
    fn default() -> Self {
        Self::new()
    }
}

/// Bandwidth tracking for a single entity (IP).
pub struct EntityBandwidth {
    /// Entity identifier (usually IP address)
    pub entity_id: String,
    /// Total request bytes
    pub total_request_bytes: u64,
    /// Total response bytes
    pub total_response_bytes: u64,
    /// Total request count
    pub total_request_count: u64,
    /// Recent time buckets for spike detection
    buckets: VecDeque<BandwidthBucket>,
    /// Current active bucket
    current_bucket: BandwidthBucket,
    /// Bucket duration in ms
    bucket_duration_ms: u64,
    /// Maximum buckets to keep
    max_buckets: usize,
    /// Last bucket rotation time
    last_rotation: Instant,
    /// First seen timestamp
    pub first_seen: Instant,
    /// Last seen timestamp
    pub last_seen: Instant,
    /// Access counter for LRU
    pub access_count: u64,
}

impl EntityBandwidth {
    /// Create new bandwidth tracking for an entity.
    pub fn new(entity_id: String, bucket_duration_ms: u64, max_buckets: usize) -> Self {
        let now = Instant::now();
        Self {
            entity_id,
            total_request_bytes: 0,
            total_response_bytes: 0,
            total_request_count: 0,
            buckets: VecDeque::with_capacity(max_buckets),
            current_bucket: BandwidthBucket::new(),
            bucket_duration_ms,
            max_buckets,
            last_rotation: now,
            first_seen: now,
            last_seen: now,
            access_count: 0,
        }
    }

    /// Record a request/response pair.
    pub fn record(&mut self, request_bytes: u64, response_bytes: u64) {
        self.last_seen = Instant::now();
        self.access_count += 1;

        // Update totals
        self.total_request_bytes += request_bytes;
        self.total_response_bytes += response_bytes;
        self.total_request_count += 1;

        // Rotate bucket if needed
        if self.last_rotation.elapsed().as_millis() >= self.bucket_duration_ms as u128 {
            self.rotate_bucket();
        }

        // Record in current bucket
        self.current_bucket.request_bytes += request_bytes;
        self.current_bucket.response_bytes += response_bytes;
        self.current_bucket.request_count += 1;
    }

    /// Rotate to a new bucket.
    fn rotate_bucket(&mut self) {
        let old_bucket = std::mem::replace(&mut self.current_bucket, BandwidthBucket::new());
        self.buckets.push_back(old_bucket);
        self.last_rotation = Instant::now();

        // Evict old buckets
        while self.buckets.len() > self.max_buckets {
            self.buckets.pop_front();
        }
    }

    /// Get average bytes per minute from recent buckets.
    pub fn avg_bytes_per_minute(&self) -> u64 {
        if self.buckets.is_empty() {
            return self.current_bucket.total_bytes();
        }

        let total: u64 = self.buckets.iter().map(|b| b.total_bytes()).sum();
        total / self.buckets.len() as u64
    }

    /// Get current bytes per minute (from current bucket).
    pub fn current_bytes_per_minute(&self) -> u64 {
        self.current_bucket.total_bytes()
    }

    /// Get total bytes.
    pub fn total_bytes(&self) -> u64 {
        self.total_request_bytes + self.total_response_bytes
    }

    /// Get recent buckets as snapshots.
    pub fn recent_buckets(&self) -> Vec<BandwidthBucket> {
        self.buckets.iter().cloned().collect()
    }
}

/// Serializable snapshot for API responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityBandwidthSnapshot {
    pub entity_id: String,
    pub total_request_bytes: u64,
    pub total_response_bytes: u64,
    pub total_request_count: u64,
    pub bytes_per_minute: u64,
    pub first_seen_ms: i64,
    pub last_seen_ms: i64,
    pub recent_buckets: Vec<BandwidthBucket>,
}

impl From<&EntityBandwidth> for EntityBandwidthSnapshot {
    fn from(entity: &EntityBandwidth) -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        let first_elapsed = entity.first_seen.elapsed().as_millis() as i64;
        let last_elapsed = entity.last_seen.elapsed().as_millis() as i64;

        Self {
            entity_id: entity.entity_id.clone(),
            total_request_bytes: entity.total_request_bytes,
            total_response_bytes: entity.total_response_bytes,
            total_request_count: entity.total_request_count,
            bytes_per_minute: entity.avg_bytes_per_minute(),
            first_seen_ms: now - first_elapsed,
            last_seen_ms: now - last_elapsed,
            recent_buckets: entity.recent_buckets(),
        }
    }
}

//! Per-endpoint payload statistics tracking.

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::time::Instant;

use crate::profiler::Distribution;

/// Statistics for payload sizes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeStats {
    /// Number of samples
    pub count: u64,
    /// Total bytes
    pub total_bytes: u64,
    /// Minimum size seen
    pub min_bytes: u64,
    /// Maximum size seen
    pub max_bytes: u64,
    /// P50 (median) size
    pub p50_bytes: f64,
    /// P95 size
    pub p95_bytes: f64,
    /// P99 size
    pub p99_bytes: f64,
}

impl Default for SizeStats {
    fn default() -> Self {
        Self {
            count: 0,
            total_bytes: 0,
            min_bytes: u64::MAX,
            max_bytes: 0,
            p50_bytes: 0.0,
            p95_bytes: 0.0,
            p99_bytes: 0.0,
        }
    }
}

impl SizeStats {
    /// Calculate average bytes.
    pub fn avg_bytes(&self) -> f64 {
        if self.count == 0 {
            0.0
        } else {
            self.total_bytes as f64 / self.count as f64
        }
    }

    /// Create stats from a Distribution.
    pub fn from_distribution(dist: &Distribution, total_bytes: u64) -> Self {
        let (p50, p95, p99) = dist.percentiles();
        Self {
            count: dist.count() as u64,
            total_bytes,
            min_bytes: dist.min() as u64,
            max_bytes: dist.max() as u64,
            p50_bytes: p50,
            p95_bytes: p95,
            p99_bytes: p99,
        }
    }
}

/// A time window for sliding aggregation.
#[derive(Debug, Clone)]
pub struct PayloadWindow {
    /// Window start time
    pub start: Instant,
    /// Window end time
    pub end: Instant,
    /// Total request bytes in window
    pub request_bytes: u64,
    /// Total response bytes in window
    pub response_bytes: u64,
    /// Number of requests in window
    pub request_count: u64,
}

impl PayloadWindow {
    /// Create a new window starting now.
    pub fn new(duration_ms: u64) -> Self {
        let now = Instant::now();
        Self {
            start: now,
            end: now + std::time::Duration::from_millis(duration_ms),
            request_bytes: 0,
            response_bytes: 0,
            request_count: 0,
        }
    }

    /// Check if the window has expired.
    pub fn is_expired(&self) -> bool {
        Instant::now() >= self.end
    }

    /// Record a request in this window.
    pub fn record(&mut self, request_bytes: u64, response_bytes: u64) {
        self.request_bytes += request_bytes;
        self.response_bytes += response_bytes;
        self.request_count += 1;
    }
}

/// Serializable version of PayloadWindow for API responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayloadWindowSnapshot {
    pub start_ms: i64,
    pub end_ms: i64,
    pub request_bytes: u64,
    pub response_bytes: u64,
    pub request_count: u64,
}

/// Statistics for a single endpoint template.
pub struct EndpointPayloadStats {
    /// Endpoint template (e.g., "/api/users/{id}")
    pub template: String,
    /// Request size distribution
    pub request_dist: Distribution,
    /// Response size distribution
    pub response_dist: Distribution,
    /// Total request bytes
    pub total_request_bytes: u64,
    /// Total response bytes
    pub total_response_bytes: u64,
    /// Sliding windows for recent data
    pub windows: VecDeque<PayloadWindow>,
    /// Current (active) window
    pub current_window: PayloadWindow,
    /// Window duration in ms
    window_duration_ms: u64,
    /// Maximum windows to keep
    max_windows: usize,
    /// First seen timestamp
    pub first_seen: Instant,
    /// Last seen timestamp
    pub last_seen: Instant,
    /// Access counter for LRU
    pub access_count: u64,
}

impl EndpointPayloadStats {
    /// Create new stats for an endpoint.
    pub fn new(template: String, window_duration_ms: u64, max_windows: usize) -> Self {
        let now = Instant::now();
        Self {
            template,
            request_dist: Distribution::new(),
            response_dist: Distribution::new(),
            total_request_bytes: 0,
            total_response_bytes: 0,
            windows: VecDeque::with_capacity(max_windows),
            current_window: PayloadWindow::new(window_duration_ms),
            window_duration_ms,
            max_windows,
            first_seen: now,
            last_seen: now,
            access_count: 0,
        }
    }

    /// Record a request/response pair.
    pub fn record(&mut self, request_bytes: u64, response_bytes: u64) {
        self.last_seen = Instant::now();
        self.access_count += 1;

        // Update distributions
        self.request_dist.update(request_bytes as f64);
        self.response_dist.update(response_bytes as f64);

        // Update totals
        self.total_request_bytes += request_bytes;
        self.total_response_bytes += response_bytes;

        // Rotate window if needed
        if self.current_window.is_expired() {
            self.rotate_window();
        }

        // Record in current window
        self.current_window.record(request_bytes, response_bytes);
    }

    /// Rotate to a new window.
    fn rotate_window(&mut self) {
        let old_window = std::mem::replace(
            &mut self.current_window,
            PayloadWindow::new(self.window_duration_ms),
        );
        self.windows.push_back(old_window);

        // Evict old windows
        while self.windows.len() > self.max_windows {
            self.windows.pop_front();
        }
    }

    /// Get request size stats.
    pub fn request_stats(&self) -> SizeStats {
        SizeStats::from_distribution(&self.request_dist, self.total_request_bytes)
    }

    /// Get response size stats.
    pub fn response_stats(&self) -> SizeStats {
        SizeStats::from_distribution(&self.response_dist, self.total_response_bytes)
    }

    /// Get total request count.
    pub fn request_count(&self) -> u64 {
        self.request_dist.count() as u64
    }

    /// Get bytes per minute (from recent windows).
    pub fn bytes_per_minute(&self) -> (u64, u64) {
        if self.windows.is_empty() {
            return (0, 0);
        }

        let mut total_request = 0u64;
        let mut total_response = 0u64;

        for window in &self.windows {
            total_request += window.request_bytes;
            total_response += window.response_bytes;
        }

        // Average across windows
        let count = self.windows.len() as u64;
        (total_request / count, total_response / count)
    }
}

/// Serializable snapshot for API responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointPayloadStatsSnapshot {
    pub template: String,
    pub request: SizeStats,
    pub response: SizeStats,
    pub request_count: u64,
    pub first_seen_ms: i64,
    pub last_seen_ms: i64,
}

impl From<&EndpointPayloadStats> for EndpointPayloadStatsSnapshot {
    fn from(stats: &EndpointPayloadStats) -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        let first_elapsed = stats.first_seen.elapsed().as_millis() as i64;
        let last_elapsed = stats.last_seen.elapsed().as_millis() as i64;

        Self {
            template: stats.template.clone(),
            request: stats.request_stats(),
            response: stats.response_stats(),
            request_count: stats.request_count(),
            first_seen_ms: now - first_elapsed,
            last_seen_ms: now - last_elapsed,
        }
    }
}

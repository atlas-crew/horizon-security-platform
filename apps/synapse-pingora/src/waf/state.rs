//! Stateful tracking for IP-based rate limiting and unique counting.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// State store for per-IP tracking.
#[derive(Default)]
pub struct StateStore {
    /// Unique values per (IP, key) pair.
    unique_values: HashMap<(String, String), HashMap<String, u64>>,
    /// Event counts per (IP, key) pair.
    event_counts: HashMap<(String, String), Vec<u64>>,
}

impl StateStore {
    /// Record unique values for an IP and return the current count.
    pub fn record_unique_values(
        &mut self,
        ip: &str,
        key: &str,
        values: &[String],
        timeframe_sec: u64,
    ) -> usize {
        let now = now_ms();
        let window_ms = timeframe_sec.saturating_mul(1000).max(1);
        let map_key = (ip.to_string(), key.to_string());
        let entry = self.unique_values.entry(map_key).or_default();

        for value in values {
            let normalized = if value.len() > 256 {
                value[..256].to_string()
            } else {
                value.clone()
            };
            entry.insert(normalized, now);
        }

        // Cleanup expired entries
        entry.retain(|_, ts| now.saturating_sub(*ts) <= window_ms);
        entry.len()
    }

    /// Get the current unique count for an IP.
    pub fn get_unique_count(&mut self, ip: &str, key: &str, timeframe_sec: u64) -> usize {
        let now = now_ms();
        let window_ms = timeframe_sec.saturating_mul(1000).max(1);
        let map_key = (ip.to_string(), key.to_string());
        let Some(entry) = self.unique_values.get_mut(&map_key) else {
            return 0;
        };
        entry.retain(|_, ts| now.saturating_sub(*ts) <= window_ms);
        entry.len()
    }

    /// Record an event and return the current count.
    pub fn record_event(&mut self, ip: &str, key: &str, timeframe_sec: u64) -> usize {
        let now = now_ms();
        let window_ms = timeframe_sec.saturating_mul(1000).max(1);
        let map_key = (ip.to_string(), key.to_string());
        let list = self.event_counts.entry(map_key).or_default();
        list.push(now);

        // Remove expired events
        while let Some(first) = list.first().copied() {
            if now.saturating_sub(first) > window_ms {
                list.remove(0);
            } else {
                break;
            }
        }
        list.len()
    }

    /// Clear all state (for testing).
    #[cfg(test)]
    #[allow(dead_code)]
    pub fn clear(&mut self) {
        self.unique_values.clear();
        self.event_counts.clear();
    }
}

/// Get current time in milliseconds.
pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unique_count() {
        let mut store = StateStore::default();

        let count = store.record_unique_values(
            "192.168.1.1",
            "test",
            &["value1".to_string(), "value2".to_string()],
            60,
        );
        assert_eq!(count, 2);

        // Recording same values shouldn't increase count
        let count = store.record_unique_values("192.168.1.1", "test", &["value1".to_string()], 60);
        assert_eq!(count, 2);

        // New value should increase count
        let count = store.record_unique_values("192.168.1.1", "test", &["value3".to_string()], 60);
        assert_eq!(count, 3);
    }

    #[test]
    fn test_event_count() {
        let mut store = StateStore::default();

        let count = store.record_event("192.168.1.1", "test", 60);
        assert_eq!(count, 1);

        let count = store.record_event("192.168.1.1", "test", 60);
        assert_eq!(count, 2);

        // Different IP should have separate count
        let count = store.record_event("192.168.1.2", "test", 60);
        assert_eq!(count, 1);
    }
}

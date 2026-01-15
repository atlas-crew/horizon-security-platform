//! Timing Correlation Detector
//!
//! Identifies botnets and coordinated attacks by detecting
//! synchronized request timing patterns. Weight: 25.

use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::sync::RwLock;
use std::time::{Duration, Instant};

use crate::correlation::{
    FingerprintIndex, CampaignUpdate, CorrelationType, CorrelationReason,
};
use super::{Detector, DetectorResult};

/// Configuration for timing correlation detection
#[derive(Debug, Clone)]
pub struct TimingConfig {
    /// Minimum IPs with synchronized timing
    pub min_ips: usize,
    /// Time bucket size for synchronization detection
    pub bucket_size: Duration,
    /// Minimum requests in same bucket to consider correlated
    pub min_bucket_hits: usize,
    /// Time window for analysis
    pub window: Duration,
}

impl Default for TimingConfig {
    fn default() -> Self {
        Self {
            min_ips: 3,
            bucket_size: Duration::from_millis(100), // 100ms buckets
            min_bucket_hits: 5,
            window: Duration::from_secs(60),
        }
    }
}

/// Detects campaigns based on synchronized request timing
pub struct TimingCorrelationDetector {
    config: TimingConfig,
    /// Time bucket -> IPs that made requests in that bucket
    timing_buckets: RwLock<HashMap<u64, Vec<(IpAddr, Instant)>>>,
    detected: RwLock<HashSet<u64>>,
    start_time: Instant,
}

impl TimingCorrelationDetector {
    pub fn new(config: TimingConfig) -> Self {
        Self {
            config,
            timing_buckets: RwLock::new(HashMap::new()),
            detected: RwLock::new(HashSet::new()),
            start_time: Instant::now(),
        }
    }

    /// Get bucket ID for a timestamp
    fn bucket_id(&self, ts: Instant) -> u64 {
        let elapsed = ts.duration_since(self.start_time);
        elapsed.as_millis() as u64 / self.config.bucket_size.as_millis() as u64
    }

    /// Record a request timestamp for an IP
    pub fn record_request(&self, ip: IpAddr) {
        let now = Instant::now();
        let bucket = self.bucket_id(now);

        let mut buckets = self.timing_buckets.write().unwrap();
        buckets.entry(bucket).or_default().push((ip, now));

        // Cleanup old buckets
        let cutoff_bucket = self.bucket_id(now - self.config.window);
        buckets.retain(|&b, _| b >= cutoff_bucket);
    }

    fn get_correlated_groups(&self) -> Vec<(u64, Vec<IpAddr>)> {
        let buckets = self.timing_buckets.read().unwrap();
        let detected = self.detected.read().unwrap();

        buckets.iter()
            .filter(|(bucket, _)| !detected.contains(bucket))
            .filter_map(|(&bucket, entries)| {
                let unique_ips: HashSet<IpAddr> = entries.iter().map(|(ip, _)| *ip).collect();

                if unique_ips.len() >= self.config.min_ips
                   && entries.len() >= self.config.min_bucket_hits {
                    Some((bucket, unique_ips.into_iter().collect()))
                } else {
                    None
                }
            })
            .collect()
    }
}

impl Detector for TimingCorrelationDetector {
    fn name(&self) -> &'static str { "timing_correlation" }

    fn analyze(&self, _index: &FingerprintIndex) -> DetectorResult<Vec<CampaignUpdate>> {
        let groups = self.get_correlated_groups();
        let mut updates = Vec::new();

        for (bucket, ips) in groups {
            let confidence = (ips.len() as f64 / 10.0).min(1.0) * 0.7;

            updates.push(CampaignUpdate {
                campaign_id: Some(format!("timing-{}", bucket)),
                status: None,
                confidence: Some(confidence),
                attack_types: Some(vec!["botnet".to_string()]),
                add_member_ips: Some(ips.iter().map(|ip| ip.to_string()).collect()),
                add_correlation_reason: Some(CorrelationReason::new(
                    CorrelationType::TimingCorrelation,
                    confidence,
                    format!("{} IPs with synchronized request timing", ips.len()),
                    ips.iter().map(|ip| ip.to_string()).collect(),
                )),
                ..Default::default()
            });

            self.detected.write().unwrap().insert(bucket);
        }

        Ok(updates)
    }

    fn should_trigger(&self, _ip: &IpAddr, _index: &FingerprintIndex) -> bool {
        // Check if current bucket has enough activity
        let now = Instant::now();
        let bucket = self.bucket_id(now);
        let buckets = self.timing_buckets.read().unwrap();

        buckets.get(&bucket)
            .map(|entries| entries.len() >= self.config.min_bucket_hits - 1)
            .unwrap_or(false)
    }

    fn scan_interval_ms(&self) -> u64 { 2000 } // 2 seconds - timing sensitive
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = TimingConfig::default();
        assert_eq!(config.min_ips, 3);
        assert_eq!(config.bucket_size, Duration::from_millis(100));
    }

    #[test]
    fn test_record_request() {
        let detector = TimingCorrelationDetector::new(TimingConfig::default());
        let ip: IpAddr = "192.168.1.1".parse().unwrap();
        detector.record_request(ip);
    }

    #[test]
    fn test_bucket_calculation() {
        let detector = TimingCorrelationDetector::new(TimingConfig::default());
        let bucket1 = detector.bucket_id(Instant::now());
        std::thread::sleep(Duration::from_millis(150));
        let bucket2 = detector.bucket_id(Instant::now());
        assert!(bucket2 > bucket1);
    }

    #[test]
    fn test_name() {
        let detector = TimingCorrelationDetector::new(TimingConfig::default());
        assert_eq!(detector.name(), "timing_correlation");
    }
}

//! Behavioral Similarity Detector
//!
//! Identifies IPs with identical navigation patterns, page sequences,
//! or request timing patterns. Weight: 30.

use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::sync::RwLock;
use std::time::{Duration, Instant};

use crate::correlation::{
    FingerprintIndex, CampaignUpdate, CorrelationType, CorrelationReason,
};
use super::{Detector, DetectorResult};

/// Represents a behavior pattern (sequence of actions)
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct BehaviorPattern {
    /// Ordered sequence of paths visited
    pub path_sequence: Vec<String>,
    /// Request method sequence
    pub method_sequence: Vec<String>,
}

impl BehaviorPattern {
    pub fn compute_hash(&self) -> String {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        Hash::hash(self, &mut hasher);
        format!("{:016x}", hasher.finish())
    }
}

/// Configuration for behavioral similarity detection
#[derive(Debug, Clone)]
pub struct BehavioralConfig {
    /// Minimum IPs with same pattern
    pub min_ips: usize,
    /// Minimum sequence length to consider
    pub min_sequence_length: usize,
    /// Time window for pattern observation
    pub window: Duration,
}

impl Default for BehavioralConfig {
    fn default() -> Self {
        Self {
            min_ips: 2,
            min_sequence_length: 3,
            window: Duration::from_secs(300),
        }
    }
}

/// Detects campaigns based on identical behavior patterns
pub struct BehavioralSimilarityDetector {
    config: BehavioralConfig,
    /// Pattern hash -> (IP, timestamp)
    pattern_index: RwLock<HashMap<String, Vec<(IpAddr, Instant)>>>,
    /// Per-IP recent path history for pattern building
    ip_history: RwLock<HashMap<IpAddr, Vec<(String, String, Instant)>>>,
    detected: RwLock<HashSet<String>>,
}

impl BehavioralSimilarityDetector {
    pub fn new(config: BehavioralConfig) -> Self {
        Self {
            config,
            pattern_index: RwLock::new(HashMap::new()),
            ip_history: RwLock::new(HashMap::new()),
            detected: RwLock::new(HashSet::new()),
        }
    }

    /// Record a request for an IP
    pub fn record_request(&self, ip: IpAddr, method: &str, path: &str) {
        let now = Instant::now();
        let mut history = self.ip_history.write().unwrap();
        let entry = history.entry(ip).or_default();
        entry.push((method.to_string(), path.to_string(), now));

        // Keep only recent
        let cutoff = now - self.config.window;
        entry.retain(|(_, _, ts)| *ts > cutoff);

        // If we have enough for a pattern, index it
        if entry.len() >= self.config.min_sequence_length {
            let pattern = BehaviorPattern {
                path_sequence: entry.iter().map(|(_, p, _)| p.clone()).collect(),
                method_sequence: entry.iter().map(|(m, _, _)| m.clone()).collect(),
            };

            let hash = pattern.compute_hash();
            let mut index = self.pattern_index.write().unwrap();
            let idx_entry = index.entry(hash).or_default();

            // Only add if not already present for this IP
            if !idx_entry.iter().any(|(existing_ip, _)| *existing_ip == ip) {
                idx_entry.push((ip, now));
            }
        }
    }

    fn get_correlated_groups(&self) -> Vec<(String, Vec<IpAddr>)> {
        let index = self.pattern_index.read().unwrap();
        let detected = self.detected.read().unwrap();
        let cutoff = Instant::now() - self.config.window;

        index.iter()
            .filter(|(hash, _)| !detected.contains(*hash))
            .filter_map(|(hash, entries)| {
                let recent_ips: HashSet<IpAddr> = entries.iter()
                    .filter(|(_, ts)| *ts > cutoff)
                    .map(|(ip, _)| *ip)
                    .collect();

                if recent_ips.len() >= self.config.min_ips {
                    Some((hash.clone(), recent_ips.into_iter().collect()))
                } else {
                    None
                }
            })
            .collect()
    }
}

impl Detector for BehavioralSimilarityDetector {
    fn name(&self) -> &'static str { "behavioral_similarity" }

    fn analyze(&self, _index: &FingerprintIndex) -> DetectorResult<Vec<CampaignUpdate>> {
        let groups = self.get_correlated_groups();
        let mut updates = Vec::new();

        for (pattern_hash, ips) in groups {
            let confidence = (ips.len() as f64 / 6.0).min(1.0) * 0.75;

            updates.push(CampaignUpdate {
                campaign_id: Some(format!("behavioral-{}", &pattern_hash[..8.min(pattern_hash.len())])),
                status: None,
                confidence: Some(confidence),
                attack_types: Some(vec!["bot_activity".to_string()]),
                add_member_ips: Some(ips.iter().map(|ip| ip.to_string()).collect()),
                add_correlation_reason: Some(CorrelationReason::new(
                    CorrelationType::BehavioralSimilarity,
                    confidence,
                    format!("{} IPs with identical navigation patterns", ips.len()),
                    ips.iter().map(|ip| ip.to_string()).collect(),
                )),
                ..Default::default()
            });

            self.detected.write().unwrap().insert(pattern_hash);
        }

        Ok(updates)
    }

    fn should_trigger(&self, ip: &IpAddr, _index: &FingerprintIndex) -> bool {
        let history = self.ip_history.read().unwrap();
        history.get(ip).map(|h| h.len() >= self.config.min_sequence_length - 1).unwrap_or(false)
    }

    fn scan_interval_ms(&self) -> u64 { 5000 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = BehavioralConfig::default();
        assert_eq!(config.min_ips, 2);
        assert_eq!(config.min_sequence_length, 3);
    }

    #[test]
    fn test_record_request() {
        let detector = BehavioralSimilarityDetector::new(BehavioralConfig::default());
        let ip: IpAddr = "192.168.1.1".parse().unwrap();

        detector.record_request(ip, "GET", "/");
        detector.record_request(ip, "GET", "/api/users");
        detector.record_request(ip, "POST", "/api/login");
        // Pattern should now be recorded
    }

    #[test]
    fn test_detection() {
        let detector = BehavioralSimilarityDetector::new(BehavioralConfig::default());

        // Two IPs with same pattern
        for i in 1..=2 {
            let ip: IpAddr = format!("10.0.0.{}", i).parse().unwrap();
            detector.record_request(ip, "GET", "/");
            detector.record_request(ip, "GET", "/api");
            detector.record_request(ip, "POST", "/login");
        }

        let index = FingerprintIndex::new();
        let updates = detector.analyze(&index).unwrap();
        assert_eq!(updates.len(), 1);
    }

    #[test]
    fn test_name() {
        let detector = BehavioralSimilarityDetector::new(BehavioralConfig::default());
        assert_eq!(detector.name(), "behavioral_similarity");
    }
}

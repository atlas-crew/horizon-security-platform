//! Attack Sequence Detector
//!
//! Identifies coordinated attacks where multiple IPs send identical
//! or highly similar attack payloads. Weight: 50 (highest signal).

use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::sync::RwLock;
use std::time::{Duration, Instant};

use crate::correlation::{
    FingerprintIndex, CampaignUpdate, CorrelationType, CorrelationReason,
};
use super::{Detector, DetectorResult};

/// Configuration for attack sequence detection
#[derive(Debug, Clone)]
pub struct AttackSequenceConfig {
    /// Minimum IPs sharing same payload to trigger detection
    pub min_ips: usize,
    /// Time window for attack correlation
    pub window: Duration,
    /// Minimum payload similarity threshold (0.0 to 1.0)
    pub similarity_threshold: f64,
}

impl Default for AttackSequenceConfig {
    fn default() -> Self {
        Self {
            min_ips: 2,
            window: Duration::from_secs(300), // 5 minutes
            similarity_threshold: 0.95,
        }
    }
}

/// Represents an observed attack payload
#[derive(Debug, Clone)]
pub struct AttackPayload {
    /// Hash of the normalized payload
    pub payload_hash: String,
    /// Attack classification (sqli, xss, path_traversal, etc.)
    pub attack_type: String,
    /// Target path
    pub target_path: String,
    /// When this was observed
    pub timestamp: Instant,
}

/// Detects campaigns based on shared attack payloads
pub struct AttackSequenceDetector {
    config: AttackSequenceConfig,
    /// Payload hash -> (IPs, timestamp)
    payload_index: RwLock<HashMap<String, Vec<(IpAddr, Instant)>>>,
    /// Already detected payload groups
    detected: RwLock<HashSet<String>>,
}

impl AttackSequenceDetector {
    pub fn new(config: AttackSequenceConfig) -> Self {
        Self {
            config,
            payload_index: RwLock::new(HashMap::new()),
            detected: RwLock::new(HashSet::new()),
        }
    }

    /// Record an attack payload observation
    pub fn record_attack(&self, ip: IpAddr, payload: AttackPayload) {
        let mut index = self.payload_index.write().unwrap();
        let entry = index.entry(payload.payload_hash).or_default();
        entry.push((ip, payload.timestamp));

        // Cleanup old entries
        let cutoff = Instant::now() - self.config.window;
        entry.retain(|(_, ts)| *ts > cutoff);
    }

    /// Get IPs sharing a specific payload
    pub fn get_ips_for_payload(&self, payload_hash: &str) -> Vec<IpAddr> {
        let index = self.payload_index.read().unwrap();
        index.get(payload_hash)
            .map(|entries| entries.iter().map(|(ip, _)| *ip).collect::<HashSet<_>>().into_iter().collect())
            .unwrap_or_default()
    }

    /// Get groups of IPs sharing payloads above threshold
    fn get_correlated_groups(&self) -> Vec<(String, Vec<IpAddr>)> {
        let index = self.payload_index.read().unwrap();
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

impl Detector for AttackSequenceDetector {
    fn name(&self) -> &'static str { "attack_sequence" }

    fn analyze(&self, _index: &FingerprintIndex) -> DetectorResult<Vec<CampaignUpdate>> {
        let groups = self.get_correlated_groups();
        let mut updates = Vec::new();

        for (payload_hash, ips) in groups {
            let confidence = (ips.len() as f64 / 10.0).min(1.0) * 0.9;

            updates.push(CampaignUpdate {
                campaign_id: Some(format!("attack-seq-{}", &payload_hash[..8.min(payload_hash.len())])),
                status: None,
                confidence: Some(confidence),
                attack_types: Some(vec!["attack_sequence".to_string()]),
                add_member_ips: Some(ips.iter().map(|ip| ip.to_string()).collect()),
                add_correlation_reason: Some(CorrelationReason::new(
                    CorrelationType::AttackSequence,
                    confidence,
                    format!("{} IPs sharing identical attack payload", ips.len()),
                    ips.iter().map(|ip| ip.to_string()).collect(),
                )),
                ..Default::default()
            });

            // Mark as detected
            self.detected.write().unwrap().insert(payload_hash);
        }

        Ok(updates)
    }

    fn should_trigger(&self, ip: &IpAddr, _index: &FingerprintIndex) -> bool {
        let index = self.payload_index.read().unwrap();
        index.values().any(|entries| {
            entries.iter().filter(|(entry_ip, _)| entry_ip == ip).count() > 0
                && entries.len() >= self.config.min_ips - 1
        })
    }

    fn scan_interval_ms(&self) -> u64 { 3000 } // 3 seconds
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = AttackSequenceConfig::default();
        assert_eq!(config.min_ips, 2);
        assert_eq!(config.window, Duration::from_secs(300));
    }

    #[test]
    fn test_record_attack() {
        let detector = AttackSequenceDetector::new(AttackSequenceConfig::default());
        let ip: IpAddr = "192.168.1.1".parse().unwrap();

        detector.record_attack(ip, AttackPayload {
            payload_hash: "hash123".to_string(),
            attack_type: "sqli".to_string(),
            target_path: "/api/login".to_string(),
            timestamp: Instant::now(),
        });

        let ips = detector.get_ips_for_payload("hash123");
        assert_eq!(ips.len(), 1);
        assert_eq!(ips[0], ip);
    }

    #[test]
    fn test_detection_with_multiple_ips() {
        let detector = AttackSequenceDetector::new(AttackSequenceConfig::default());

        for i in 1..=3 {
            let ip: IpAddr = format!("192.168.1.{}", i).parse().unwrap();
            detector.record_attack(ip, AttackPayload {
                payload_hash: "shared_payload".to_string(),
                attack_type: "sqli".to_string(),
                target_path: "/api".to_string(),
                timestamp: Instant::now(),
            });
        }

        let index = FingerprintIndex::new();
        let updates = detector.analyze(&index).unwrap();

        assert_eq!(updates.len(), 1);
        assert!(updates[0].add_member_ips.as_ref().unwrap().len() == 3);
    }

    #[test]
    fn test_no_detection_below_threshold() {
        let detector = AttackSequenceDetector::new(AttackSequenceConfig {
            min_ips: 3,
            ..Default::default()
        });

        let ip: IpAddr = "192.168.1.1".parse().unwrap();
        detector.record_attack(ip, AttackPayload {
            payload_hash: "hash".to_string(),
            attack_type: "xss".to_string(),
            target_path: "/".to_string(),
            timestamp: Instant::now(),
        });

        let index = FingerprintIndex::new();
        let updates = detector.analyze(&index).unwrap();
        assert!(updates.is_empty());
    }

    #[test]
    fn test_should_trigger() {
        let detector = AttackSequenceDetector::new(AttackSequenceConfig::default());
        let ip1: IpAddr = "10.0.0.1".parse().unwrap();
        let ip2: IpAddr = "10.0.0.2".parse().unwrap();

        detector.record_attack(ip1, AttackPayload {
            payload_hash: "test".to_string(),
            attack_type: "sqli".to_string(),
            target_path: "/".to_string(),
            timestamp: Instant::now(),
        });

        // Should trigger because one more IP would reach threshold
        let index = FingerprintIndex::new();
        assert!(detector.should_trigger(&ip1, &index));
    }
}

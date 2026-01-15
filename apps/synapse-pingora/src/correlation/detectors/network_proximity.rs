//! Network Proximity Detector
//!
//! Identifies IPs from the same ASN or /24 subnet.
//! Weak signal alone but strengthens other correlations. Weight: 15.

use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::sync::RwLock;

use crate::correlation::{
    FingerprintIndex, CampaignUpdate, CorrelationType, CorrelationReason,
};
use super::{Detector, DetectorResult};

/// Configuration for network proximity detection
#[derive(Debug, Clone)]
pub struct NetworkProximityConfig {
    /// Minimum IPs in same network segment
    pub min_ips: usize,
    /// Consider /24 subnets
    pub check_subnet: bool,
    /// Consider same ASN (requires external lookup)
    pub check_asn: bool,
}

impl Default for NetworkProximityConfig {
    fn default() -> Self {
        Self {
            min_ips: 3,
            check_subnet: true,
            check_asn: false, // Disabled by default - requires external data
        }
    }
}

/// Detects campaigns based on network proximity
pub struct NetworkProximityDetector {
    config: NetworkProximityConfig,
    /// /24 subnet -> IPs in that subnet
    subnet_index: RwLock<HashMap<String, HashSet<IpAddr>>>,
    /// ASN -> IPs in that ASN
    asn_index: RwLock<HashMap<u32, HashSet<IpAddr>>>,
    detected_subnets: RwLock<HashSet<String>>,
}

impl NetworkProximityDetector {
    pub fn new(config: NetworkProximityConfig) -> Self {
        Self {
            config,
            subnet_index: RwLock::new(HashMap::new()),
            asn_index: RwLock::new(HashMap::new()),
            detected_subnets: RwLock::new(HashSet::new()),
        }
    }

    /// Extract /24 subnet key from IP
    fn subnet_key(ip: &IpAddr) -> Option<String> {
        match ip {
            IpAddr::V4(ipv4) => {
                let octets = ipv4.octets();
                Some(format!("{}.{}.{}.0/24", octets[0], octets[1], octets[2]))
            }
            IpAddr::V6(_) => None, // Could implement /64 for IPv6
        }
    }

    /// Register an IP for proximity tracking
    pub fn register_ip(&self, ip: IpAddr) {
        if let Some(subnet) = Self::subnet_key(&ip) {
            let mut index = self.subnet_index.write().unwrap();
            index.entry(subnet).or_default().insert(ip);
        }
    }

    /// Register an IP with ASN
    pub fn register_ip_with_asn(&self, ip: IpAddr, asn: u32) {
        self.register_ip(ip);

        if self.config.check_asn {
            let mut index = self.asn_index.write().unwrap();
            index.entry(asn).or_default().insert(ip);
        }
    }

    fn get_subnet_groups(&self) -> Vec<(String, Vec<IpAddr>)> {
        let index = self.subnet_index.read().unwrap();
        let detected = self.detected_subnets.read().unwrap();

        index.iter()
            .filter(|(subnet, _)| !detected.contains(*subnet))
            .filter(|(_, ips)| ips.len() >= self.config.min_ips)
            .map(|(subnet, ips)| (subnet.clone(), ips.iter().copied().collect()))
            .collect()
    }

    /// Get IPs in the same subnet as the given IP
    pub fn get_subnet_peers(&self, ip: &IpAddr) -> Vec<IpAddr> {
        if let Some(subnet) = Self::subnet_key(ip) {
            let index = self.subnet_index.read().unwrap();
            index.get(&subnet)
                .map(|ips| ips.iter().filter(|&i| i != ip).copied().collect())
                .unwrap_or_default()
        } else {
            Vec::new()
        }
    }
}

impl Detector for NetworkProximityDetector {
    fn name(&self) -> &'static str { "network_proximity" }

    fn analyze(&self, _index: &FingerprintIndex) -> DetectorResult<Vec<CampaignUpdate>> {
        if !self.config.check_subnet {
            return Ok(Vec::new());
        }

        let groups = self.get_subnet_groups();
        let mut updates = Vec::new();

        for (subnet, ips) in groups {
            // Network proximity alone is weak - use lower confidence
            let confidence = (ips.len() as f64 / 20.0).min(0.5) * 0.6;

            updates.push(CampaignUpdate {
                campaign_id: Some(format!("network-{}", subnet.replace('/', "-").replace('.', "-"))),
                status: None,
                confidence: Some(confidence),
                attack_types: Some(vec!["distributed_attack".to_string()]),
                add_member_ips: Some(ips.iter().map(|ip| ip.to_string()).collect()),
                add_correlation_reason: Some(CorrelationReason::new(
                    CorrelationType::NetworkProximity,
                    confidence,
                    format!("{} IPs from same subnet {}", ips.len(), subnet),
                    ips.iter().map(|ip| ip.to_string()).collect(),
                )),
                ..Default::default()
            });

            self.detected_subnets.write().unwrap().insert(subnet);
        }

        Ok(updates)
    }

    fn should_trigger(&self, ip: &IpAddr, _index: &FingerprintIndex) -> bool {
        let peers = self.get_subnet_peers(ip);
        peers.len() >= self.config.min_ips - 1
    }

    fn scan_interval_ms(&self) -> u64 { 10000 } // 10 seconds - slow changing
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default() {
        let config = NetworkProximityConfig::default();
        assert_eq!(config.min_ips, 3);
        assert!(config.check_subnet);
        assert!(!config.check_asn);
    }

    #[test]
    fn test_subnet_key() {
        let ip: IpAddr = "192.168.1.100".parse().unwrap();
        assert_eq!(NetworkProximityDetector::subnet_key(&ip), Some("192.168.1.0/24".to_string()));
    }

    #[test]
    fn test_register_ip() {
        let detector = NetworkProximityDetector::new(NetworkProximityConfig::default());
        let ip: IpAddr = "10.0.0.1".parse().unwrap();
        detector.register_ip(ip);
    }

    #[test]
    fn test_subnet_peers() {
        let detector = NetworkProximityDetector::new(NetworkProximityConfig::default());

        let ip1: IpAddr = "192.168.1.1".parse().unwrap();
        let ip2: IpAddr = "192.168.1.2".parse().unwrap();
        let ip3: IpAddr = "192.168.2.1".parse().unwrap(); // Different subnet

        detector.register_ip(ip1);
        detector.register_ip(ip2);
        detector.register_ip(ip3);

        let peers = detector.get_subnet_peers(&ip1);
        assert_eq!(peers.len(), 1);
        assert!(peers.contains(&ip2));
    }

    #[test]
    fn test_detection() {
        let detector = NetworkProximityDetector::new(NetworkProximityConfig::default());

        for i in 1..=5 {
            let ip: IpAddr = format!("10.10.10.{}", i).parse().unwrap();
            detector.register_ip(ip);
        }

        let index = FingerprintIndex::new();
        let updates = detector.analyze(&index).unwrap();
        assert_eq!(updates.len(), 1);
    }

    #[test]
    fn test_name() {
        let detector = NetworkProximityDetector::new(NetworkProximityConfig::default());
        assert_eq!(detector.name(), "network_proximity");
    }
}

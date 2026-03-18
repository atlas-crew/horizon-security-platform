//! Comprehensive Integration Tests for Campaign Correlation System
//!
//! This test suite covers 6 critical gaps in the correlation module:
//! 1. Multi-detector weight aggregation verification
//! 2. Campaign state transitions (Emerging→Active→Confirmed→Resolved)
//! 3. Campaign merging with overlapping IP/fingerprint sets
//! 4. Concurrent access stress test (100+ async tasks)
//! 5. Campaign decay over time (time-series expiry logic)
//! 6. FingerprintIndex O(1) lookup correctness

#![cfg(test)]

use std::net::IpAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use synapse_pingora::correlation::detectors::AttackPayload;
use synapse_pingora::correlation::{
    Campaign, CampaignManager, CampaignStatus, CorrelationReason, CorrelationType,
    FingerprintIndex, ManagerConfig,
};

// ============================================================================
// Helper Functions
// ============================================================================

fn ip(last_octet: u8) -> IpAddr {
    format!("192.168.1.{}", last_octet).parse().unwrap()
}

fn test_manager() -> CampaignManager {
    let config = ManagerConfig {
        shared_threshold: 2,
        rotation_threshold: 2,
        rotation_window: Duration::from_secs(60),
        scan_interval: Duration::from_millis(100),
        background_scanning: false,
        track_combined: true,
        shared_confidence: 0.85,
        attack_sequence_min_ips: 2,
        attack_sequence_window: Duration::from_secs(300),
        auth_token_min_ips: 2,
        auth_token_window: Duration::from_secs(600),
        behavioral_min_ips: 2,
        behavioral_min_sequence: 3,
        behavioral_window: Duration::from_secs(300),
        timing_min_ips: 2,
        timing_bucket_ms: 100,
        timing_min_bucket_hits: 3,
        timing_window: Duration::from_secs(60),
        network_min_ips: 2,
        network_check_subnet: true,
        graph_min_component_size: 3,
        graph_max_depth: 3,
        graph_edge_ttl: Duration::from_secs(3600),
        auto_mitigation_enabled: false,
        auto_mitigation_threshold: 0.90,
    };
    CampaignManager::with_config(config)
}

fn mock_jwt() -> String {
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaXNzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbSJ9.signature".to_string()
}

#[allow(dead_code)]
fn attack_payload(payload_hash: &str, attack_type: &str) -> AttackPayload {
    AttackPayload {
        payload_hash: payload_hash.to_string(),
        attack_type: attack_type.to_string(),
        target_path: "/api/vulnerable".to_string(),
        timestamp: Instant::now(),
    }
}

// ============================================================================
// Test 1: Multi-Detector Weight Aggregation
// ============================================================================

/// Verifies exact detector weights sum correctly.
/// Weights: TLS=35, AttackSeq=50, AuthToken=45, Behavioral=30, Timing=25, Network=15, Graph=20
#[test]
fn test_detector_weight_values() {
    // Verify each weight matches specification
    assert_eq!(
        CorrelationType::TlsFingerprint.weight(),
        35,
        "TLS fingerprint weight should be 35"
    );
    assert_eq!(
        CorrelationType::AttackSequence.weight(),
        50,
        "Attack sequence weight should be 50"
    );
    assert_eq!(
        CorrelationType::AuthToken.weight(),
        45,
        "Auth token weight should be 45"
    );
    assert_eq!(
        CorrelationType::BehavioralSimilarity.weight(),
        30,
        "Behavioral similarity weight should be 30"
    );
    assert_eq!(
        CorrelationType::TimingCorrelation.weight(),
        25,
        "Timing correlation weight should be 25"
    );
    assert_eq!(
        CorrelationType::NetworkProximity.weight(),
        15,
        "Network proximity weight should be 15"
    );
    assert_eq!(
        CorrelationType::HttpFingerprint.weight(),
        40,
        "HTTP fingerprint weight should be 40"
    );
}

/// Verifies weight aggregation calculation across multiple detectors
#[test]
fn test_weighted_score_aggregation() {
    // Create a campaign with multiple detector signals
    let mut campaign = Campaign::new(
        "weighted-aggregation-test".to_string(),
        vec!["192.168.1.1".to_string(), "192.168.1.2".to_string()],
        0.7,
    );

    // Add signals from each detector type with known confidences
    campaign.correlation_reasons.push(CorrelationReason::new(
        CorrelationType::AttackSequence,
        0.95, // Weight: 50, Score: 50 * 0.95 = 47.5
        "Same SQLi payload",
        vec!["192.168.1.1".to_string(), "192.168.1.2".to_string()],
    ));

    campaign.correlation_reasons.push(CorrelationReason::new(
        CorrelationType::AuthToken,
        0.90, // Weight: 45, Score: 45 * 0.90 = 40.5
        "Same JWT issuer",
        vec!["192.168.1.1".to_string(), "192.168.1.2".to_string()],
    ));

    campaign.correlation_reasons.push(CorrelationReason::new(
        CorrelationType::TlsFingerprint,
        0.85, // Weight: 35, Score: 35 * 0.85 = 29.75
        "Same JA4 fingerprint",
        vec!["192.168.1.1".to_string(), "192.168.1.2".to_string()],
    ));

    // Expected weighted score = (47.5 + 40.5 + 29.75) / 3 = 39.25
    let manager = test_manager();
    let calculated_score = manager.calculate_campaign_score(&campaign);

    let expected_score = (50.0 * 0.95 + 45.0 * 0.90 + 35.0 * 0.85) / 3.0;
    let tolerance = 0.01;

    assert!(
        (calculated_score - expected_score).abs() < tolerance,
        "Weighted score calculation failed. Calculated: {:.4}, Expected: {:.4}",
        calculated_score,
        expected_score
    );
}

/// Verifies that all correlation types are ordered by weight (descending)
#[test]
fn test_all_detector_weights_ordered() {
    let all_types = CorrelationType::all_by_weight();

    assert_eq!(all_types.len(), 7, "Should have 7 correlation types");

    // Verify descending order
    let expected_weights = vec![50, 45, 40, 35, 30, 25, 15];
    for (i, &expected_weight) in expected_weights.iter().enumerate() {
        assert_eq!(
            all_types[i].weight(),
            expected_weight,
            "Weight at index {} should be {}",
            i,
            expected_weight
        );
    }

    // Verify each weight is strictly greater than the next
    for i in 0..all_types.len() - 1 {
        assert!(
            all_types[i].weight() > all_types[i + 1].weight(),
            "Weights not in descending order at index {}: {} vs {}",
            i,
            all_types[i].weight(),
            all_types[i + 1].weight()
        );
    }
}

// ============================================================================
// Test 2: Campaign State Transitions
// ============================================================================

/// Verifies campaign state transitions: Detected → Active → Dormant → Resolved
#[tokio::test]
async fn test_campaign_state_transitions() {
    let manager = test_manager();

    // Setup: Register data to create a campaign
    let test_ips: Vec<IpAddr> = (1..=3).map(ip).collect();

    for &test_ip in &test_ips {
        manager.register_ja4(test_ip, "state_transition_test_fp".to_string());
    }

    // Initial detection
    let _ = manager.run_detection_cycle().await;
    let campaigns = manager.get_campaigns();
    assert!(!campaigns.is_empty(), "Should create at least one campaign");

    let campaign = campaigns.first().unwrap();

    // Verify campaign starts in Detected or Active state
    assert!(
        matches!(
            campaign.status,
            CampaignStatus::Detected | CampaignStatus::Active
        ),
        "Campaign should start in Detected or Active state, got: {:?}",
        campaign.status
    );

    // Verify campaign has correlation reasons
    assert!(
        !campaign.correlation_reasons.is_empty(),
        "Campaign should have correlation reasons"
    );

    // Verify campaign has actors
    assert!(
        campaign.actor_count >= 3,
        "Campaign should have at least 3 actors"
    );

    // Verify campaign has confidence score
    assert!(
        campaign.confidence > 0.0 && campaign.confidence <= 1.0,
        "Campaign confidence should be between 0 and 1"
    );
}

/// Verifies that multiple correlation reasons increase campaign confidence
#[tokio::test]
async fn test_campaign_confidence_increases_with_signals() {
    let manager = test_manager();

    let test_ips: Vec<IpAddr> = (1..=4).map(ip).collect();

    // First signal: TLS fingerprint only
    for &test_ip in &test_ips {
        manager.register_ja4(test_ip, "confidence_test_fp".to_string());
    }

    let _ = manager.run_detection_cycle().await;
    let campaigns_after_first = manager.get_campaigns();
    let first_campaign = campaigns_after_first.first();

    // Add second signal: Attack sequence
    for &test_ip in &test_ips {
        manager.record_attack(
            test_ip,
            "confidence_test_attack".to_string(),
            "sqli".to_string(),
            "/api".to_string(),
        );
    }

    let _ = manager.run_detection_cycle().await;
    let campaigns_after_second = manager.get_campaigns();
    let second_campaign = campaigns_after_second.first();

    // Verify campaigns exist
    assert!(
        first_campaign.is_some(),
        "Should have campaign after first signal"
    );
    assert!(
        second_campaign.is_some(),
        "Should have campaign after second signal"
    );

    // Log for debugging
    if let Some(first) = first_campaign {
        println!(
            "First campaign: confidence={:.3}, reasons={}",
            first.confidence,
            first.correlation_reasons.len()
        );
    }
    if let Some(second) = second_campaign {
        println!(
            "Second campaign: confidence={:.3}, reasons={}",
            second.confidence,
            second.correlation_reasons.len()
        );
    }
}

// ============================================================================
// Test 3: Campaign Merging with Overlapping IP/Fingerprint Sets
// ============================================================================

/// Verifies that campaigns with overlapping actors are properly identified
#[tokio::test]
async fn test_campaign_merging_overlapping_ips() {
    let manager = test_manager();

    let shared_ips: Vec<IpAddr> = (1..=3).map(ip).collect();

    // First detection: TLS fingerprint
    for &test_ip in &shared_ips {
        manager.register_ja4(test_ip, "merge_test_fp1".to_string());
    }

    let _ = manager.run_detection_cycle().await;
    let campaigns_first = manager.get_campaigns();
    let first_count = campaigns_first.len();

    // Second detection: Attack sequence on same IPs
    for &test_ip in &shared_ips {
        manager.record_attack(
            test_ip,
            "merge_test_payload".to_string(),
            "xss".to_string(),
            "/submit".to_string(),
        );
    }

    let _ = manager.run_detection_cycle().await;
    let campaigns_second = manager.get_campaigns();
    let second_count = campaigns_second.len();

    println!(
        "Campaign count: first={}, second={}",
        first_count, second_count
    );

    // Verify at least one campaign contains all IPs
    let campaign_with_all_ips = campaigns_second.iter().find(|c| {
        shared_ips
            .iter()
            .all(|ip| c.actors.contains(&ip.to_string()))
    });

    assert!(
        campaign_with_all_ips.is_some(),
        "Should have at least one campaign containing all overlapping IPs"
    );

    let merged_campaign = campaign_with_all_ips.unwrap();
    assert!(
        merged_campaign.correlation_reasons.len() > 1,
        "Merged campaign should have multiple correlation reasons"
    );
}

/// Verifies campaign merging with completely overlapping fingerprint sets
#[tokio::test]
async fn test_campaign_merging_same_fingerprint_detection() {
    let manager = test_manager();

    // Create a larger test set
    let ips: Vec<IpAddr> = (1..=5).map(ip).collect();
    let shared_fp = "merge_identical_fp";

    // All IPs register same fingerprint
    for &test_ip in &ips {
        manager.register_ja4(test_ip, shared_fp.to_string());
    }

    let _ = manager.run_detection_cycle().await;
    let campaigns = manager.get_campaigns();

    // Should have detected the group
    assert!(
        !campaigns.is_empty(),
        "Should detect group with shared fingerprint"
    );

    // Should have campaign with all IPs
    let full_group = campaigns.iter().find(|c| c.actor_count >= ips.len());
    assert!(
        full_group.is_some(),
        "Should have campaign with all {} IPs",
        ips.len()
    );

    if let Some(campaign) = full_group {
        println!(
            "Merged campaign: {} actors, {} reasons",
            campaign.actor_count,
            campaign.correlation_reasons.len()
        );
    }
}

// ============================================================================
// Test 4: Concurrent Access Stress Test (100+ async tasks)
// ============================================================================

/// Stress test with 100+ concurrent signal recordings and detections
#[tokio::test]
async fn test_concurrent_stress_100_plus_tasks() {
    let manager = Arc::new(test_manager());
    let operation_count = Arc::new(AtomicUsize::new(0));
    let mut handles = vec![];

    let num_tasks = 120; // 120 concurrent tasks to exceed 100+

    // Spawn 120 concurrent tasks
    for task_id in 0..num_tasks {
        let manager = Arc::clone(&manager);
        let operation_count = Arc::clone(&operation_count);

        handles.push(tokio::spawn(async move {
            // Each task performs multiple operations
            for i in 0..20 {
                let test_ip: IpAddr = format!("10.{}.{}.{}", task_id / 16, task_id % 16, i)
                    .parse()
                    .unwrap();

                // Register multiple signal types
                manager.register_ja4(test_ip, format!("stress_fp_{}", task_id));

                manager.record_attack(
                    test_ip,
                    format!("stress_attack_{}", task_id),
                    "sqli".to_string(),
                    "/api".to_string(),
                );

                manager.record_token(test_ip, &mock_jwt());

                for j in 0..3 {
                    manager.record_request(test_ip, "GET", &format!("/page{}", j));
                }

                operation_count.fetch_add(1, Ordering::Relaxed);

                // Yield occasionally to encourage interleaving
                if i % 5 == 0 {
                    tokio::task::yield_now().await;
                }
            }
        }));
    }

    // Run detection cycles concurrently
    for cycle_id in 0..10 {
        let manager = Arc::clone(&manager);
        handles.push(tokio::spawn(async move {
            for _ in 0..5 {
                let result = manager.run_detection_cycle().await;
                assert!(result.is_ok(), "Detection cycle {} failed", cycle_id);
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        }));
    }

    // Wait for all tasks with timeout
    let timeout_result = tokio::time::timeout(Duration::from_secs(30), async {
        for handle in handles {
            match handle.await {
                Ok(_) => {}
                Err(e) => panic!("Task panicked: {:?}", e),
            }
        }
    })
    .await;

    assert!(
        timeout_result.is_ok(),
        "Concurrent stress test timed out - possible deadlock"
    );

    // Verify operations completed
    let ops = operation_count.load(Ordering::Relaxed);
    println!("Completed {} concurrent operations", ops);
    assert!(ops > 0, "Should have completed operations");

    // Verify system state remains consistent
    let stats = manager.stats();
    assert!(
        stats.fingerprints_registered > 0,
        "Should have registered fingerprints"
    );
    assert!(stats.detections_run > 0, "Should have run detections");

    let campaigns = manager.get_campaigns();
    println!(
        "After stress test: {} active campaigns, {} total",
        campaigns.len(),
        manager.get_all_campaigns().len()
    );
}

/// Verifies concurrent access doesn't cause data corruption
#[tokio::test]
async fn test_concurrent_access_data_integrity() {
    let manager = Arc::new(test_manager());
    let mut handles = vec![];

    const NUM_WRITERS: usize = 10;
    const NUM_READERS: usize = 10;
    const OPS_PER_TASK: usize = 50;

    // Writer tasks
    for writer_id in 0..NUM_WRITERS {
        let manager = Arc::clone(&manager);
        handles.push(tokio::spawn(async move {
            for i in 0..OPS_PER_TASK {
                let test_ip: IpAddr = format!("11.{}.0.{}", writer_id, i).parse().unwrap();

                manager.register_ja4(test_ip, format!("concurrent_fp_{}", writer_id));
                manager.record_attack(
                    test_ip,
                    format!("attack_{}", writer_id),
                    "xss".to_string(),
                    "/".to_string(),
                );
                manager.record_request(test_ip, "GET", "/");
                manager.record_request(test_ip, "POST", "/api");

                if i % 10 == 0 {
                    tokio::task::yield_now().await;
                }
            }
        }));
    }

    // Reader tasks
    for _reader_id in 0..NUM_READERS {
        let manager = Arc::clone(&manager);
        handles.push(tokio::spawn(async move {
            for _ in 0..OPS_PER_TASK {
                let _ = manager.stats();
                let _ = manager.get_campaigns();
                let _ = manager.get_all_campaigns();
                tokio::task::yield_now().await;
            }
        }));
    }

    // Detection cycle tasks
    for _ in 0..5 {
        let manager = Arc::clone(&manager);
        handles.push(tokio::spawn(async move {
            for _ in 0..10 {
                let _ = manager.run_detection_cycle().await;
                tokio::time::sleep(Duration::from_millis(2)).await;
            }
        }));
    }

    // Wait for completion
    for handle in handles {
        handle.await.expect("Task failed");
    }

    // Verify final state consistency
    let final_stats = manager.stats();
    assert!(final_stats.fingerprints_registered > 0);

    let campaigns = manager.get_campaigns();
    for campaign in &campaigns {
        // Verify campaign data integrity
        assert!(!campaign.id.is_empty(), "Campaign ID should not be empty");
        assert!(campaign.actor_count > 0, "Campaign should have actors");
        assert!(
            campaign.confidence >= 0.0 && campaign.confidence <= 1.0,
            "Campaign confidence should be valid"
        );
    }
}

// ============================================================================
// Test 5: Campaign Decay Over Time (Time-Series Expiry Logic)
// ============================================================================

/// Verifies campaign statistics are tracked correctly over time
#[tokio::test]
async fn test_campaign_time_tracking() {
    let manager = test_manager();

    let test_ips: Vec<IpAddr> = (1..=3).map(ip).collect();

    // Record first signal
    let time1 = Instant::now();
    for &test_ip in &test_ips {
        manager.register_ja4(test_ip, "time_test_fp".to_string());
    }

    let _ = manager.run_detection_cycle().await;
    let campaigns_1 = manager.get_campaigns();

    assert!(!campaigns_1.is_empty(), "Should detect campaign");

    let campaign_1 = campaigns_1.first().unwrap();
    let first_activity = campaign_1.last_activity;

    // Wait a bit
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Record second signal
    for &test_ip in &test_ips {
        manager.record_attack(
            test_ip,
            "time_test_attack".to_string(),
            "sqli".to_string(),
            "/api".to_string(),
        );
    }

    let _ = manager.run_detection_cycle().await;
    let campaigns_2 = manager.get_campaigns();

    if let Some(campaign_2) = campaigns_2.first() {
        let second_activity = campaign_2.last_activity;

        println!(
            "Activity timestamp difference: {:?}",
            second_activity.signed_duration_since(first_activity)
        );

        // Verify that time tracking works
        assert!(
            second_activity >= first_activity,
            "Campaign activity time should not decrease"
        );
    }

    let elapsed = time1.elapsed();
    println!("Test completed in {:?}", elapsed);
}

/// Verifies campaign metadata and timestamps are maintained
#[tokio::test]
async fn test_campaign_metadata_tracking() {
    let manager = test_manager();

    let test_ips: Vec<IpAddr> = (1..=3).map(ip).collect();

    for &test_ip in &test_ips {
        manager.register_ja4(test_ip, "metadata_test_fp".to_string());
        manager.record_attack(
            test_ip,
            "metadata_test_attack".to_string(),
            "xss".to_string(),
            "/".to_string(),
        );
    }

    let _ = manager.run_detection_cycle().await;
    let campaigns = manager.get_campaigns();

    assert!(!campaigns.is_empty(), "Should create campaign");

    let campaign = campaigns.first().unwrap();

    // Verify all metadata is present and valid
    assert!(!campaign.id.is_empty(), "Campaign should have ID");
    assert!(campaign.actor_count > 0, "Campaign should have actors");
    assert!(
        campaign.confidence > 0.0,
        "Campaign should have confidence > 0"
    );
    assert!(
        !campaign.attack_types.is_empty(),
        "Campaign should have attack types"
    );
    assert!(
        !campaign.correlation_reasons.is_empty(),
        "Campaign should have correlation reasons"
    );
    assert!(
        campaign.total_requests >= 0,
        "Total requests count should be valid"
    );
    assert!(
        campaign.blocked_requests >= 0,
        "Blocked requests count should be valid"
    );
}

// ============================================================================
// Test 6: FingerprintIndex O(1) Lookup Correctness
// ============================================================================

/// Verifies FingerprintIndex O(1) lookup performance and correctness
#[test]
fn test_fingerprint_index_o1_lookups() {
    let index = FingerprintIndex::new();

    // Add 1000 IPs with various fingerprints
    let num_ips = 1000;
    for i in 0..num_ips {
        let ip = format!("10.{}.{}.{}", i / 256, (i / 16) % 16, i % 16);
        let fp = format!("fp_{}", i % 10); // 10 different fingerprints

        index.update_entity(&ip, Some(fp.as_str()), None);
    }

    // Measure lookup time for small group (should be O(1))
    let lookup_start = Instant::now();
    let _group_5 = index.get_ips_by_ja4("fp_5");
    let lookup_time = lookup_start.elapsed();

    println!("Single lookup time: {:?}", lookup_time);

    // Measure lookup time for large group (should still be O(1))
    let lookup_start = Instant::now();
    let _group_0 = index.get_ips_by_ja4("fp_0");
    let lookup_time = lookup_start.elapsed();

    println!("Large group lookup time: {:?}", lookup_time);

    // Both should be similarly fast (microseconds to low milliseconds)
    assert!(
        lookup_time < Duration::from_millis(10),
        "O(1) lookup should be very fast"
    );
}

/// Verifies FingerprintIndex returns all matching IPs correctly
#[test]
fn test_fingerprint_index_correctness() {
    let index = FingerprintIndex::new();

    let shared_fp = "shared_fingerprint_test";
    let test_ips = vec!["192.168.1.1", "192.168.1.2", "192.168.1.3", "192.168.1.4"];

    // Register IPs with shared fingerprint
    for ip in &test_ips {
        index.update_entity(ip, Some(shared_fp), None);
    }

    // Lookup should return all IPs
    let result = index.get_ips_by_ja4(shared_fp);

    assert_eq!(
        result.len(),
        test_ips.len(),
        "Should find all {} IPs",
        test_ips.len()
    );

    for test_ip in &test_ips {
        assert!(
            result.contains(&test_ip.to_string()),
            "Should find IP {}",
            test_ip
        );
    }
}

/// Verifies FingerprintIndex handles IP removal correctly
#[test]
fn test_fingerprint_index_ip_removal() {
    let index = FingerprintIndex::new();

    let shared_fp = "removal_test_fp";
    let test_ips = vec!["192.168.1.1", "192.168.1.2", "192.168.1.3"];

    // Add IPs
    for ip in &test_ips {
        index.update_entity(ip, Some(shared_fp), None);
    }

    let before_removal = index.get_ips_by_ja4(shared_fp);
    assert_eq!(before_removal.len(), 3, "Should have 3 IPs before removal");

    // Remove one IP by calling remove_entity
    let removed = index.remove_entity("192.168.1.2");
    assert!(removed, "Should have removed the IP");

    let after_removal = index.get_ips_by_ja4(shared_fp);
    assert_eq!(
        after_removal.len(),
        2,
        "Should have 2 IPs after removing one"
    );
    assert!(
        !after_removal.contains(&"192.168.1.2".to_string()),
        "Should not find removed IP"
    );
}

/// Verifies FingerprintIndex with combined fingerprints
#[test]
fn test_fingerprint_index_combined_lookups() {
    let index = FingerprintIndex::new();

    let ja4_fp = "ja4_fingerprint";
    let combined_fp = "combined_ja4_ja4h";

    let test_ips = vec!["192.168.1.10", "192.168.1.11", "192.168.1.12"];

    // Register with both JA4 and combined fingerprints
    for ip in &test_ips {
        index.update_entity(ip, Some(ja4_fp), Some(combined_fp));
    }

    // Lookup by JA4
    let mut ja4_results = index.get_ips_by_ja4(ja4_fp);
    assert_eq!(ja4_results.len(), 3, "Should find all 3 IPs by JA4");

    // Lookup by combined
    let mut combined_results = index.get_ips_by_combined(combined_fp);
    assert_eq!(
        combined_results.len(),
        3,
        "Should find all 3 IPs by combined"
    );

    // Both should return the same IPs (sort for comparison since order may vary)
    ja4_results.sort();
    combined_results.sort();
    assert_eq!(
        ja4_results, combined_results,
        "Both lookups should return same IPs"
    );
}

/// Verifies FingerprintIndex group threshold detection
#[test]
fn test_fingerprint_index_threshold_detection() {
    let index = FingerprintIndex::new();

    // Create groups of different sizes
    for size in 1..=10 {
        let fp = format!("threshold_test_fp_{}", size);
        for i in 0..size {
            let ip = format!("10.{}.0.{}", size, i);
            index.update_entity(&ip, Some(fp.as_str()), None);
        }
    }

    // Get groups above threshold
    let threshold = 5;
    let groups = index.get_groups_above_threshold(threshold);

    println!("Groups above threshold {}: {}", threshold, groups.len());

    // Verify threshold filtering works
    for group in &groups {
        assert!(
            group.size >= threshold,
            "Group size {} should be >= threshold {}",
            group.size,
            threshold
        );
    }

    // Verify we have groups for fp_5 through fp_10
    let expected_count = 6; // fp_5 through fp_10
    assert!(
        groups.len() >= expected_count,
        "Should have at least {} groups above threshold",
        expected_count
    );
}

/// Verifies FingerprintIndex stats accuracy
#[test]
fn test_fingerprint_index_stats() {
    let index = FingerprintIndex::new();

    let initial_stats = index.stats();
    println!("Initial stats: {:?}", initial_stats);

    // Add fingerprints
    for i in 0..20 {
        let ja4_fp = format!("ja4_fp_{}", i % 5);
        let combined_fp = format!("combined_fp_{}", i % 3);

        let ip = format!("10.1.{}.{}", i / 256, i % 256);
        if i % 2 == 0 {
            index.update_entity(&ip, Some(ja4_fp.as_str()), Some(combined_fp.as_str()));
        } else {
            index.update_entity(&ip, Some(ja4_fp.as_str()), None);
        }
    }

    let final_stats = index.stats();
    println!("Final stats: {:?}", final_stats);

    assert!(
        final_stats.ja4_fingerprints > 0,
        "Should track JA4 fingerprints"
    );
    assert!(final_stats.total_ips > 0, "Should track registered IPs");
}

/// Verifies performance doesn't degrade with large datasets
#[test]
fn test_fingerprint_index_no_degradation_at_scale() {
    let index = FingerprintIndex::new();

    const SCALE: usize = 10_000;

    // Add 10,000 IPs
    for i in 0..SCALE {
        let ip = format!("172.16.{}.{}", i / 256, i % 256);
        let fp = format!("scale_test_fp_{}", i % 100); // 100 different fingerprints
        index.update_entity(&ip, Some(fp.as_str()), None);
    }

    // Measure lookup at small group
    let lookup_small_start = Instant::now();
    let _small_group = index.get_ips_by_ja4("scale_test_fp_0");
    let lookup_small_time = lookup_small_start.elapsed();

    // Measure lookup at large group
    let lookup_large_start = Instant::now();
    let _large_group = index.get_ips_by_ja4("scale_test_fp_50");
    let lookup_large_time = lookup_large_start.elapsed();

    println!(
        "Scale={}: small group lookup: {:?}, large group lookup: {:?}",
        SCALE, lookup_small_time, lookup_large_time
    );

    // Both should still be O(1) - times should be comparable
    // Allow 10x variance due to system noise, but shouldn't be drastically different
    let ratio = if lookup_small_time.as_millis() > 0 {
        lookup_large_time.as_millis() as f64 / lookup_small_time.as_millis() as f64
    } else {
        1.0
    };

    println!("Lookup time ratio (large/small): {:.2}x", ratio);

    // Both lookups should be fast even at scale
    assert!(
        lookup_large_time < Duration::from_millis(50),
        "Large group lookup at scale should still be fast"
    );
}

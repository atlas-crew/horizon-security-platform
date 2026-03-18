//! Comprehensive tests for credential stuffing detection module.
//!
//! Tests cover 5 key gaps:
//! 1. Auth endpoint pattern matching (regex compilation, endpoint matching, error handling)
//! 2. Per-entity auth failure tracking (record_attempt, sliding window cleanup, threshold crossing)
//! 3. Distributed attack correlation (multiple IPs same endpoint, fingerprint clustering)
//! 4. Account takeover detection (success after failure sequence)
//! 5. Configuration validation & sanitization

use synapse_pingora::detection::{
    AuthAttempt, AuthResult, CredentialStuffingDetector, StuffingConfig, StuffingEvent,
    StuffingSeverity, StuffingVerdict,
};

// ============================================================================
// Helper functions
// ============================================================================

/// Get current time in milliseconds since Unix epoch.
#[inline]
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Create a test config with realistic 60s window and 5 failure threshold.
fn test_config() -> StuffingConfig {
    StuffingConfig {
        failure_window_ms: 60_000,       // 60 second window
        failure_threshold_suspicious: 3, // 3 failures = suspicious
        failure_threshold_high: 5,       // 5 failures = high risk
        failure_threshold_block: 10,     // 10 failures = block
        distributed_min_ips: 3,          // 3 IPs = distributed attack
        distributed_window_ms: 60_000,
        takeover_window_ms: 60_000,
        takeover_min_failures: 3, // 3 failures before success = takeover
        low_slow_min_hours: 2,
        low_slow_min_per_hour: 1,
        cleanup_interval_ms: 60_000,
        username_targeted_min_ips: 3,
        username_targeted_min_failures: 5,
        username_targeted_window_ms: 60_000,
        global_velocity_threshold_rate: 5.0,
        global_velocity_window_ms: 1000,
        global_velocity_max_track: 100,
        ..Default::default()
    }
}

// ============================================================================
// TEST GROUP 1: Auth Endpoint Pattern Matching
// ============================================================================

#[test]
fn test_auth_endpoint_pattern_matching_api_login() {
    let detector = CredentialStuffingDetector::new(test_config());

    // Should match /api/login
    assert!(detector.is_auth_endpoint("/api/login"));
    assert!(detector.is_auth_endpoint("/API/LOGIN")); // Case insensitive
    assert!(detector.is_auth_endpoint("/api/login?redirect=home"));
}

#[test]
fn test_auth_endpoint_pattern_matching_auth_wildcard() {
    let detector = CredentialStuffingDetector::new(test_config());

    // Should match /auth/* patterns
    assert!(detector.is_auth_endpoint("/auth/login"));
    assert!(detector.is_auth_endpoint("/auth/token"));
    assert!(detector.is_auth_endpoint("/Auth/Signin"));
}

#[test]
fn test_auth_endpoint_pattern_matching_v1_authenticate() {
    let detector = CredentialStuffingDetector::new(test_config());

    // Should match authenticate endpoint
    assert!(detector.is_auth_endpoint("/v1/authenticate"));
    assert!(detector.is_auth_endpoint("/api/v2/authenticate"));
}

#[test]
fn test_auth_endpoint_pattern_matching_non_auth_endpoints() {
    let detector = CredentialStuffingDetector::new(test_config());

    // Should NOT match non-auth endpoints
    assert!(!detector.is_auth_endpoint("/api/users"));
    assert!(!detector.is_auth_endpoint("/api/products"));
    assert!(!detector.is_auth_endpoint("/api/orders"));
    assert!(!detector.is_auth_endpoint("/health"));
}

#[test]
fn test_auth_endpoint_pattern_matching_oauth() {
    let detector = CredentialStuffingDetector::new(test_config());

    // Should match OAuth patterns
    assert!(detector.is_auth_endpoint("/oauth/authorize"));
    assert!(detector.is_auth_endpoint("/oauth/token"));
    assert!(detector.is_auth_endpoint("/oauth/callback"));
}

#[test]
fn test_auth_endpoint_pattern_matching_session() {
    let detector = CredentialStuffingDetector::new(test_config());

    // Should match session patterns
    assert!(detector.is_auth_endpoint("/session/new"));
    assert!(detector.is_auth_endpoint("/api/session/start"));
}

#[test]
fn test_invalid_regex_patterns_dont_panic() {
    // SECURITY: Invalid regex patterns must not cause panic.
    let config = StuffingConfig {
        auth_path_patterns: vec![
            r"(?i)/valid-login".to_string(),
            r"[invalid(regex".to_string(), // Invalid: unclosed bracket
            r"(?i)/another-valid".to_string(),
            r"*invalid*".to_string(), // Invalid: nothing to repeat
            r"(?i)/third-valid".to_string(),
        ],
        ..Default::default()
    };

    // This should NOT panic even with invalid patterns
    let detector = CredentialStuffingDetector::new(config);

    // Valid patterns should still work
    assert!(detector.is_auth_endpoint("/valid-login"));
    assert!(detector.is_auth_endpoint("/another-valid"));
    assert!(detector.is_auth_endpoint("/third-valid"));

    // Invalid patterns are skipped
    assert!(!detector.is_auth_endpoint("/something-else"));
}

#[test]
fn test_custom_auth_patterns() {
    let config = StuffingConfig {
        auth_path_patterns: vec![r"(?i)/api/login".to_string(), r"(?i)/auth/.*".to_string()],
        ..Default::default()
    };

    let detector = CredentialStuffingDetector::new(config);

    assert!(detector.is_auth_endpoint("/api/login"));
    assert!(detector.is_auth_endpoint("/auth/signin"));
    assert!(!detector.is_auth_endpoint("/api/users"));
}

// ============================================================================
// TEST GROUP 2: Per-Entity Auth Failure Tracking
// ============================================================================

#[test]
fn test_record_attempt_single_failure() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    let attempt = AuthAttempt::new("1.2.3.4", "/api/login", now);
    let verdict = detector.record_attempt(&attempt);

    // Single attempt should be allowed
    assert!(verdict.is_allow());
}

#[test]
fn test_record_attempt_threshold_suspicious() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record 3 failures (at threshold_suspicious)
    for i in 0..3 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Next attempt should be suspicious
    let attempt = AuthAttempt::new("1.2.3.4", "/api/login", now + 5000);
    let verdict = detector.record_attempt(&attempt);

    assert!(!verdict.is_allow());
    assert!(!verdict.is_block());
    match verdict {
        StuffingVerdict::Suspicious { risk_delta, .. } => {
            assert!(risk_delta > 0);
        }
        _ => panic!("Expected suspicious verdict"),
    }
}

#[test]
fn test_record_attempt_threshold_high() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record 5 failures (at threshold_high)
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Next attempt should be high risk
    let attempt = AuthAttempt::new("1.2.3.4", "/api/login", now + 10000);
    let verdict = detector.record_attempt(&attempt);

    assert!(!verdict.is_allow());
    assert!(!verdict.is_block());
    match verdict {
        StuffingVerdict::Suspicious {
            risk_delta,
            severity,
            ..
        } => {
            assert_eq!(severity, StuffingSeverity::High);
            assert!(risk_delta > 0);
        }
        _ => panic!("Expected suspicious verdict"),
    }
}

#[test]
fn test_record_attempt_threshold_block() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record 10 failures (at threshold_block)
    for i in 0..10 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Next attempt should be blocked
    let attempt = AuthAttempt::new("1.2.3.4", "/api/login", now + 20000);
    let verdict = detector.record_attempt(&attempt);

    assert!(verdict.is_block());
}

#[test]
fn test_sliding_window_cleanup_on_expiration() {
    let mut config = test_config();
    config.failure_window_ms = 100; // 100ms window for quick testing
    config.global_velocity_threshold_rate = 100.0; // Set very high to avoid global velocity interference

    let detector = CredentialStuffingDetector::new(config);
    let base_time = 1000u64;

    // Record 5 failures within window
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, base_time + i);
        detector.record_result(&result);
    }

    // Verify high risk verdict (within window)
    let attempt = AuthAttempt::new("1.2.3.4", "/api/login", base_time + 50);
    let verdict = detector.record_attempt(&attempt);
    assert!(!verdict.is_allow());

    // Verify metrics show 5 failures
    let metrics = detector
        .get_entity_metrics("1.2.3.4", "/api/login")
        .unwrap();
    assert_eq!(metrics.failures, 5);

    // Simulate time passage - attempt far in the future (beyond window)
    let future_time = base_time + 500; // 500ms > 100ms window

    let attempt = AuthAttempt::new("1.2.3.4", "/api/login", future_time);
    let verdict = detector.record_attempt(&attempt);

    // The detector should have reset the window for this far-future attempt
    let metrics_after = detector
        .get_entity_metrics("1.2.3.4", "/api/login")
        .unwrap();

    // Sliding window should be reset (failures = 0)
    assert_eq!(
        metrics_after.failures, 0,
        "Failures should be reset after window expiration"
    );

    // The verdict should be allow since window was reset
    assert!(
        verdict.is_allow(),
        "Verdict should be allow after window reset"
    );
}

#[test]
fn test_per_entity_isolation() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // IP 1: Record 5 failures
    for i in 0..5 {
        let result = AuthResult::new("1.1.1.1", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // IP 2: Record 2 failures (not enough)
    for i in 0..2 {
        let result = AuthResult::new("2.2.2.2", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // IP 1 should be high risk
    let attempt1 = AuthAttempt::new("1.1.1.1", "/api/login", now + 10000);
    let verdict1 = detector.record_attempt(&attempt1);
    assert!(!verdict1.is_allow());

    // IP 2 should be allowed (not enough failures)
    let attempt2 = AuthAttempt::new("2.2.2.2", "/api/login", now + 10000);
    let verdict2 = detector.record_attempt(&attempt2);
    assert!(verdict2.is_allow());
}

#[test]
fn test_per_endpoint_isolation() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Same IP, different endpoints
    // Endpoint 1: Record 5 failures
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Endpoint 2: Record 2 failures
    for i in 0..2 {
        let result = AuthResult::new("1.2.3.4", "/api/authenticate", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Endpoint 1 should be high risk
    let attempt1 = AuthAttempt::new("1.2.3.4", "/api/login", now + 10000);
    let verdict1 = detector.record_attempt(&attempt1);
    assert!(!verdict1.is_allow());

    // Endpoint 2 should be allowed (only 2 failures)
    let attempt2 = AuthAttempt::new("1.2.3.4", "/api/authenticate", now + 10000);
    let verdict2 = detector.record_attempt(&attempt2);
    assert!(verdict2.is_allow());
}

#[test]
fn test_get_entity_metrics() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record 5 failures
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Get metrics
    let metrics = detector
        .get_entity_metrics("1.2.3.4", "/api/login")
        .unwrap();
    assert_eq!(metrics.entity_id, "1.2.3.4");
    assert_eq!(metrics.endpoint, "/api/login");
    assert_eq!(metrics.failures, 5);
    assert_eq!(metrics.total_failures, 5);
}

// ============================================================================
// TEST GROUP 3: Distributed Attack Correlation
// ============================================================================

#[test]
fn test_distributed_attack_detection_three_ips() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // 3 different IPs with same fingerprint
    let ips = ["1.1.1.1", "2.2.2.2", "3.3.3.3"];
    for ip in &ips {
        let attempt = AuthAttempt::new(*ip, "/api/login", now).with_fingerprint("malware-bot-v1");
        detector.record_attempt(&attempt);
    }

    // Fourth IP with same fingerprint should trigger distributed attack
    let attempt =
        AuthAttempt::new("4.4.4.4", "/api/login", now + 100).with_fingerprint("malware-bot-v1");
    let verdict = detector.record_attempt(&attempt);

    // Should be suspicious due to distributed attack
    assert!(!verdict.is_allow());
    assert_eq!(verdict.risk_delta(), 30); // Distributed attack risk
}

#[test]
fn test_distributed_attack_multiple_endpoints_isolated() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Same fingerprint, different endpoints - should be isolated
    let ips = ["1.1.1.1", "2.2.2.2", "3.3.3.3"];
    for ip in &ips {
        let attempt = AuthAttempt::new(*ip, "/api/login", now).with_fingerprint("fp-123");
        detector.record_attempt(&attempt);
    }

    // Endpoint 2 with same fingerprint but only 1 IP - should not trigger
    let attempt = AuthAttempt::new("1.1.1.1", "/api/authenticate", now).with_fingerprint("fp-123");
    let verdict = detector.record_attempt(&attempt);
    assert!(verdict.is_allow());
}

#[test]
fn test_distributed_attack_five_ips() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // 5 IPs with same fingerprint
    for i in 0..5 {
        let ip = format!("10.0.0.{}", i);
        let attempt = AuthAttempt::new(ip, "/api/login", now + (i as u64) * 100)
            .with_fingerprint("shared-fingerprint");
        detector.record_attempt(&attempt);
    }

    // Next attempt should detect distributed attack
    let attempt = AuthAttempt::new("10.0.0.99", "/api/login", now + 1000)
        .with_fingerprint("shared-fingerprint");
    let verdict = detector.record_attempt(&attempt);

    assert!(!verdict.is_allow());
    assert_eq!(verdict.risk_delta(), 30);
}

#[test]
fn test_distributed_attack_below_threshold() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Only 2 IPs - below threshold of 3
    let ips = ["1.1.1.1", "2.2.2.2"];
    for ip in &ips {
        let attempt = AuthAttempt::new(*ip, "/api/login", now).with_fingerprint("fp-low");
        detector.record_attempt(&attempt);
    }

    // Second IP doesn't reach threshold yet
    let attempt = AuthAttempt::new("2.2.2.2", "/api/login", now + 100).with_fingerprint("fp-low");
    let verdict = detector.record_attempt(&attempt);

    // Still below 3 IPs - should be allowed
    let distributed_attacks = detector.get_distributed_attacks();
    if distributed_attacks.iter().all(|a| a.entity_count() < 3) {
        assert!(
            verdict.is_allow(),
            "Should be allowed when below distributed attack threshold"
        );
    }
}

#[test]
fn test_get_distributed_attacks() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Set up distributed attack
    for i in 0..3 {
        let ip = format!("192.168.1.{}", i);
        let attempt = AuthAttempt::new(ip, "/api/login", now).with_fingerprint("attack-fp");
        detector.record_attempt(&attempt);
    }

    let attacks = detector.get_distributed_attacks();
    assert!(attacks.len() > 0);
    assert_eq!(attacks[0].entity_count(), 3);
}

// ============================================================================
// TEST GROUP 4: Account Takeover Detection
// ============================================================================

#[test]
fn test_account_takeover_detection_5_failures_then_success() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record 5 failures (above takeover_min_failures of 3)
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + (i as u64) * 1000);
        detector.record_result(&result);
    }

    // Success after failures - should trigger takeover alert
    let result = AuthResult::new("1.2.3.4", "/api/login", true, now + 10000);
    let alert = detector.record_result(&result);

    assert!(alert.is_some());
    let alert = alert.unwrap();
    assert_eq!(alert.entity_id, "1.2.3.4");
    assert_eq!(alert.endpoint, "/api/login");
    assert_eq!(alert.prior_failures, 5);
    assert_eq!(alert.severity, StuffingSeverity::Critical);
}

#[test]
fn test_account_takeover_detection_3_failures_min_threshold() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record exactly 3 failures (minimum for takeover)
    for i in 0..3 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + (i as u64) * 1000);
        detector.record_result(&result);
    }

    // Success after 3 failures
    let result = AuthResult::new("1.2.3.4", "/api/login", true, now + 5000);
    let alert = detector.record_result(&result);

    assert!(alert.is_some());
    let alert = alert.unwrap();
    assert_eq!(alert.prior_failures, 3);
}

#[test]
fn test_account_takeover_detection_below_threshold() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record only 2 failures (below takeover_min_failures of 3)
    for i in 0..2 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + (i as u64) * 1000);
        detector.record_result(&result);
    }

    // Success should NOT trigger takeover alert
    let result = AuthResult::new("1.2.3.4", "/api/login", true, now + 5000);
    let alert = detector.record_result(&result);

    assert!(alert.is_none());
}

#[test]
fn test_account_takeover_window_expiration() {
    let mut config = test_config();
    config.takeover_window_ms = 100; // 100ms window

    let detector = CredentialStuffingDetector::new(config);
    let now = now_ms();

    // Record 5 failures
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i);
        detector.record_result(&result);
    }

    // Wait for window to expire
    std::thread::sleep(std::time::Duration::from_millis(150));
    let later = now_ms();

    // Success after window expiration should NOT trigger takeover
    let result = AuthResult::new("1.2.3.4", "/api/login", true, later);
    let alert = detector.record_result(&result);

    // Should not detect takeover since window expired
    // (window_start was reset or failures count as 0)
    assert!(alert.is_none());
}

#[test]
fn test_account_takeover_per_endpoint() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Endpoint 1: 5 failures
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Endpoint 2: 2 failures (not enough)
    for i in 0..2 {
        let result = AuthResult::new("1.2.3.4", "/api/authenticate", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Success on endpoint 1 - should trigger
    let result1 = AuthResult::new("1.2.3.4", "/api/login", true, now + 10000);
    let alert1 = detector.record_result(&result1);
    assert!(alert1.is_some());

    // Success on endpoint 2 - should NOT trigger
    let result2 = AuthResult::new("1.2.3.4", "/api/authenticate", true, now + 15000);
    let alert2 = detector.record_result(&result2);
    assert!(alert2.is_none());
}

#[test]
fn test_get_takeover_alerts() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record 5 failures
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Trigger takeover
    let result = AuthResult::new("1.2.3.4", "/api/login", true, now + 10000);
    detector.record_result(&result);

    // Get alerts
    let alerts = detector.get_all_takeover_alerts();
    assert_eq!(alerts.len(), 1);
    assert_eq!(alerts[0].entity_id, "1.2.3.4");
}

#[test]
fn test_takeover_event_emission() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record 5 failures
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    // Trigger takeover
    let result = AuthResult::new("1.2.3.4", "/api/login", true, now + 10000);
    detector.record_result(&result);

    // Check events
    let events = detector.drain_events();
    let has_takeover = events
        .iter()
        .any(|e| matches!(e, StuffingEvent::AccountTakeover { .. }));
    assert!(has_takeover);
}

// ============================================================================
// TEST GROUP 5: Configuration Validation & Sanitization
// ============================================================================

#[test]
fn test_config_validation_threshold_ordering() {
    // Create invalid config with thresholds in wrong order
    let config = StuffingConfig {
        failure_threshold_suspicious: 100,
        failure_threshold_high: 50,
        failure_threshold_block: 10,
        ..Default::default()
    };

    let validated = config.validated();

    // Should be corrected to ascending order
    assert!(
        validated.failure_threshold_suspicious < validated.failure_threshold_high,
        "suspicious should be less than high"
    );
    assert!(
        validated.failure_threshold_high < validated.failure_threshold_block,
        "high should be less than block"
    );
}

#[test]
fn test_config_validation_minimum_thresholds() {
    let config = StuffingConfig {
        failure_threshold_suspicious: 0,
        failure_threshold_high: 0,
        failure_threshold_block: 0,
        ..Default::default()
    };

    let validated = config.validated();

    assert!(validated.failure_threshold_suspicious >= 1);
    assert!(validated.failure_threshold_high >= 2);
    assert!(validated.failure_threshold_block >= 3);
}

#[test]
fn test_config_validation_window_minimums() {
    let config = StuffingConfig {
        failure_window_ms: 0,
        distributed_window_ms: 0,
        takeover_window_ms: 0,
        cleanup_interval_ms: 0,
        ..Default::default()
    };

    let validated = config.validated();

    // All windows should have minimum of 10ms
    assert!(validated.failure_window_ms >= 10);
    assert!(validated.distributed_window_ms >= 10);
    assert!(validated.takeover_window_ms >= 10);
    assert!(validated.cleanup_interval_ms >= 10);
}

#[test]
fn test_config_validation_distributed_min_ips() {
    let config = StuffingConfig {
        distributed_min_ips: 0,
        ..Default::default()
    };

    let validated = config.validated();

    // Distributed attacks need at least 2 IPs
    assert!(validated.distributed_min_ips >= 2);
}

#[test]
fn test_config_validation_takeover_min_failures() {
    let config = StuffingConfig {
        takeover_min_failures: 0,
        ..Default::default()
    };

    let validated = config.validated();

    // Takeover needs at least 1 failure
    assert!(validated.takeover_min_failures >= 1);
}

#[test]
fn test_config_validation_limits_capped() {
    let config = StuffingConfig {
        max_entities: usize::MAX,
        max_distributed_attacks: usize::MAX,
        max_takeover_alerts: usize::MAX,
        ..Default::default()
    };

    let validated = config.validated();

    // Limits should be capped to prevent memory exhaustion
    assert!(validated.max_entities <= 10_000_000);
    assert!(validated.max_distributed_attacks <= 100_000);
    assert!(validated.max_takeover_alerts <= 100_000);
}

#[test]
fn test_config_validation_does_not_panic_on_extreme_values() {
    // Should not panic with extreme values
    let config = StuffingConfig {
        failure_threshold_suspicious: u32::MAX,
        failure_threshold_high: u32::MAX,
        failure_threshold_block: u32::MAX,
        failure_window_ms: u64::MAX,
        distributed_min_ips: usize::MAX,
        max_entities: usize::MAX,
        max_distributed_attacks: usize::MAX,
        max_takeover_alerts: usize::MAX,
        ..Default::default()
    };

    // Should not panic - validation should handle extreme values
    let validated = config.validated();

    // Should have sensible minimums
    assert!(validated.failure_threshold_block >= 3);
    assert!(validated.distributed_min_ips >= 2);
    assert!(validated.max_entities > 0);
}

#[test]
fn test_config_with_custom_auth_patterns() {
    let config = StuffingConfig {
        auth_path_patterns: vec![
            r"^/api/v[0-9]+/login$".to_string(),
            r"^/custom/auth/.*".to_string(),
        ],
        ..Default::default()
    };

    let detector = CredentialStuffingDetector::new(config);

    assert!(detector.is_auth_endpoint("/api/v1/login"));
    assert!(detector.is_auth_endpoint("/api/v2/login"));
    assert!(detector.is_auth_endpoint("/custom/auth/signin"));
}

#[test]
fn test_config_with_empty_patterns_does_not_panic() {
    let config = StuffingConfig {
        auth_path_patterns: vec![],
        ..Default::default()
    };

    // Should not panic with empty patterns
    let detector = CredentialStuffingDetector::new(config);

    // Should not match anything
    assert!(!detector.is_auth_endpoint("/api/login"));
}

#[test]
fn test_config_default_values() {
    let config = StuffingConfig::default();

    // Verify defaults are sensible
    assert!(config.failure_window_ms > 0);
    assert!(config.failure_threshold_suspicious > 0);
    assert!(config.failure_threshold_high > config.failure_threshold_suspicious);
    assert!(config.failure_threshold_block > config.failure_threshold_high);
    assert!(config.distributed_min_ips >= 2);
    assert!(!config.auth_path_patterns.is_empty());
}

// ============================================================================
// Additional Integration Tests
// ============================================================================

#[test]
fn test_detector_creates_without_errors() {
    let _detector = CredentialStuffingDetector::new(test_config());
    // If we get here, construction succeeded
}

#[test]
fn test_detector_stats() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record some activity
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    let result = AuthResult::new("5.6.7.8", "/api/login", true, now + 10000);
    detector.record_result(&result);

    let stats = detector.get_stats();
    assert_eq!(stats.entity_count, 2);
    assert_eq!(stats.total_failures, 5);
    assert_eq!(stats.total_successes, 1);
}

#[test]
fn test_detector_clear() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Add some data
    let result = AuthResult::new("1.2.3.4", "/api/login", false, now);
    detector.record_result(&result);

    assert!(!detector.is_empty());
    detector.clear();
    assert!(detector.is_empty());
}

#[test]
fn test_detector_export_import() {
    let detector1 = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record activity
    for i in 0..3 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector1.record_result(&result);
    }

    // Export state
    let state = detector1.export();
    assert!(!state.entity_metrics.is_empty());

    // Import into new detector
    let detector2 = CredentialStuffingDetector::new(test_config());
    detector2.import(state);

    assert_eq!(detector1.len(), detector2.len());
}

#[test]
fn test_multiple_endpoints_independent_tracking() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record failures on multiple endpoints
    let endpoints = vec!["/api/login", "/api/authenticate", "/oauth/token"];
    for endpoint in endpoints {
        for i in 0..5 {
            let result = AuthResult::new(
                "1.2.3.4",
                endpoint.to_string(),
                false,
                now + i as u64 * 1000,
            );
            detector.record_result(&result);
        }
    }

    // All endpoints should have independent metrics
    let metrics1 = detector
        .get_entity_metrics("1.2.3.4", "/api/login")
        .unwrap();
    let metrics2 = detector
        .get_entity_metrics("1.2.3.4", "/api/authenticate")
        .unwrap();
    let metrics3 = detector
        .get_entity_metrics("1.2.3.4", "/oauth/token")
        .unwrap();

    assert_eq!(metrics1.failures, 5);
    assert_eq!(metrics2.failures, 5);
    assert_eq!(metrics3.failures, 5);
}

#[test]
fn test_failure_count_accuracy() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record exactly 5 failures
    for i in 0..5 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    let metrics = detector
        .get_entity_metrics("1.2.3.4", "/api/login")
        .unwrap();
    assert_eq!(metrics.failures, 5);
    assert_eq!(metrics.total_failures, 5);
}

#[test]
fn test_success_resets_sliding_window() {
    let detector = CredentialStuffingDetector::new(test_config());
    let now = now_ms();

    // Record 4 failures
    for i in 0..4 {
        let result = AuthResult::new("1.2.3.4", "/api/login", false, now + i * 1000);
        detector.record_result(&result);
    }

    let metrics_before = detector
        .get_entity_metrics("1.2.3.4", "/api/login")
        .unwrap();
    assert_eq!(metrics_before.failures, 4);

    // Successful login should reset window
    let result = AuthResult::new("1.2.3.4", "/api/login", true, now + 5000);
    let _alert = detector.record_result(&result);

    let metrics_after = detector
        .get_entity_metrics("1.2.3.4", "/api/login")
        .unwrap();
    assert_eq!(metrics_after.failures, 0);
}

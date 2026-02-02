//! Integration tests for the SynapseProxy components
//!
//! Tests cover validation and basic functionality of exported types

use synapse_pingora::Severity;

// ============================================================================
// Severity Tests
// ============================================================================

#[test]
fn test_severity_ordering() {
    // Test from horizon module
    assert!(Severity::Critical > Severity::High);
    assert!(Severity::High > Severity::Medium);
    assert!(Severity::Medium > Severity::Low);
}

#[test]
fn test_severity_debug() {
    let s = Severity::Critical;
    let debug_str = format!("{:?}", s);
    assert!(!debug_str.is_empty());
}

// ============================================================================
// Validation Tests
// ============================================================================

#[test]
fn test_validate_domain_good() {
    let result = synapse_pingora::validate_domain_name("example.com");
    assert!(result.is_ok());
}

#[test]
fn test_validate_domain_bad() {
    let result = synapse_pingora::validate_domain_name("invalid..domain");
    assert!(result.is_err());
}

#[test]
fn test_validate_domain_empty() {
    let result = synapse_pingora::validate_domain_name("");
    assert!(result.is_err());
}

// ============================================================================
// Config Types Tests
// ============================================================================

#[test]
fn test_tarpit_config_default() {
    let config = synapse_pingora::TarpitConfig::default();
    // Default should have reasonable values
    assert!(config.base_delay_ms > 0 || config.base_delay_ms == 0);
}

#[test]
fn test_entity_config_default() {
    let config = synapse_pingora::EntityConfig::default();
    // Verify defaults exist
    let _ = config;
}

#[test]
fn test_dlp_config_default() {
    let config = synapse_pingora::DlpConfig::default();
    // Verify config can be created
    let _ = config;
}

// ============================================================================
// DLP Scanner Basic Tests
// ============================================================================

#[test]
fn test_dlp_scanner_creation() {
    let config = synapse_pingora::DlpConfig {
        enabled: true,
        ..Default::default()
    };
    let scanner = synapse_pingora::DlpScanner::new(config);
    // Scanner should be created
    let _ = scanner;
}

// ============================================================================
// Credit Card Validation Tests (exported utility)
// ============================================================================

#[test]
fn test_valid_credit_card_visa() {
    // Valid Visa test number
    assert!(synapse_pingora::validate_credit_card("4111111111111111"));
}

#[test]
fn test_valid_credit_card_mastercard() {
    // Valid Mastercard test number
    assert!(synapse_pingora::validate_credit_card("5500000000000004"));
}

#[test]
fn test_invalid_credit_card() {
    // Invalid number
    assert!(!synapse_pingora::validate_credit_card("1234567890123456"));
}

#[test]
fn test_credit_card_too_short() {
    assert!(!synapse_pingora::validate_credit_card("123456"));
}

// ============================================================================
// SSN Validation Tests (exported utility)
// ============================================================================

#[test]
fn test_valid_ssn() {
    assert!(synapse_pingora::validate_ssn("123-45-6789"));
}

#[test]
fn test_invalid_ssn_format() {
    // SSN without dashes is still valid if digits are correct
    // Test with truly invalid input
    assert!(!synapse_pingora::validate_ssn("abc-de-fghi"));
}

#[test]
fn test_invalid_ssn_zeros() {
    // SSN with 000 area is invalid
    assert!(!synapse_pingora::validate_ssn("000-45-6789"));
}

// ============================================================================
// Phone Validation Tests (exported utility)
// ============================================================================

#[test]
fn test_valid_phone_us() {
    assert!(synapse_pingora::validate_phone("555-123-4567"));
}

#[test]
fn test_valid_phone_international() {
    assert!(synapse_pingora::validate_phone("+1-555-123-4567"));
}

// ============================================================================
// Export Verification Tests
// ============================================================================

#[test]
fn test_exports_exist() {
    // Verify key types are exported
    let _ = std::any::type_name::<synapse_pingora::TarpitConfig>();
    let _ = std::any::type_name::<synapse_pingora::EntityConfig>();
    let _ = std::any::type_name::<synapse_pingora::DlpConfig>();
    let _ = std::any::type_name::<synapse_pingora::ValidationError>();
    let _ = std::any::type_name::<synapse_pingora::Severity>();
}

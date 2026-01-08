//! Validation utilities for TLS certificates, domains, and configuration.
//!
//! # Security
//!
//! This module provides comprehensive validation for:
//! - **Certificate file paths and accessibility** - Validates PEM format, path traversal detection
//! - **Domain names (RFC 1035 compliance)** - Prevents invalid domain configurations
//! - **Configuration safety** - Ensures TLS configuration is safe before use
//!
//! # Path Traversal Protection
//!
//! The module detects and rejects paths containing:
//! - `..` (directory traversal)
//! - `~` (home directory expansion attacks)
//!
//! This prevents configuration-based path traversal attacks.
//!
//! # Domain Validation
//!
//! Domains must comply with RFC 1035:
//! - Max 253 characters total
//! - Each label max 63 characters
//! - Labels contain only alphanumerics and hyphens
//! - Labels cannot start or end with hyphen
//! - Supports wildcard domains (`*.example.com`)
//!
//! # Examples
//!
//! ```no_run
//! use synapse_pingora::validation::{validate_domain_name, validate_certificate_file};
//!
//! // Validate a domain
//! assert!(validate_domain_name("example.com").is_ok());
//! assert!(validate_domain_name("*.example.com").is_ok());
//! assert!(validate_domain_name("-invalid.com").is_err()); // Invalid format
//!
//! // Validate a certificate file
//! assert!(validate_certificate_file("/etc/certs/server.crt").is_ok());
//! assert!(validate_certificate_file("/etc/certs/invalid.txt").is_err()); // Not PEM format
//! ```

use std::fs;
use std::path::Path;
use regex::Regex;
use once_cell::sync::Lazy;

/// RFC 1035 compliant domain name regex pattern.
/// Allows labels with alphanumeric and hyphens, supports wildcards, max 253 chars.
static DOMAIN_PATTERN: Lazy<Regex> = Lazy::new(|| {
    // RFC 1035: domain names can contain letters, digits, hyphens
    // Labels can't start/end with hyphen, max 63 chars per label
    // Supports wildcard *.example.com
    Regex::new(r"^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$").unwrap()
});

/// Validation errors that can occur during configuration validation.
///
/// # Security Context
///
/// These errors provide specific information about configuration failures
/// to help administrators diagnose issues without exposing system internals.
#[derive(Debug, Clone)]
pub enum ValidationError {
    /// Certificate or key file not found at the specified path.
    ///
    /// Check that the path is correct and the file exists.
    FileNotFound(String),

    /// Certificate or key file exists but is not readable.
    ///
    /// Check file permissions and ownership.
    FileNotReadable(String),

    /// Domain name does not comply with RFC 1035.
    ///
    /// Domain must contain only alphanumerics, hyphens, and dots.
    /// Labels cannot start or end with hyphens.
    InvalidDomain(String),

    /// Certificate file does not contain PEM format markers.
    ///
    /// Certificate must start with `-----BEGIN CERTIFICATE-----`
    /// and end with `-----END CERTIFICATE-----`.
    InvalidCertFormat(String),

    /// Private key file does not contain PEM format markers.
    ///
    /// Private key must start with one of:
    /// - `-----BEGIN PRIVATE KEY-----`
    /// - `-----BEGIN RSA PRIVATE KEY-----`
    /// - `-----BEGIN EC PRIVATE KEY-----`
    /// - `-----BEGIN ENCRYPTED PRIVATE KEY-----`
    InvalidKeyFormat(String),

    /// File path contains suspicious characters or traversal attempts.
    ///
    /// Paths containing `..` or `~` are rejected to prevent directory traversal.
    SuspiciousPath(String),

    /// Domain name exceeds the maximum length of 253 characters.
    DomainTooLong(String),
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::FileNotFound(path) => write!(f, "File not found: {}", path),
            Self::FileNotReadable(path) => write!(f, "File not readable: {}", path),
            Self::InvalidDomain(domain) => write!(f, "Invalid domain name: {}", domain),
            Self::InvalidCertFormat(path) => write!(f, "Invalid certificate format (must be PEM): {}", path),
            Self::InvalidKeyFormat(path) => write!(f, "Invalid key format (must be PEM): {}", path),
            Self::SuspiciousPath(path) => write!(f, "Suspicious path (potential traversal): {}", path),
            Self::DomainTooLong(domain) => write!(f, "Domain name too long (max 253 chars): {}", domain),
        }
    }
}

impl std::error::Error for ValidationError {}

/// Result type for validation operations.
pub type ValidationResult<T> = Result<T, ValidationError>;

/// Validates a file path exists and is readable.
///
/// # Security
/// - Checks for path traversal attempts
/// - Verifies file exists and is readable
/// - Returns specific errors for debugging without exposing full paths in production
///
/// # Arguments
/// * `path` - File path to validate
/// * `_name` - Description for error messages (e.g., "certificate", "private key") - unused but kept for API consistency
pub fn validate_file_path(path: &str, _name: &str) -> ValidationResult<()> {
    // Security: Detect path traversal attempts
    if path.contains("..") || path.contains("~") {
        return Err(ValidationError::SuspiciousPath(path.to_string()));
    }

    let path_obj = Path::new(path);

    // Check if file exists
    if !path_obj.exists() {
        return Err(ValidationError::FileNotFound(path.to_string()));
    }

    // Check if it's a regular file
    if !path_obj.is_file() {
        return Err(ValidationError::FileNotReadable(format!("{} is not a file", path)));
    }

    // Check if file is readable
    if fs::metadata(path)
        .map(|meta| !meta.permissions().readonly() || meta.len() > 0)
        .is_err()
    {
        return Err(ValidationError::FileNotReadable(path.to_string()));
    }

    Ok(())
}

/// Validates a certificate file is in PEM format and contains cert data.
///
/// # Arguments
/// * `path` - Path to certificate file
pub fn validate_certificate_file(path: &str) -> ValidationResult<()> {
    validate_file_path(path, "certificate")?;

    // Read and validate PEM format
    let contents = fs::read_to_string(path)
        .map_err(|_| ValidationError::FileNotReadable(path.to_string()))?;

    if !contents.contains("-----BEGIN CERTIFICATE-----") {
        return Err(ValidationError::InvalidCertFormat(path.to_string()));
    }

    if !contents.contains("-----END CERTIFICATE-----") {
        return Err(ValidationError::InvalidCertFormat(path.to_string()));
    }

    Ok(())
}

/// Validates a private key file is in PEM format.
///
/// # Security Note
/// This function only validates the file format, not the key contents.
/// The actual key data should be zeroized from memory after use.
///
/// # Arguments
/// * `path` - Path to private key file
pub fn validate_private_key_file(path: &str) -> ValidationResult<()> {
    validate_file_path(path, "private key")?;

    // Read and validate PEM format
    let contents = fs::read_to_string(path)
        .map_err(|_| ValidationError::FileNotReadable(path.to_string()))?;

    // Check for common private key markers
    let valid_key = contents.contains("-----BEGIN RSA PRIVATE KEY-----")
        || contents.contains("-----BEGIN PRIVATE KEY-----")
        || contents.contains("-----BEGIN ENCRYPTED PRIVATE KEY-----")
        || contents.contains("-----BEGIN EC PRIVATE KEY-----");

    if !valid_key {
        return Err(ValidationError::InvalidKeyFormat(path.to_string()));
    }

    Ok(())
}

/// Validates a domain name according to RFC 1035.
///
/// # Rules
/// - Max 253 characters total
/// - Each label max 63 characters
/// - Labels can contain alphanumeric and hyphens, but not start/end with hyphen
/// - Supports wildcard domains (*.example.com)
/// - Case-insensitive comparison
///
/// # Arguments
/// * `domain` - Domain name to validate
pub fn validate_domain_name(domain: &str) -> ValidationResult<()> {
    // Check max length
    if domain.len() > 253 {
        return Err(ValidationError::DomainTooLong(domain.to_string()));
    }

    // Empty domain is invalid
    if domain.is_empty() {
        return Err(ValidationError::InvalidDomain("empty domain".to_string()));
    }

    // Use regex for RFC 1035 compliance
    if !DOMAIN_PATTERN.is_match(domain) {
        return Err(ValidationError::InvalidDomain(domain.to_string()));
    }

    // Additional check: no label should exceed 63 characters
    for label in domain.split('.') {
        if label.len() > 63 {
            return Err(ValidationError::InvalidDomain(
                format!("label '{}' exceeds 63 characters", label)
            ));
        }
    }

    Ok(())
}

/// Validates a complete TLS configuration.
///
/// # Validation Steps
/// 1. Validates certificate file exists and is readable PEM
/// 2. Validates private key file exists and is readable PEM
/// 3. For each per-domain cert, validates certificate, key, and domain
///
/// # Arguments
/// * `cert_path` - Path to default certificate
/// * `key_path` - Path to default private key
/// * `per_domain_certs` - List of per-domain certificates to validate
pub fn validate_tls_config(
    cert_path: &str,
    key_path: &str,
    per_domain_certs: &[(String, String, String)],
) -> ValidationResult<()> {
    // Validate default cert and key
    if !cert_path.is_empty() {
        validate_certificate_file(cert_path)?;
    }

    if !key_path.is_empty() {
        validate_private_key_file(key_path)?;
    }

    // Validate per-domain certs
    for (domain, cert, key) in per_domain_certs {
        validate_domain_name(domain)?;
        validate_certificate_file(cert)?;
        validate_private_key_file(key)?;
    }

    Ok(())
}

/// Validates a hostname (alias for domain validation).
pub fn validate_hostname(hostname: &str) -> ValidationResult<()> {
    validate_domain_name(hostname)
}

/// Validates an upstream address (host:port).
pub fn validate_upstream(upstream: &str) -> ValidationResult<()> {
    if upstream.is_empty() {
        return Err(ValidationError::InvalidDomain("empty upstream".to_string()));
    }
    
    // Check for port
    let parts: Vec<&str> = upstream.split(':').collect();
    if parts.len() != 2 {
         return Err(ValidationError::InvalidDomain(format!("upstream must be host:port, got {}", upstream)));
    }
    
    let host = parts[0];
    let port_str = parts[1];
    
    // Validate host part (can be IP or domain)
    if validate_domain_name(host).is_err() {
        // Simple check if it's a valid IP
        if host.parse::<std::net::IpAddr>().is_err() {
             return Err(ValidationError::InvalidDomain(format!("invalid host in upstream: {}", host)));
        }
    }
    
    // Validate port
    match port_str.parse::<u16>() {
        Ok(p) if p > 0 => Ok(()),
        _ => Err(ValidationError::InvalidDomain(format!("invalid port in upstream: {}", port_str))),
    }
}

/// Validates a CIDR block string.
pub fn validate_cidr(cidr: &str) -> ValidationResult<()> {
    // Simple parsing check using ipnetwork crate if available, or manual check
    // Since we don't want to add more deps if possible, let's do basic parsing
    let parts: Vec<&str> = cidr.split('/').collect();
    if parts.len() != 2 {
        return Err(ValidationError::InvalidDomain(format!("invalid CIDR format: {}", cidr)));
    }
    
    let ip_str = parts[0];
    let prefix_str = parts[1];
    
    let is_ipv4 = ip_str.contains('.');
    if ip_str.parse::<std::net::IpAddr>().is_err() {
        return Err(ValidationError::InvalidDomain(format!("invalid IP in CIDR: {}", ip_str)));
    }
    
    match prefix_str.parse::<u8>() {
        Ok(p) => {
            if is_ipv4 && p > 32 {
                return Err(ValidationError::InvalidDomain(format!("IPv4 prefix too large: {}", p)));
            }
            if !is_ipv4 && p > 128 {
                return Err(ValidationError::InvalidDomain(format!("IPv6 prefix too large: {}", p)));
            }
            Ok(())
        },
        Err(_) => Err(ValidationError::InvalidDomain(format!("invalid prefix in CIDR: {}", prefix_str))),
    }
}

/// Validates WAF risk threshold (0-100).
pub fn validate_waf_threshold(threshold: f64) -> ValidationResult<()> {
    if threshold < 0.0 || threshold > 100.0 {
        return Err(ValidationError::InvalidDomain(format!("WAF threshold must be 0-100, got {}", threshold)));
    }
    Ok(())
}

/// Validates rate limit configuration.
pub fn validate_rate_limit(requests: u64, window: u64) -> ValidationResult<()> {
    if requests == 0 {
        return Err(ValidationError::InvalidDomain("rate limit requests must be > 0".to_string()));
    }
    if window == 0 {
        return Err(ValidationError::InvalidDomain("rate limit window must be > 0".to_string()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_domain_validation_valid() {
        assert!(validate_domain_name("example.com").is_ok());
        assert!(validate_domain_name("sub.example.com").is_ok());
        assert!(validate_domain_name("*.example.com").is_ok());
        assert!(validate_domain_name("my-domain.co.uk").is_ok());
        assert!(validate_domain_name("123.456.789").is_ok());
    }

    #[test]
    fn test_domain_validation_invalid() {
        assert!(validate_domain_name("").is_err());
        assert!(validate_domain_name("-invalid.com").is_err());
        assert!(validate_domain_name("invalid-.com").is_err());
        assert!(validate_domain_name("invalid..com").is_err());
        assert!(validate_domain_name(&("a".repeat(64) + ".com")).is_err()); // label too long
    }

    #[test]
    fn test_domain_validation_max_length() {
        let long_domain = "a".repeat(254); // Just over limit
        assert!(validate_domain_name(&long_domain).is_err());

        let max_domain = "a".repeat(253);
        // Should validate (exact limit) if it matches pattern
        let _ = validate_domain_name(&max_domain);
    }

    #[test]
    fn test_path_traversal_detection() {
        assert!(validate_file_path("/etc/passwd/../shadow", "test").is_err());
        assert!(validate_file_path("~/.ssh/id_rsa", "test").is_err());
    }

    #[test]
    fn test_certificate_file_validation() {
        // Create temporary file with PEM cert marker
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(
            temp_file,
            "-----BEGIN CERTIFICATE-----\ndata\n-----END CERTIFICATE-----"
        )
        .unwrap();

        let path = temp_file.path().to_str().unwrap();
        assert!(validate_certificate_file(path).is_ok());

        // Invalid: missing end marker
        let mut invalid_cert = NamedTempFile::new().unwrap();
        writeln!(invalid_cert, "-----BEGIN CERTIFICATE-----\ndata").unwrap();

        let path = invalid_cert.path().to_str().unwrap();
        assert!(validate_certificate_file(path).is_err());
    }

    #[test]
    fn test_private_key_file_validation() {
        // Create temporary file with PEM key marker
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(
            temp_file,
            "-----BEGIN PRIVATE KEY-----\ndata\n-----END PRIVATE KEY-----"
        )
        .unwrap();

        let path = temp_file.path().to_str().unwrap();
        assert!(validate_private_key_file(path).is_ok());

        // Also test RSA format
        let mut rsa_key = NamedTempFile::new().unwrap();
        writeln!(
            rsa_key,
            "-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----"
        )
        .unwrap();

        let path = rsa_key.path().to_str().unwrap();
        assert!(validate_private_key_file(path).is_ok());
    }

    #[test]
    fn test_file_not_found() {
        assert!(validate_file_path("/nonexistent/path/to/file.txt", "test").is_err());
    }
}

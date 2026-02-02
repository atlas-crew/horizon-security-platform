//! Header manipulation logic for request and response headers.
//!
//! Provides functionality to add, set, and remove headers based on configuration.
//!
//! # Security
//!
//! Sensitive header values (Authorization, Cookie, API keys, etc.) are automatically
//! redacted in debug logs to prevent credential leakage through log aggregation systems.

use crate::config::HeaderOps;
use crate::shadow::is_sensitive_header;
use pingora_http::{RequestHeader, ResponseHeader};
use tracing::debug;

/// Redact a header value for safe logging.
///
/// SECURITY: Sensitive header values are fully redacted to prevent credential leakage.
/// Non-sensitive headers show the full value for debugging purposes.
#[inline]
fn redact_for_log(name: &str, value: &str) -> String {
    if is_sensitive_header(name) {
        "[REDACTED]".to_string()
    } else {
        value.to_string()
    }
}

/// Apply header operations to a request header.
pub fn apply_request_headers(header: &mut RequestHeader, ops: &HeaderOps) {
    // 1. Remove headers
    for name in &ops.remove {
        if header.remove_header(name).is_some() {
            debug!("Removed request header: {}", name);
        }
    }

    // 2. Set headers (replace existing)
    for (name, value) in &ops.set {
        if let Err(e) = header.insert_header(name.clone(), value) {
            debug!("Failed to set request header {}: {}", name, e);
        } else {
            // SECURITY: Redact sensitive header values in logs
            debug!("Set request header: {} = {}", name, redact_for_log(name, value));
        }
    }

    // 3. Add headers (append to existing)
    for (name, value) in &ops.add {
        if let Err(e) = header.append_header(name.clone(), value) {
            debug!("Failed to add request header {}: {}", name, e);
        } else {
            // SECURITY: Redact sensitive header values in logs
            debug!("Added request header: {} = {}", name, redact_for_log(name, value));
        }
    }
}

/// Apply header operations to a response header.
pub fn apply_response_headers(header: &mut ResponseHeader, ops: &HeaderOps) {
    // 1. Remove headers
    for name in &ops.remove {
        if header.remove_header(name).is_some() {
            debug!("Removed response header: {}", name);
        }
    }

    // 2. Set headers (replace existing)
    for (name, value) in &ops.set {
        if let Err(e) = header.insert_header(name.clone(), value) {
            debug!("Failed to set response header {}: {}", name, e);
        } else {
            // SECURITY: Redact sensitive header values in logs
            debug!("Set response header: {} = {}", name, redact_for_log(name, value));
        }
    }

    // 3. Add headers (append to existing)
    for (name, value) in &ops.add {
        if let Err(e) = header.append_header(name.clone(), value) {
            debug!("Failed to add response header {}: {}", name, e);
        } else {
            // SECURITY: Redact sensitive header values in logs
            debug!("Added response header: {} = {}", name, redact_for_log(name, value));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redact_sensitive_headers() {
        // Sensitive headers should be fully redacted
        assert_eq!(redact_for_log("Authorization", "Bearer secret-token"), "[REDACTED]");
        assert_eq!(redact_for_log("authorization", "Basic dXNlcjpwYXNz"), "[REDACTED]");
        assert_eq!(redact_for_log("Cookie", "session=abc123"), "[REDACTED]");
        assert_eq!(redact_for_log("X-Api-Key", "sk-live-12345"), "[REDACTED]");
        assert_eq!(redact_for_log("X-Auth-Token", "auth-token-value"), "[REDACTED]");
        assert_eq!(redact_for_log("X-CSRF-Token", "csrf123"), "[REDACTED]");
    }

    #[test]
    fn test_redact_non_sensitive_headers() {
        // Non-sensitive headers should show full value
        assert_eq!(redact_for_log("Content-Type", "application/json"), "application/json");
        assert_eq!(redact_for_log("Accept", "text/html"), "text/html");
        assert_eq!(redact_for_log("User-Agent", "Mozilla/5.0"), "Mozilla/5.0");
        assert_eq!(redact_for_log("X-Request-Id", "req-123"), "req-123");
        assert_eq!(redact_for_log("Cache-Control", "no-cache"), "no-cache");
    }

    #[test]
    fn test_redact_case_insensitive() {
        // Header name matching should be case-insensitive
        assert_eq!(redact_for_log("AUTHORIZATION", "token"), "[REDACTED]");
        assert_eq!(redact_for_log("Authorization", "token"), "[REDACTED]");
        assert_eq!(redact_for_log("authorization", "token"), "[REDACTED]");
        assert_eq!(redact_for_log("COOKIE", "value"), "[REDACTED]");
        assert_eq!(redact_for_log("Cookie", "value"), "[REDACTED]");
        assert_eq!(redact_for_log("cookie", "value"), "[REDACTED]");
    }
}

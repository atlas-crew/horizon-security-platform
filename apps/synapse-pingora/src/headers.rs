//! Header manipulation logic for request and response headers.
//!
//! Provides functionality to add, set, and remove headers based on configuration.

use crate::config::HeaderOps;
use pingora_http::{RequestHeader, ResponseHeader};
use tracing::debug;

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
            debug!("Set request header: {} = {}", name, value);
        }
    }

    // 3. Add headers (append to existing)
    for (name, value) in &ops.add {
        if let Err(e) = header.append_header(name.clone(), value) {
            debug!("Failed to add request header {}: {}", name, e);
        } else {
            debug!("Added request header: {} = {}", name, value);
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
            debug!("Set response header: {} = {}", name, value);
        }
    }

    // 3. Add headers (append to existing)
    for (name, value) in &ops.add {
        if let Err(e) = header.append_header(name.clone(), value) {
            debug!("Failed to add response header {}: {}", name, e);
        } else {
            debug!("Added response header: {} = {}", name, value);
        }
    }
}

//! Shannon entropy calculation for header value analysis.
//!
//! Provides entropy-based anomaly detection for header values:
//! - Calculates byte frequency distribution
//! - Returns entropy in bits (0-8 for byte values)
//! - Higher entropy indicates more randomness/complexity
//!
//! ## Use Cases
//! - Detecting encoded/obfuscated payloads (high entropy)
//! - Identifying suspicious tokens or session IDs
//! - Flagging unusual header value patterns
//!
//! ## Performance
//! - O(n) where n = string length
//! - Single-pass frequency counting
//! - No allocations beyond stack array

/// Calculate Shannon entropy of a string in bits.
///
/// Entropy measures the randomness/unpredictability of data:
/// - 0 bits: All bytes are identical (e.g., "aaaa")
/// - 8 bits: Maximum randomness (uniform distribution of all 256 byte values)
///
/// Typical values:
/// - English text: ~3.5-4.5 bits
/// - Base64 encoded: ~5.5-6.0 bits
/// - Random/encrypted data: ~7.5-8.0 bits
/// - UUIDs: ~4.0-4.5 bits (limited character set)
///
/// # Arguments
/// * `data` - The string to analyze
///
/// # Returns
/// Entropy in bits (0.0 to 8.0)
///
/// # Examples
/// ```
/// use synapse_pingora::profiler::entropy::shannon_entropy;
///
/// // Uniform string has 0 entropy
/// assert!((shannon_entropy("aaaa") - 0.0).abs() < 0.01);
///
/// // More diverse strings have higher entropy
/// let entropy = shannon_entropy("Hello World!");
/// assert!(entropy > 2.0);
/// ```
#[inline]
pub fn shannon_entropy(data: &str) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let bytes = data.as_bytes();
    let len = bytes.len() as f64;

    // Count byte frequencies using a fixed-size array (256 possible byte values)
    // This avoids HashMap allocation overhead
    let mut frequency = [0u32; 256];
    for &byte in bytes {
        frequency[byte as usize] += 1;
    }

    // Calculate entropy: H = -sum(p * log2(p)) for each non-zero probability
    let mut entropy = 0.0;
    for &count in &frequency {
        if count > 0 {
            let p = count as f64 / len;
            entropy -= p * p.log2();
        }
    }

    entropy
}

/// Calculate normalized entropy (0.0 to 1.0).
///
/// Normalizes entropy to a 0-1 scale based on the theoretical maximum
/// for the given string length (which is log2(min(len, 256))).
///
/// This is useful for comparing entropy across strings of different lengths.
#[inline]
pub fn normalized_entropy(data: &str) -> f64 {
    let entropy = shannon_entropy(data);
    if data.is_empty() {
        return 0.0;
    }

    // Maximum possible entropy depends on unique byte count
    let len = data.len();
    let max_unique = len.min(256) as f64;
    let max_entropy = max_unique.log2();

    if max_entropy <= 0.0 {
        return 0.0;
    }

    (entropy / max_entropy).clamp(0.0, 1.0)
}

/// Check if entropy is anomalously high compared to a baseline.
///
/// Uses z-score to determine if the observed entropy is significantly
/// different from the expected mean.
///
/// # Arguments
/// * `observed` - The observed entropy value
/// * `mean` - The expected mean entropy
/// * `variance` - The variance of the entropy distribution
/// * `threshold` - Z-score threshold (typically 3.0 for 3-sigma)
///
/// # Returns
/// `true` if the z-score exceeds the threshold (anomaly detected)
#[inline]
pub fn is_entropy_anomaly(observed: f64, mean: f64, variance: f64, threshold: f64) -> bool {
    if variance <= 0.001 {
        // Not enough variance to determine anomaly
        return false;
    }

    let stddev = variance.sqrt();
    let z_score = (observed - mean).abs() / stddev;
    z_score > threshold
}

/// Calculate z-score for an entropy value.
///
/// # Arguments
/// * `observed` - The observed entropy value
/// * `mean` - The expected mean entropy
/// * `variance` - The variance of the entropy distribution
///
/// # Returns
/// Z-score (number of standard deviations from mean)
#[inline]
pub fn entropy_z_score(observed: f64, mean: f64, variance: f64) -> f64 {
    if variance <= 0.001 {
        return 0.0;
    }

    let stddev = variance.sqrt();
    (observed - mean) / stddev
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_string() {
        assert_eq!(shannon_entropy(""), 0.0);
        assert_eq!(normalized_entropy(""), 0.0);
    }

    #[test]
    fn test_uniform_string() {
        // All same character = 0 entropy
        assert!((shannon_entropy("aaaa") - 0.0).abs() < 0.001);
        assert!((shannon_entropy("XXXXXXXX") - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_binary_string() {
        // Equal distribution of 2 characters = 1 bit entropy
        assert!((shannon_entropy("abab") - 1.0).abs() < 0.001);
        assert!((shannon_entropy("aabb") - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_increasing_entropy() {
        // More unique characters = higher entropy
        let e1 = shannon_entropy("aaaa");
        let e2 = shannon_entropy("aabb");
        let e3 = shannon_entropy("abcd");

        assert!(e1 < e2);
        assert!(e2 < e3);
    }

    #[test]
    fn test_english_text() {
        // English text typically has 3.5-4.5 bits entropy
        let text = "The quick brown fox jumps over the lazy dog";
        let entropy = shannon_entropy(text);
        assert!(entropy > 3.0);
        assert!(entropy < 5.0);
    }

    #[test]
    fn test_base64_like() {
        // Base64 has higher entropy due to more uniform distribution
        let base64 = "SGVsbG8gV29ybGQhIQ==";
        let entropy = shannon_entropy(base64);
        assert!(entropy > 3.5);
    }

    #[test]
    fn test_uuid_entropy() {
        // UUID has moderate entropy (hexadecimal + dashes)
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        let entropy = shannon_entropy(uuid);
        assert!(entropy > 3.0);
        assert!(entropy < 5.0);
    }

    #[test]
    fn test_normalized_entropy() {
        // Single character = 0 normalized entropy
        assert!((normalized_entropy("a") - 0.0).abs() < 0.001);

        // All unique characters = maximum normalized entropy
        let all_unique = "abcdefghijklmnop";
        let norm = normalized_entropy(all_unique);
        assert!(norm > 0.9);
    }

    #[test]
    fn test_is_entropy_anomaly() {
        // Normal case: within 2 sigma
        assert!(!is_entropy_anomaly(4.0, 4.0, 1.0, 3.0));

        // Anomaly: 5 sigma above mean
        assert!(is_entropy_anomaly(9.0, 4.0, 1.0, 3.0));

        // Edge case: zero variance
        assert!(!is_entropy_anomaly(10.0, 4.0, 0.0, 3.0));
    }

    #[test]
    fn test_entropy_z_score() {
        // Exactly at mean = 0 z-score
        assert!((entropy_z_score(4.0, 4.0, 1.0) - 0.0).abs() < 0.001);

        // 1 stddev above = 1.0 z-score
        assert!((entropy_z_score(5.0, 4.0, 1.0) - 1.0).abs() < 0.001);

        // 2 stddev below = -2.0 z-score
        assert!((entropy_z_score(2.0, 4.0, 1.0) - (-2.0)).abs() < 0.001);

        // Zero variance returns 0
        assert_eq!(entropy_z_score(10.0, 4.0, 0.0), 0.0);
    }

    #[test]
    fn test_high_entropy_random_looking() {
        // Simulated high-entropy string (random-looking)
        let random_like = "x7Kp9mNq2R5vL8jY";
        let entropy = shannon_entropy(random_like);
        // Should be higher than typical English text
        assert!(entropy > 3.5);
    }

    #[test]
    fn test_jwt_like_token() {
        // JWT tokens have high entropy in payload section
        let jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        let entropy = shannon_entropy(jwt);
        // Base64 encoded data has higher entropy
        assert!(entropy > 4.0);
    }
}

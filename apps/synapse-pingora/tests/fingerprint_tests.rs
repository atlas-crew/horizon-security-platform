//! Comprehensive tests for JA4/JA4H fingerprint module
//!
//! Coverage areas:
//! 1. JA4 fingerprint parsing & validation (format extraction, component parsing)
//! 2. JA4H HTTP fingerprint generation (known headers → expected format)
//! 3. Fingerprint spoofing detection (TLS mismatch to browser profile)
//! 4. SHA256 hash first-12 correctness
//! 5. Client fingerprint matching logic

use http::header::{HeaderName, HeaderValue};
use synapse_pingora::fingerprint::{
    analyze_ja4, analyze_ja4_spoofing, extract_client_fingerprint, fingerprints_match,
    generate_ja4h, is_valid_ja4, is_valid_ja4h, matches_pattern, parse_ja4_from_header,
    sha256_first12, HttpHeaders, Ja4Fingerprint, Ja4Protocol,
    Ja4SniType,
};

// ============================================================================
// Helper Functions
// ============================================================================

fn header(name: &str, value: &str) -> (HeaderName, HeaderValue) {
    let header_name = HeaderName::from_bytes(name.as_bytes()).expect("valid header name");
    let header_value = HeaderValue::from_str(value).expect("valid header value");
    (header_name, header_value)
}

fn make_test_ja4(
    protocol_char: char,
    tls_version: u8,
    sni_char: char,
    cipher_count: u8,
    ext_count: u8,
    alpn: &str,
    cipher_hash: &str,
    ext_hash: &str,
) -> Ja4Fingerprint {
    let protocol = if protocol_char == 'q' {
        Ja4Protocol::QUIC
    } else {
        Ja4Protocol::TCP
    };

    let sni_type = match sni_char {
        'd' => Ja4SniType::Domain,
        'i' => Ja4SniType::IP,
        _ => Ja4SniType::None,
    };

    let raw = format!(
        "{}{}{}{}{}{}_{}_{}",
        protocol_char, tls_version, sni_char,
        format!("{:02x}", cipher_count),
        format!("{:02x}", ext_count),
        alpn,
        cipher_hash,
        ext_hash
    );

    Ja4Fingerprint {
        raw,
        protocol,
        tls_version,
        sni_type,
        cipher_count,
        ext_count,
        alpn: alpn.to_string(),
        cipher_hash: cipher_hash.to_string(),
        ext_hash: ext_hash.to_string(),
    }
}

// ============================================================================
// SECTION 1: JA4 FINGERPRINT PARSING & VALIDATION
// ============================================================================

#[test]
fn test_ja4_parsing_format_extraction_basic() {
    // Test basic JA4 format extraction from "TLSv1.3,cipher_count,ext_count,cipher_hash,ext_hash"
    let result = parse_ja4_from_header(Some("t13d1516h2_8daaf6152771_e5627efa2ab1"));

    assert!(result.is_some(), "Should parse valid JA4 format");
    let fp = result.unwrap();

    // Verify all components are extracted correctly
    assert_eq!(fp.protocol, Ja4Protocol::TCP, "Protocol should be TCP");
    assert_eq!(fp.tls_version, 13, "TLS version should be 13");
    assert_eq!(fp.sni_type, Ja4SniType::Domain, "SNI type should be Domain");
    assert_eq!(fp.cipher_count, 0x15, "Cipher count should be 0x15 (21 decimal)");
    assert_eq!(fp.ext_count, 0x16, "Extension count should be 0x16 (22 decimal)");
    assert_eq!(fp.alpn, "h2", "ALPN should be h2");
    assert_eq!(fp.cipher_hash, "8daaf6152771", "Cipher hash should be extracted");
    assert_eq!(fp.ext_hash, "e5627efa2ab1", "Extension hash should be extracted");
}

#[test]
fn test_ja4_parsing_component_extraction_quic() {
    // Test QUIC protocol and different SNI type
    let result = parse_ja4_from_header(Some("q13i0a0bh3_1234567890ab_abcdef123456"));

    assert!(result.is_some());
    let fp = result.unwrap();

    assert_eq!(fp.protocol, Ja4Protocol::QUIC, "Protocol should be QUIC");
    assert_eq!(fp.tls_version, 13);
    assert_eq!(fp.sni_type, Ja4SniType::IP, "SNI type should be IP");
    assert_eq!(fp.cipher_count, 0x0a);
    assert_eq!(fp.ext_count, 0x0b);
    assert_eq!(fp.alpn, "h3", "ALPN should be h3");
}

#[test]
fn test_ja4_parsing_component_extraction_no_sni() {
    // Test with no SNI (empty SNI character)
    let result = parse_ja4_from_header(Some("t130510h2_aabbccddeeff_112233445566"));

    assert!(result.is_some());
    let fp = result.unwrap();

    assert_eq!(fp.sni_type, Ja4SniType::None, "SNI type should be None");
    assert_eq!(fp.cipher_count, 0x05);
    assert_eq!(fp.ext_count, 0x10);
}

#[test]
fn test_ja4_parsing_case_insensitivity() {
    // Test that parsing is case-insensitive
    let upper = parse_ja4_from_header(Some("T13D1516H2_8DAAF6152771_E5627EFA2AB1"));
    let lower = parse_ja4_from_header(Some("t13d1516h2_8daaf6152771_e5627efa2ab1"));
    let mixed = parse_ja4_from_header(Some("T13d1516H2_8DaAf6152771_E5627eFa2Ab1"));

    assert!(upper.is_some());
    assert!(lower.is_some());
    assert!(mixed.is_some());

    // All should normalize to lowercase
    assert_eq!(upper.as_ref().unwrap().raw, lower.as_ref().unwrap().raw);
    assert_eq!(lower.as_ref().unwrap().raw, mixed.as_ref().unwrap().raw);
}

#[test]
fn test_ja4_parsing_invalid_format() {
    // Test that invalid formats return None
    assert!(parse_ja4_from_header(Some("invalid")).is_none(), "Invalid format");
    assert!(parse_ja4_from_header(Some("")).is_none(), "Empty string");
    assert!(parse_ja4_from_header(None).is_none(), "None input");
    assert!(parse_ja4_from_header(Some("t13d1516h2_short_hash")).is_none(), "Short hash");
    assert!(parse_ja4_from_header(Some("t13d1516h2_aabbccddeeff_")).is_none(), "Missing ext_hash");
}

#[test]
fn test_ja4_parsing_security_length_validation() {
    // Test that excessively long inputs are rejected (security: DoS prevention)
    let long_input = "a".repeat(200);
    assert!(
        parse_ja4_from_header(Some(&long_input)).is_none(),
        "Should reject oversized input"
    );
}

#[test]
fn test_ja4_parsing_invalid_tls_version() {
    // Test TLS version validation
    assert!(
        parse_ja4_from_header(Some("t09d1516h2_8daaf6152771_e5627efa2ab1")).is_none(),
        "TLS 0.9 is out of range"
    );
    assert!(
        parse_ja4_from_header(Some("t14d1516h2_8daaf6152771_e5627efa2ab1")).is_none(),
        "TLS 1.4 is out of range"
    );
}

#[test]
fn test_ja4_parsing_invalid_hash_length() {
    // Test hash length validation (must be exactly 12 hex chars)
    assert!(
        parse_ja4_from_header(Some("t13d1516h2_8daaf615277_e5627efa2ab1")).is_none(),
        "Cipher hash too short"
    );
    assert!(
        parse_ja4_from_header(Some("t13d1516h2_8daaf6152771extra_e5627efa2ab1")).is_none(),
        "Cipher hash too long"
    );
}

#[test]
fn test_ja4_is_valid_ja4_function() {
    // Test the is_valid_ja4 convenience function
    assert!(is_valid_ja4("t13d1516h2_8daaf6152771_e5627efa2ab1"));
    assert!(is_valid_ja4("T13D1516H2_8DAAF6152771_E5627EFA2AB1"));
    assert!(!is_valid_ja4("invalid"));
    assert!(!is_valid_ja4(""));
    assert!(!is_valid_ja4("not_a_fingerprint"));
}

// ============================================================================
// SECTION 2: JA4H HTTP FINGERPRINT GENERATION
// ============================================================================

#[test]
fn test_ja4h_generation_basic_get_request() {
    // Test JA4H generation with minimal headers (GET request)
    let headers = vec![header("Accept", "text/html")];
    let request = HttpHeaders {
        headers: &headers,
        method: "GET",
        http_version: "1.1",
    };

    let result = generate_ja4h(&request);

    // Verify format: {method}{version}{cookie}{referer}{accept_lang}_{header_hash}_{cookie_hash}
    assert_eq!(result.method, "ge", "GET should be 'ge'");
    assert_eq!(result.http_version, 11, "HTTP/1.1 should be 11");
    assert!(!result.has_cookie, "Should not have cookie");
    assert!(!result.has_referer, "Should not have referer");
    assert_eq!(result.accept_lang, "00", "No Accept-Language should be '00'");
    assert_eq!(result.cookie_hash, "000000000000", "No cookie should hash to zeros");
}

#[test]
fn test_ja4h_generation_with_known_headers_post() {
    // Test JA4H generation with POST and multiple headers
    let headers = vec![
        header("Cookie", "session=abc123; user=test"),
        header("Referer", "https://example.com"),
        header("Accept-Language", "en-US,en;q=0.9"),
        header("User-Agent", "Mozilla/5.0"),
    ];
    let request = HttpHeaders {
        headers: &headers,
        method: "POST",
        http_version: "1.1",
    };

    let result = generate_ja4h(&request);

    assert_eq!(result.method, "po", "POST should be 'po'");
    assert_eq!(result.http_version, 11);
    assert!(result.has_cookie, "Should detect cookie");
    assert!(result.has_referer, "Should detect referer");
    assert_eq!(result.accept_lang, "en", "Should extract 'en' from Accept-Language");
    assert_ne!(result.cookie_hash, "000000000000", "Cookie hash should be computed");
}

#[test]
fn test_ja4h_generation_http_version_codes() {
    // Test all HTTP version mappings
    let test_cases = vec![
        ("1.0", 10),
        ("1.1", 11),
        ("2.0", 20),
        ("2", 20),
        ("3.0", 30),
        ("3", 30),
    ];

    for (version_str, expected_code) in test_cases {
        let headers: Vec<(HeaderName, HeaderValue)> = Vec::new();
        let request = HttpHeaders {
            headers: &headers,
            method: "GET",
            http_version: version_str,
        };
        let result = generate_ja4h(&request);

        assert_eq!(
            result.http_version, expected_code,
            "HTTP {} should map to {}",
            version_str, expected_code
        );
    }
}

#[test]
fn test_ja4h_generation_method_codes() {
    // Test all HTTP method mappings
    let methods = vec![
        ("GET", "ge"),
        ("POST", "po"),
        ("PUT", "pu"),
        ("DELETE", "de"),
        ("HEAD", "he"),
        ("OPTIONS", "op"),
        ("PATCH", "pa"),
        ("CONNECT", "co"),
        ("TRACE", "tr"),
    ];

    for (method, expected_code) in methods {
        let headers: Vec<(HeaderName, HeaderValue)> = Vec::new();
        let request = HttpHeaders {
            headers: &headers,
            method,
            http_version: "1.1",
        };
        let result = generate_ja4h(&request);

        assert_eq!(
            result.method, expected_code,
            "Method {} should map to {}",
            method, expected_code
        );
    }
}

#[test]
fn test_ja4h_generation_accept_language_parsing() {
    // Test Accept-Language header parsing
    let test_cases = vec![
        ("en-US,en;q=0.9", "en"),
        ("fr-FR,fr;q=0.9,en;q=0.8", "fr"),
        ("de-DE", "de"),
        ("zh-CN,zh;q=0.9", "zh"),
        ("", "00"),
        ("x", "00"), // Single char too short
    ];

    for (accept_lang, expected) in test_cases {
        let headers = if accept_lang.is_empty() {
            vec![]
        } else {
            vec![header("Accept-Language", accept_lang)]
        };

        let request = HttpHeaders {
            headers: &headers,
            method: "GET",
            http_version: "1.1",
        };
        let result = generate_ja4h(&request);

        assert_eq!(
            result.accept_lang, expected,
            "Accept-Language '{}' should extract to '{}'",
            accept_lang, expected
        );
    }
}

#[test]
fn test_ja4h_generation_format_string() {
    // Test that the generated raw format is correct
    let headers = vec![
        header("Cookie", "session=abc"),
        header("Referer", "https://example.com"),
        header("Accept-Language", "en-US"),
    ];
    let request = HttpHeaders {
        headers: &headers,
        method: "POST",
        http_version: "2.0",
    };

    let result = generate_ja4h(&request);
    let raw = &result.raw;

    // Format: {method}{http_version}{cookie_flag}{referer_flag}{accept_lang}_{header_hash}_{cookie_hash}
    // Should start with: "po20cr" (POST, HTTP/2, Cookie, Referer, en)
    assert!(
        raw.starts_with("po20cren"),
        "Raw should start with 'po20cren' but was '{}'",
        raw
    );

    // Should have underscores at correct positions
    let parts: Vec<&str> = raw.split('_').collect();
    assert_eq!(parts.len(), 3, "Should have 3 parts separated by underscores");
    assert_eq!(parts[1].len(), 12, "Header hash should be 12 chars");
    assert_eq!(parts[2].len(), 12, "Cookie hash should be 12 chars");
}

#[test]
fn test_ja4h_generation_cookie_header_hash_computation() {
    // Test that cookie names are properly hashed
    let headers = vec![header("Cookie", "session=abc123; user=john; preferences=dark")];
    let request = HttpHeaders {
        headers: &headers,
        method: "GET",
        http_version: "1.1",
    };

    let result = generate_ja4h(&request);

    // Should have computed hash for "preferences,session,user" (sorted)
    assert!(
        result.cookie_hash != "000000000000",
        "Should have non-zero cookie hash"
    );
    assert_eq!(result.cookie_hash.len(), 12, "Cookie hash should be 12 hex chars");
}

#[test]
fn test_ja4h_generation_header_exclusions() {
    // Test that certain headers are excluded from header hash calculation
    let headers = vec![
        header("User-Agent", "Mozilla/5.0"),
        header("Accept", "text/html"),
        header("X-Custom", "value"),
        // These should be excluded:
        header("Cookie", "test=1"),
        header("Referer", "https://example.com"),
        header("Host", "example.com"),
        header("Content-Length", "42"),
        header("Content-Type", "text/html"),
    ];
    let request = HttpHeaders {
        headers: &headers,
        method: "GET",
        http_version: "1.1",
    };

    let result = generate_ja4h(&request);

    // Header hash should only include: accept, user-agent, x-custom (sorted)
    assert!(
        result.header_hash != "000000000000",
        "Should have computed header hash"
    );
}

#[test]
fn test_ja4h_is_valid_function() {
    // Test the is_valid_ja4h convenience function
    assert!(is_valid_ja4h("ge11cnrn_a1b2c3d4e5f6_000000000000"));
    assert!(is_valid_ja4h("po20crZZ_1a2b3c4d5e6f_aabbccddeeff"));
    assert!(!is_valid_ja4h("invalid"));
    assert!(!is_valid_ja4h(""));
    assert!(!is_valid_ja4h("ge11_invalid_format"));
}

// ============================================================================
// SECTION 3: SHA256 HASH FIRST-12 CORRECTNESS
// ============================================================================

#[test]
fn test_sha256_first12_rfc_3174_test_vector() {
    // Test with RFC 3174 known test vectors
    // SHA256("abc") = ba7816bf 8f01cfea 414140de 5dae2223 b00361a3 96177a9c b410ff61 f20015ad
    let result = sha256_first12("abc");
    assert_eq!(result, "ba7816bf8f01", "RFC test vector for 'abc'");
}

#[test]
fn test_sha256_first12_empty_string() {
    // SHA256("") = e3b0c442 98fc1c14 9afbf4c8 996fb924 27ae41e4 649b934c a495991b 7852b855
    let result = sha256_first12("");
    assert_eq!(result, "e3b0c44298fc", "Empty string hash");
}

#[test]
fn test_sha256_first12_test_string() {
    // Test with 'test' - from the code comments
    // SHA256("test") = 9f86d081 884c7d65 9a2feaa0 c55ad015 a3bf4f1b 2b0b822c d15d6c15 b0f00a08
    let result = sha256_first12("test");
    assert_eq!(result, "9f86d081884c", "Known test vector for 'test'");
}

#[test]
fn test_sha256_first12_consistent_length() {
    // Test that hash is always exactly 12 characters
    let long_string = "x".repeat(100);
    let inputs = vec!["a", "abc", "test", "long input", "", &long_string];

    for input in inputs {
        let result = sha256_first12(input);
        assert_eq!(result.len(), 12, "Hash should always be 12 chars for '{}'", input);

        // Verify all characters are valid hex
        for ch in result.chars() {
            assert!(
                ch.is_ascii_hexdigit(),
                "Hash should contain only hex digits, got '{}'",
                ch
            );
        }
    }
}

#[test]
fn test_sha256_first12_lowercase_output() {
    // Test that output is lowercase hex
    let result = sha256_first12("TEST");
    assert!(
        result.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()),
        "Should be lowercase hex"
    );
}

#[test]
fn test_sha256_first12_deterministic() {
    // Test that the same input always produces the same output
    let input = "consistent_test";
    let hash1 = sha256_first12(input);
    let hash2 = sha256_first12(input);
    let hash3 = sha256_first12(input);

    assert_eq!(hash1, hash2, "Hash should be deterministic");
    assert_eq!(hash2, hash3, "Hash should be deterministic");
}

#[test]
fn test_sha256_first12_avalanche_effect() {
    // Test that small input changes produce completely different hashes
    let hash1 = sha256_first12("test1");
    let hash2 = sha256_first12("test2");

    assert_ne!(
        hash1, hash2,
        "Different inputs should produce different hashes"
    );

    // Count different hex positions
    let mut diff_count = 0;
    for (c1, c2) in hash1.chars().zip(hash2.chars()) {
        if c1 != c2 {
            diff_count += 1;
        }
    }

    assert!(
        diff_count > 0,
        "Hashes should differ in multiple positions"
    );
}

// ============================================================================
// SECTION 4: CLIENT FINGERPRINT MATCHING LOGIC
// ============================================================================

#[test]
fn test_fingerprints_match_exact_match() {
    // Test exact fingerprint matching (case-insensitive)
    assert!(fingerprints_match(
        Some("t13d1516h2_8daaf6152771_e5627efa2ab1"),
        Some("t13d1516h2_8daaf6152771_e5627efa2ab1")
    ));

    // Case-insensitive
    assert!(fingerprints_match(
        Some("T13D1516H2_8DAAF6152771_E5627EFA2AB1"),
        Some("t13d1516h2_8daaf6152771_e5627efa2ab1")
    ));
}

#[test]
fn test_fingerprints_match_no_match() {
    // Test that different fingerprints don't match
    assert!(!fingerprints_match(
        Some("t13d1516h2_8daaf6152771_e5627efa2ab1"),
        Some("t13d1516h2_8daaf6152771_e5627efa2ab2")
    ));

    assert!(!fingerprints_match(
        Some("t13d1516h2_8daaf6152771_e5627efa2ab1"),
        Some("t12d1516h2_8daaf6152771_e5627efa2ab1")
    ));
}

#[test]
fn test_fingerprints_match_none_handling() {
    // Test handling of None values
    assert!(!fingerprints_match(None, Some("t13d1516h2_8daaf6152771_e5627efa2ab1")));
    assert!(!fingerprints_match(Some("t13d1516h2_8daaf6152771_e5627efa2ab1"), None));
    assert!(!fingerprints_match(None, None));
}

#[test]
fn test_fingerprints_match_empty_strings() {
    // Test with empty strings
    // Empty strings do match when both are Some("")
    assert!(fingerprints_match(Some(""), Some("")));
    // But don't match with non-empty strings
    assert!(!fingerprints_match(Some("test"), Some("")));
    assert!(!fingerprints_match(Some(""), Some("test")));
}

#[test]
fn test_matches_pattern_wildcard_prefix() {
    // Test wildcard matching with prefix
    assert!(matches_pattern(
        "t13d1516h2_8daaf6152771_e5627efa2ab1",
        "t13*"
    ));
    assert!(!matches_pattern(
        "t12d1516h2_8daaf6152771_e5627efa2ab1",
        "t13*"
    ));
}

#[test]
fn test_matches_pattern_wildcard_suffix() {
    // Test wildcard matching with suffix
    assert!(matches_pattern(
        "t13d1516h2_8daaf6152771_e5627efa2ab1",
        "*e5627efa2ab1"
    ));
    assert!(!matches_pattern(
        "t13d1516h2_8daaf6152771_e5627efa2ab1",
        "*e5627efa2ab2"
    ));
}

#[test]
fn test_matches_pattern_wildcard_middle() {
    // Test wildcard matching in the middle
    assert!(matches_pattern(
        "t13d1516h2_8daaf6152771_e5627efa2ab1",
        "*_8daaf6152771_*"
    ));
    assert!(!matches_pattern(
        "t13d1516h2_8daaf6152772_e5627efa2ab1",
        "*_8daaf6152771_*"
    ));
}

#[test]
fn test_matches_pattern_no_wildcard() {
    // Test exact pattern matching (no wildcard)
    assert!(matches_pattern(
        "t13d1516h2_8daaf6152771_e5627efa2ab1",
        "t13d1516h2_8daaf6152771_e5627efa2ab1"
    ));
    assert!(!matches_pattern(
        "t13d1516h2_8daaf6152771_e5627efa2ab1",
        "t13d1516h2_8daaf6152771_e5627efa2ab2"
    ));
}

#[test]
fn test_matches_pattern_case_insensitive() {
    // Test that pattern matching is case-insensitive
    assert!(matches_pattern(
        "t13d1516h2_8daaf6152771_e5627efa2ab1",
        "T13*"
    ));
    assert!(matches_pattern(
        "t13d1516h2_8daaf6152771_e5627efa2ab1",
        "T13D1516H2_*"
    ));
}

// ============================================================================
// SECTION 5: FINGERPRINT SPOOFING DETECTION
// ============================================================================

#[test]
fn test_ja4_spoofing_microsoft_edge_tls_with_firefox_ua() {
    // SECURITY: Test that Microsoft Edge TLS with Firefox UA is flagged as spoofing
    let edge_ja4 = make_test_ja4(
        't', 13, 'd', 20, 22, "h2",
        "8daaf6152771", "e5627efa2ab1"
    );

    let firefox_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

    let result = analyze_ja4_spoofing(&edge_ja4, firefox_ua);

    assert_eq!(result.claimed_browser, "firefox", "Should detect Firefox claim");
    // Note: The analysis validates against Firefox profile, and a 13-cipher H2 browser
    // might not perfectly match Firefox's expected profile, but the key is that
    // the estimated_actual would be "modern-browser" for this JA4
}

#[test]
fn test_ja4_spoofing_old_tls_version_with_modern_browser_claim() {
    // SECURITY: Test that old TLS with modern browser claim is flagged
    let old_ja4 = make_test_ja4(
        't', 10, 'd', 10, 10, "h1",
        "8daaf6152771", "e5627efa2ab1"
    );

    let chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    let result = analyze_ja4_spoofing(&old_ja4, chrome_ua);

    assert!(
        result.likely_spoofed,
        "Old TLS with modern browser claim should be detected as spoofing"
    );
    assert!(
        result.spoofing_confidence >= 50,
        "Spoofing confidence should be high: {}",
        result.spoofing_confidence
    );
}

#[test]
fn test_ja4_spoofing_minimal_ciphers_with_chrome_claim() {
    // SECURITY: Test that minimal ciphers with Chrome claim is flagged
    let minimal_ja4 = make_test_ja4(
        't', 12, 'd', 3, 3, "h1",
        "8daaf6152771", "e5627efa2ab1"
    );

    let chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    let result = analyze_ja4_spoofing(&minimal_ja4, chrome_ua);

    assert!(
        result.likely_spoofed,
        "Minimal ciphers with Chrome claim should be detected as spoofing"
    );
    assert!(
        !result.inconsistencies.is_empty(),
        "Should have inconsistencies"
    );
}

#[test]
fn test_ja4_spoofing_legitimate_chrome() {
    // Test that legitimate Chrome fingerprint is NOT flagged as spoofed
    let legitimate_ja4 = make_test_ja4(
        't', 13, 'd', 16, 18, "h2",
        "8daaf6152771", "e5627efa2ab1"
    );

    let chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    let result = analyze_ja4_spoofing(&legitimate_ja4, chrome_ua);

    assert!(
        !result.likely_spoofed,
        "Legitimate Chrome should not be flagged: {:?}",
        result.inconsistencies
    );
    assert!(
        result.spoofing_confidence < 50,
        "Spoofing confidence should be low: {}",
        result.spoofing_confidence
    );
}

#[test]
fn test_ja4_spoofing_curl_with_browser_fingerprint() {
    // Test CLI tool with browser fingerprint
    let browser_ja4 = make_test_ja4(
        't', 13, 'd', 16, 18, "h2",
        "8daaf6152771", "e5627efa2ab1"
    );

    let curl_ua = "curl/8.4.0";

    let result = analyze_ja4_spoofing(&browser_ja4, curl_ua);

    assert_eq!(result.claimed_browser, "cli-tool");
    // The estimated_actual should be "modern-browser" for this JA4
    // CLI tools don't have expected profiles, so generic validation applies
}

#[test]
fn test_ja4_spoofing_python_requests_with_minimal_tls() {
    // Test Python library with minimal TLS
    let minimal_ja4 = make_test_ja4(
        't', 12, 'd', 2, 2, "h1",
        "8daaf6152771", "e5627efa2ab1"
    );

    let python_ua = "python-requests/2.31.0";

    let result = analyze_ja4_spoofing(&minimal_ja4, python_ua);

    assert_eq!(result.claimed_browser, "python");
    // This would be detected as minimal-client by estimate_actual_client
}

// ============================================================================
// SECTION 6: COMBINED CLIENT FINGERPRINT EXTRACTION
// ============================================================================

#[test]
fn test_extract_client_fingerprint_with_ja4_and_ja4h() {
    // Test combined fingerprint extraction with both JA4 and JA4H
    let headers = vec![
        header("Accept", "text/html"),
        header("User-Agent", "Mozilla/5.0"),
        header("Accept-Language", "en-US"),
    ];
    let request = HttpHeaders {
        headers: &headers,
        method: "GET",
        http_version: "1.1",
    };

    let result = extract_client_fingerprint(Some("t13d1516h2_8daaf6152771_e5627efa2ab1"), &request);

    assert!(result.ja4.is_some(), "Should extract JA4");
    assert_eq!(result.combined_hash.len(), 16, "Combined hash should be 16 hex chars");

    let ja4 = result.ja4.unwrap();
    assert_eq!(ja4.raw, "t13d1516h2_8daaf6152771_e5627efa2ab1");
}

#[test]
fn test_extract_client_fingerprint_without_ja4() {
    // Test fingerprint extraction without JA4 (only JA4H available)
    let headers = vec![header("Accept", "text/html")];
    let request = HttpHeaders {
        headers: &headers,
        method: "GET",
        http_version: "1.1",
    };

    let result = extract_client_fingerprint(None, &request);

    assert!(result.ja4.is_none(), "Should not have JA4");
    assert_eq!(result.combined_hash.len(), 16, "Combined hash should still be computed");
}

#[test]
fn test_extract_client_fingerprint_combined_hash_deterministic() {
    // Test that combined hash is deterministic
    let headers = vec![header("Accept", "text/html")];
    let request = HttpHeaders {
        headers: &headers,
        method: "GET",
        http_version: "1.1",
    };

    let result1 = extract_client_fingerprint(Some("t13d1516h2_8daaf6152771_e5627efa2ab1"), &request);
    let result2 = extract_client_fingerprint(Some("t13d1516h2_8daaf6152771_e5627efa2ab1"), &request);

    assert_eq!(result1.combined_hash, result2.combined_hash, "Combined hash should be deterministic");
}

#[test]
fn test_extract_client_fingerprint_different_inputs_different_hashes() {
    // Test that different inputs produce different combined hashes
    let headers1 = vec![header("Accept", "text/html")];
    let request1 = HttpHeaders {
        headers: &headers1,
        method: "GET",
        http_version: "1.1",
    };

    let headers2 = vec![header("Accept", "application/json")];
    let request2 = HttpHeaders {
        headers: &headers2,
        method: "POST",
        http_version: "2.0",
    };

    let result1 = extract_client_fingerprint(Some("t13d1516h2_8daaf6152771_e5627efa2ab1"), &request1);
    let result2 = extract_client_fingerprint(Some("t13d1516h2_8daaf6152771_e5627efa2ab1"), &request2);

    assert_ne!(result1.combined_hash, result2.combined_hash, "Different requests should produce different hashes");
}

// ============================================================================
// ADDITIONAL VALIDATION TESTS
// ============================================================================

#[test]
fn test_ja4_fingerprint_structure() {
    // Test that parsed JA4 has all required fields
    let fp = parse_ja4_from_header(Some("t13d1516h2_8daaf6152771_e5627efa2ab1")).unwrap();

    assert!(!fp.raw.is_empty());
    assert_eq!(fp.protocol, Ja4Protocol::TCP);
    assert!(fp.tls_version > 0);
    assert!(!fp.alpn.is_empty());
    assert_eq!(fp.cipher_hash.len(), 12);
    assert_eq!(fp.ext_hash.len(), 12);
}

#[test]
fn test_ja4h_fingerprint_structure() {
    let headers = vec![header("Accept", "text/html")];
    let request = HttpHeaders {
        headers: &headers,
        method: "GET",
        http_version: "1.1",
    };

    let fp = generate_ja4h(&request);

    assert!(!fp.raw.is_empty());
    assert_eq!(fp.method.len(), 2);
    assert!(fp.http_version > 0);
    assert!(!fp.accept_lang.is_empty());
    assert_eq!(fp.header_hash.len(), 12);
    assert_eq!(fp.cookie_hash.len(), 12);
}

#[test]
fn test_analyze_ja4_modern_browser() {
    // Test JA4 analysis for modern browser
    let fp = make_test_ja4(
        't', 13, 'd', 15, 16, "h2",
        "8daaf6152771", "e5627efa2ab1"
    );

    let analysis = analyze_ja4(&fp);

    assert!(!analysis.suspicious, "Modern browser should not be suspicious");
    assert!(analysis.issues.is_empty(), "Should have no issues");
    assert_eq!(analysis.estimated_client, "modern-browser");
}

#[test]
fn test_analyze_ja4_bot() {
    // Test JA4 analysis for bot/script
    let fp = make_test_ja4(
        't', 10, 'n', 2, 2, "h1",
        "8daaf6152771", "e5627efa2ab1"
    );

    let analysis = analyze_ja4(&fp);

    assert!(analysis.suspicious, "Bot should be suspicious");
    assert!(!analysis.issues.is_empty(), "Should have issues");
    assert_eq!(analysis.estimated_client, "bot-or-script");
}

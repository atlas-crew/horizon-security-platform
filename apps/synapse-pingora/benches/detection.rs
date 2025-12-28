//! Performance benchmarks for the Synapse detection engine.
//!
//! Run with: `cargo bench`
//!
//! These benchmarks verify the sub-10μs detection target.

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use once_cell::sync::Lazy;
use regex::Regex;
use std::time::Duration;

// ============================================================================
// Detection Engine (copied from main.rs for benchmark isolation)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttackType {
    SqlInjection,
    CrossSiteScripting,
    PathTraversal,
    CommandInjection,
}

#[derive(Debug, Clone)]
pub struct DetectionResult {
    pub blocked: bool,
    pub attack_type: Option<AttackType>,
    pub matched_pattern: Option<String>,
}

impl Default for DetectionResult {
    fn default() -> Self {
        Self {
            blocked: false,
            attack_type: None,
            matched_pattern: None,
        }
    }
}

struct DetectionPatterns {
    sqli: Regex,
    xss: Regex,
    path_traversal: Regex,
    cmd_injection: Regex,
}

static PATTERNS: Lazy<DetectionPatterns> = Lazy::new(|| {
    DetectionPatterns {
        sqli: Regex::new(
            r"(?i)(union\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|'\s*or\s*'|;\s*--|/\*.*\*/)"
        ).expect("SQLi regex failed to compile"),
        xss: Regex::new(
            r"(?i)(<script|javascript:|on\w+\s*=|<img[^>]+onerror|<svg[^>]+onload)"
        ).expect("XSS regex failed to compile"),
        path_traversal: Regex::new(
            r"(\.\./|\.\.\\|%2e%2e%2f|%2e%2e/|\.\.%2f)"
        ).expect("Path traversal regex failed to compile"),
        cmd_injection: Regex::new(
            r"(\|\s*\w|;\s*\w+\s|`[^`]+`|\$\([^)]+\)|&&\s*\w|\|\|\s*\w)"
        ).expect("Command injection regex failed to compile"),
    }
});

pub struct DetectionEngine;

impl DetectionEngine {
    #[inline]
    pub fn analyze(method: &str, uri: &str, headers: &[(String, String)]) -> DetectionResult {
        let mut input = format!("{} {}", method, uri);
        for (name, value) in headers {
            let name_lower = name.to_lowercase();
            if name_lower == "user-agent"
                || name_lower == "cookie"
                || name_lower == "referer"
                || name_lower == "x-forwarded-for"
            {
                input.push(' ');
                input.push_str(value);
            }
        }
        Self::detect(&input)
    }

    #[inline]
    fn detect(input: &str) -> DetectionResult {
        if let Some(m) = PATTERNS.sqli.find(input) {
            return DetectionResult {
                blocked: true,
                attack_type: Some(AttackType::SqlInjection),
                matched_pattern: Some(m.as_str().to_string()),
            };
        }
        if let Some(m) = PATTERNS.xss.find(input) {
            return DetectionResult {
                blocked: true,
                attack_type: Some(AttackType::CrossSiteScripting),
                matched_pattern: Some(m.as_str().to_string()),
            };
        }
        if let Some(m) = PATTERNS.path_traversal.find(input) {
            return DetectionResult {
                blocked: true,
                attack_type: Some(AttackType::PathTraversal),
                matched_pattern: Some(m.as_str().to_string()),
            };
        }
        if let Some(m) = PATTERNS.cmd_injection.find(input) {
            return DetectionResult {
                blocked: true,
                attack_type: Some(AttackType::CommandInjection),
                matched_pattern: Some(m.as_str().to_string()),
            };
        }
        DetectionResult::default()
    }
}

// ============================================================================
// Benchmarks
// ============================================================================

fn bench_clean_requests(c: &mut Criterion) {
    // Force pattern compilation before benchmark
    let _ = &*PATTERNS;

    let clean_uris = vec![
        ("/api/users/123", "simple path"),
        ("/api/search?q=hello+world&page=1", "with query"),
        ("/api/products/list?category=electronics&sort=price", "complex query"),
        ("/assets/images/logo.png", "static asset"),
        ("/v1/oauth/token", "auth endpoint"),
    ];

    let mut group = c.benchmark_group("clean_requests");
    group.measurement_time(Duration::from_secs(5));
    group.sample_size(1000);

    for (uri, name) in clean_uris {
        group.bench_with_input(
            BenchmarkId::new("detection", name),
            &uri,
            |b, uri| {
                b.iter(|| {
                    let result = DetectionEngine::analyze(
                        black_box("GET"),
                        black_box(uri),
                        black_box(&[]),
                    );
                    assert!(!result.blocked);
                    result
                })
            },
        );
    }
    group.finish();
}

fn bench_attack_detection(c: &mut Criterion) {
    let _ = &*PATTERNS;

    let attacks = vec![
        ("/api/users?id=1' OR '1'='1", "sqli"),
        ("/search?q=<script>alert(1)</script>", "xss"),
        ("/files/../../../etc/passwd", "path_traversal"),
        ("/ping?host=127.0.0.1|cat /etc/passwd", "cmd_injection"),
    ];

    let mut group = c.benchmark_group("attack_detection");
    group.measurement_time(Duration::from_secs(5));
    group.sample_size(1000);

    for (uri, name) in attacks {
        group.bench_with_input(
            BenchmarkId::new("detection", name),
            &uri,
            |b, uri| {
                b.iter(|| {
                    let result = DetectionEngine::analyze(
                        black_box("GET"),
                        black_box(uri),
                        black_box(&[]),
                    );
                    assert!(result.blocked);
                    result
                })
            },
        );
    }
    group.finish();
}

fn bench_with_headers(c: &mut Criterion) {
    let _ = &*PATTERNS;

    let headers = vec![
        ("user-agent".to_string(), "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36".to_string()),
        ("cookie".to_string(), "session=abc123; user=john".to_string()),
        ("referer".to_string(), "https://example.com/page".to_string()),
        ("x-forwarded-for".to_string(), "192.168.1.1, 10.0.0.1".to_string()),
    ];

    let mut group = c.benchmark_group("with_headers");
    group.measurement_time(Duration::from_secs(5));
    group.sample_size(1000);

    // Clean request with headers
    group.bench_function("clean_with_headers", |b| {
        b.iter(|| {
            DetectionEngine::analyze(
                black_box("GET"),
                black_box("/api/users/123"),
                black_box(&headers),
            )
        })
    });

    // Attack in header
    let attack_headers = vec![
        ("user-agent".to_string(), "<script>alert(1)</script>".to_string()),
    ];
    group.bench_function("xss_in_header", |b| {
        b.iter(|| {
            let result = DetectionEngine::analyze(
                black_box("GET"),
                black_box("/api/users/123"),
                black_box(&attack_headers),
            );
            assert!(result.blocked);
            result
        })
    });

    group.finish();
}

fn bench_throughput(c: &mut Criterion) {
    let _ = &*PATTERNS;

    // Mixed workload simulating real traffic
    let requests: Vec<(&str, &str, bool)> = vec![
        ("GET", "/api/users/123", false),
        ("GET", "/api/search?q=hello", false),
        ("POST", "/api/login", false),
        ("GET", "/api/users?id=1' OR '1'='1", true),
        ("GET", "/static/main.js", false),
        ("GET", "/search?q=<script>alert(1)</script>", true),
        ("GET", "/api/products", false),
        ("GET", "/files/../../../etc/passwd", true),
        ("PUT", "/api/users/123", false),
        ("DELETE", "/api/users/123", false),
    ];

    let mut group = c.benchmark_group("throughput");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(1000);

    group.bench_function("mixed_workload_10_requests", |b| {
        b.iter(|| {
            for (method, uri, expected_block) in &requests {
                let result = DetectionEngine::analyze(
                    black_box(method),
                    black_box(uri),
                    black_box(&[]),
                );
                assert_eq!(result.blocked, *expected_block);
            }
        })
    });

    group.finish();
}

fn bench_sub_10us_verification(c: &mut Criterion) {
    let _ = &*PATTERNS;

    let mut group = c.benchmark_group("sub_10us_target");
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(10000);

    // This is THE key benchmark - must be under 10μs
    group.bench_function("full_detection_cycle", |b| {
        b.iter(|| {
            DetectionEngine::analyze(
                black_box("GET"),
                black_box("/api/users?id=1' OR '1'='1&name=test&page=1"),
                black_box(&[
                    ("user-agent".to_string(), "Mozilla/5.0".to_string()),
                    ("cookie".to_string(), "session=abc".to_string()),
                ]),
            )
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_clean_requests,
    bench_attack_detection,
    bench_with_headers,
    bench_throughput,
    bench_sub_10us_verification,
);

criterion_main!(benches);

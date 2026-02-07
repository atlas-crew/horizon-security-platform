//! Sustained throughput and memory pressure benchmarks.
//!
//! Long-running benchmarks (60s measurement) that simulate sustained traffic
//! to catch latency drift, memory growth, and GC/cleanup overhead over time.
//!
//! These are slow by design. Run selectively:
//!   `cargo bench --bench sustained_bench`
//!   `cargo bench --bench sustained_bench -- sustained/entity`

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::fs;
use std::net::IpAddr;
use std::path::Path;
use std::time::Duration;

use synapse_pingora::dlp::{DlpConfig, DlpScanner};
use synapse_pingora::waf::{Header as SynapseHeader, Request as SynapseRequest, Synapse};
use synapse_pingora::{
    EntityConfig, EntityManager, SchemaLearner, SchemaLearnerConfig, SessionConfig, SessionManager,
};

// ============================================================================
// Helpers
// ============================================================================

fn load_synapse() -> Synapse {
    let mut synapse = Synapse::new();
    let rules_path = Path::new("data/rules.json");
    if rules_path.exists() {
        if let Ok(rules_json) = fs::read(rules_path) {
            let _ = synapse.load_rules(&rules_json);
        }
    }
    synapse
}

fn clean_request(ip: &str) -> SynapseRequest<'_> {
    SynapseRequest {
        method: "GET",
        path: "/api/users/123?page=1&limit=20",
        query: None,
        headers: vec![
            SynapseHeader::new(
                "user-agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            ),
            SynapseHeader::new("accept", "application/json"),
        ],
        body: None,
        client_ip: ip,
        is_static: false,
    }
}

fn attack_request(ip: &str) -> SynapseRequest<'_> {
    SynapseRequest {
        method: "GET",
        path: "/api/search?q=1'+UNION+SELECT+username,password+FROM+users--",
        query: None,
        headers: vec![SynapseHeader::new("user-agent", "Mozilla/5.0")],
        body: None,
        client_ip: ip,
        is_static: false,
    }
}

// ============================================================================
// 1. WAF Detection — 60s Sustained
// ============================================================================

fn bench_sustained_waf(c: &mut Criterion) {
    let mut group = c.benchmark_group("sustained/waf_detection_60s");
    group.measurement_time(Duration::from_secs(60));
    group.sample_size(10);
    group.noise_threshold(0.10);

    let synapse = load_synapse();
    let ip = "192.168.1.100";

    group.bench_function("alternating_clean_attack", |b| {
        let mut idx = 0u64;
        b.iter(|| {
            if idx % 2 == 0 {
                let req = clean_request(ip);
                let verdict = synapse.analyze(black_box(&req));
                black_box(verdict);
            } else {
                let req = attack_request(ip);
                let verdict = synapse.analyze(black_box(&req));
                black_box(verdict);
            }
            idx += 1;
        });
    });

    group.finish();
}

// ============================================================================
// 2. Entity Accumulation — Latency vs Size
// ============================================================================

fn bench_sustained_entity(c: &mut Criterion) {
    let mut group = c.benchmark_group("sustained/entity_accumulation");
    group.measurement_time(Duration::from_secs(60));
    group.sample_size(10);
    group.noise_threshold(0.10);

    let manager = EntityManager::new(EntityConfig {
        max_entities: 200_000,
        ..Default::default()
    });

    group.bench_function("touch_growing_store", |b| {
        let mut idx = 0u64;
        b.iter(|| {
            let ip = format!(
                "10.{}.{}.{}",
                (idx >> 16) & 0xFF,
                (idx >> 8) & 0xFF,
                idx & 0xFF
            );
            let snapshot = manager.touch_entity(black_box(&ip));
            black_box(snapshot);
            idx += 1;
        });
    });

    group.finish();
}

// ============================================================================
// 3. Schema Learning Growth — 5000 Endpoints
// ============================================================================

fn bench_sustained_schema(c: &mut Criterion) {
    let mut group = c.benchmark_group("sustained/schema_learning_growth");
    group.measurement_time(Duration::from_secs(60));
    group.sample_size(10);
    group.noise_threshold(0.10);

    let learner = SchemaLearner::with_config(SchemaLearnerConfig {
        max_schemas: 10_000,
        ..Default::default()
    });

    let body = serde_json::json!({
        "name": "test",
        "value": 42,
        "active": true
    });

    group.bench_function("learn_unique_endpoints", |b| {
        let mut idx = 0u64;
        b.iter(|| {
            let template = format!("/api/endpoint/{}", idx % 5000);
            learner.learn_from_request(black_box(&template), black_box(&body));
            idx += 1;
        });
    });

    group.finish();
}

// ============================================================================
// 4. DLP Scan — Steady State
// ============================================================================

fn bench_sustained_dlp(c: &mut Criterion) {
    let mut group = c.benchmark_group("sustained/dlp_scan_steady_state");
    group.measurement_time(Duration::from_secs(60));
    group.sample_size(10);
    group.noise_threshold(0.10);

    let scanner = DlpScanner::new(DlpConfig::default());
    let content_with_pii =
        "Customer John Smith, card 4532-0151-1283-0366, SSN 123-45-6789, email john@example.com";
    let clean_content = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

    group.bench_function("mixed_scan", |b| {
        let mut idx = 0u64;
        b.iter(|| {
            if idx % 5 == 0 {
                let result = scanner.scan(black_box(content_with_pii));
                black_box(result);
            } else {
                let result = scanner.scan(black_box(clean_content));
                black_box(result);
            }
            idx += 1;
        });
    });

    group.finish();
}

// ============================================================================
// 5. Session Churn — Create/Validate/Expire
// ============================================================================

fn bench_sustained_session_churn(c: &mut Criterion) {
    let mut group = c.benchmark_group("sustained/session_churn");
    group.measurement_time(Duration::from_secs(60));
    group.sample_size(10);
    group.noise_threshold(0.10);

    group.bench_function("create_validate_expire", |b| {
        let manager = SessionManager::new(SessionConfig {
            max_sessions: 20_000,
            session_ttl_secs: 1, // Short TTL for expiry
            ..Default::default()
        });
        let ip: IpAddr = "192.168.1.1".parse().unwrap();
        let ja4 = "t13d1516h2_bench_sustained";

        let mut idx = 0u64;
        b.iter(|| {
            // Create 10 sessions
            for j in 0..10 {
                let token = format!("churn_{}_{}", idx, j);
                manager.create_session(black_box(&token), black_box(ip), black_box(Some(ja4)));
            }
            // Validate 10 existing sessions
            for j in 0..10 {
                let token = format!("churn_{}_{}", idx.saturating_sub(1), j);
                let decision = manager.validate_request(
                    black_box(&token),
                    black_box(ip),
                    black_box(Some(ja4)),
                );
                black_box(decision);
            }
            // Touch sessions to simulate activity
            for j in 0..10 {
                let token = format!("churn_{}_{}", idx.saturating_sub(2), j);
                manager.touch_session(black_box(&token));
            }
            idx += 1;
        });
    });

    group.finish();
}

// ============================================================================
// 6. Memory Pressure — Heavy Mixed Workload
// ============================================================================

fn bench_sustained_memory_pressure(c: &mut Criterion) {
    let mut group = c.benchmark_group("sustained/memory_pressure");
    group.measurement_time(Duration::from_secs(60));
    group.sample_size(10);
    group.noise_threshold(0.10);

    let entity_mgr = EntityManager::new(EntityConfig {
        max_entities: 100_000,
        ..Default::default()
    });
    let learner = SchemaLearner::with_config(SchemaLearnerConfig {
        max_schemas: 5_000,
        ..Default::default()
    });
    let scanner = DlpScanner::new(DlpConfig::default());

    let body = serde_json::json!({"name": "test", "value": 42});
    let content = "Customer card 4532-0151-1283-0366, SSN 123-45-6789";
    let clean = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

    group.bench_function("mixed_entity_schema_dlp", |b| {
        let mut idx = 0u64;
        b.iter(|| {
            // Touch 100 entities
            for j in 0..100u64 {
                let ip = format!(
                    "10.{}.{}.{}",
                    ((idx * 100 + j) >> 16) & 0xFF,
                    ((idx * 100 + j) >> 8) & 0xFF,
                    (idx * 100 + j) & 0xFF
                );
                black_box(entity_mgr.touch_entity(&ip));
            }
            // Learn 10 schemas
            for j in 0..10u64 {
                let template = format!("/api/pressure/{}", (idx * 10 + j) % 5000);
                learner.learn_from_request(&template, &body);
            }
            // Scan 10 contents
            for j in 0..10u64 {
                if j % 3 == 0 {
                    black_box(scanner.scan(content));
                } else {
                    black_box(scanner.scan(clean));
                }
            }
            idx += 1;
        });
    });

    group.finish();
}

// ============================================================================
// Criterion Groups & Main
// ============================================================================

criterion_group!(
    sustained_benches,
    bench_sustained_waf,
    bench_sustained_entity,
    bench_sustained_schema,
    bench_sustained_dlp,
    bench_sustained_session_churn,
    bench_sustained_memory_pressure,
);

criterion_main!(sustained_benches);

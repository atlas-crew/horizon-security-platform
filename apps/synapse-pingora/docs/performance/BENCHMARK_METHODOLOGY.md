# Benchmark Methodology

## Overview

This document outlines the standardized methodology for benchmarking the Synapse-Pingora WAF engine. The suite covers **19 benchmark files** organized across **7 categories**: Detection Engine, Request Pipeline, Threat Intelligence, Security Features, Session Management, Operational, and Concurrency.

All benchmarks use the [Criterion](https://bheisler.github.io/criterion.rs/book/) harness for statistically rigorous measurement, with configurable warm-up, sample sizes, and noise thresholds appropriate to each workload type.

## Benchmark Profiles

### Detection Engine Profiles

#### Fast-Path (Light Traffic)
Represents the majority of high-frequency API traffic.
*   **Composition:**
    *   Simple GET requests.
    *   Small POSTs (Login, simple search).
    *   Standard headers (<5).
    *   No or small body (<500 bytes).
*   **Target Latency:** < 20 us.

#### Attack Vectors
Represents malicious traffic triggering detection rules.
*   **Composition:**
    *   SQL Injection (SQLi) patterns in query parameters.
    *   Cross-Site Scripting (XSS) payloads in headers/body.
    *   Path Traversal attempts.
    *   Command Injection sequences.
    *   XXE payloads.
*   **Target Latency:** < 30 us.

#### Heavy-Path (Complex Traffic)
Represents "worst-case" but legitimate business traffic (e.g., bulk operations, large form submissions).
*   **Composition:**
    *   **Body:** > 10 KB JSON (Nested objects, arrays).
    *   **Headers:** > 20 (Simulating full browser/client context).
    *   **Query Params:** > 10.
*   **Target Latency:** < 300 us.

### Subsystem Isolation Profiles

Individual subsystems are benchmarked in isolation to establish per-component baselines. Each subsystem benchmark constructs its own fixtures and measures core operations independently of the full request pipeline:

*   **Risk Scoring** - Risk application, decay curves, blocklist lookups.
*   **Correlation** - Fingerprint indexing, campaign scoring, similarity matching.
*   **Profiler** - Distribution math, anomaly detection, entropy calculations.
*   **Schema** - Schema learning, validation, LRU eviction under pressure.
*   **Bot Detection** - 500+ signature matching, async verification flows.
*   **Header Profiler** - Header distribution learning, anomaly scoring.
*   **Response Scanning** - HTML/JSON output scanning, streaming vs batch modes.

### Concurrency Scaling Profiles

Multi-threaded contention tests measure shared-state performance at 1, 2, 4, and 8 threads:

*   **Token Bucket** - Rate limiter contention under parallel access.
*   **DashMap** - Concurrent map operations (read-heavy, write-heavy, mixed).
*   **DLP Scaling** - Data Loss Prevention scanning throughput across thread counts.

### Sustained Load Profiles

60-second sustained workloads that test for latency drift and memory growth over time:

*   **Detection sustained** - Continuous mixed-traffic detection processing.
*   **Pipeline sustained** - Full request chain under constant pressure.
*   **Correlation sustained** - Fingerprint accumulation and eviction stability.
*   Uses a 10% noise threshold (vs the default 5%) to account for longer measurement windows.

### End-to-End Scenario Profiles

Realistic multi-component scenarios from `benches/scenarios.json` (79 KB):

*   **Bulk Import** - High-volume data ingestion with body inspection.
*   **E-commerce** - Mixed API calls simulating checkout flows.
*   **Healthcare** - HIPAA-sensitive payloads with DLP scanning.
*   **Multi-type** - Interleaved legitimate and attack traffic.

## Execution

### Prerequisites

```bash
# Build with bench profile (LTO thin, codegen-units=1, opt-level=3)
cd apps/synapse-pingora
cargo bench --no-run  # Compile only, verify build succeeds
```

The bench profile is defined in `Cargo.toml`:
```toml
[profile.bench]
lto = "thin"
codegen-units = 1
opt-level = 3
```

### Data Files

| File | Description |
|------|-------------|
| `benches/payloads.json` | Attack payloads (SQLi, XSS, CmdInj, PathTrav, XXE) |
| `benches/heavy_payloads.json` | Large request payloads for stress testing |
| `benches/scenarios.json` | Complex multi-type request scenarios (79 KB) |
| `benches/fixtures/bench_config.yaml` | Multi-site config (20 upstream sites) |
| `config.bench.yaml` | WAF config for benchmarks (4 workers, rate limit disabled) |

### Running All Benchmarks

```bash
cargo bench                              # Run all 19 suites
cargo bench --bench detection            # Single suite
cargo bench --bench detection -- "sqli"  # Filter within suite
```

### Running by Category

```bash
# Detection Engine
cargo bench --bench detection

# Request Pipeline
cargo bench --bench pipeline --bench hot_path_bench

# Threat Intelligence
cargo bench --bench risk_scoring --bench correlation --bench profiler_bench --bench schema_bench

# Security Features
cargo bench --bench bot_detection_bench --bench escalation_bench --bench captcha_bench \
            --bench response_scan_bench --bench header_profiler_bench

# Session & Actor
cargo bench --bench actor_session_bench --bench subsystems

# Operational
cargo bench --bench contention --bench reload_bench --bench sustained_bench \
            --bench proxy_overhead_bench --bench goblins
```

### k6 Load Tests (Full Proxy)

k6 load tests exercise the compiled proxy binary end-to-end, including network I/O, context switching, and buffer management.

#### Setup

```bash
# Start proxy in release mode
cd apps/synapse-pingora
cargo run --release -- --dev
```

#### Run

```bash
k6 run benches/k6/scenarios.js   # Multi-scenario traffic mix
k6 run benches/k6/high_load.js   # Sustained constant-arrival-rate
```

#### Observability

Monitor the internal metrics via the Admin API during load tests:

```bash
# Check WAF detection latency and anomaly counts
curl -s http://localhost:6191/metrics | grep synapse_
```

Analyze the proxy logs for internal timing metrics and compare the `http_req_duration` from k6 with `synapse_waf_detection_avg_us` to calculate the percentage of latency contributed by the WAF.

## Benchmark Suite Reference

| Suite | File | Category | Benchmarks | Key Metrics |
|-------|------|----------|------------|-------------|
| detection | detection.rs | Detection | 40+ | Sub-10us target, attack detection latency |
| pipeline | pipeline.rs | Pipeline | 12 | Rate limiting, ACL, tarpit, full chain |
| hot_path_bench | hot_path_bench.rs | Pipeline | 30+ | SNI, body inspection, traps, domain validation |
| risk_scoring | risk_scoring.rs | Threat Intel | 18 | Risk application, decay, blocklist |
| correlation | correlation.rs | Threat Intel | 14 | Fingerprint indexing, campaign scoring |
| profiler_bench | profiler_bench.rs | Threat Intel | 23 | Distribution math, anomaly detection |
| schema_bench | schema_bench.rs | Threat Intel | 11 | Schema learning/validation, LRU eviction |
| bot_detection_bench | bot_detection_bench.rs | Security | 8 | 500+ signature matching, async verify |
| escalation_bench | escalation_bench.rs | Security | 10 | Cookie gen, PoW, state machine |
| captcha_bench | captcha_bench.rs | Security | 7 | Issue, validate, round-trip |
| response_scan_bench | response_scan_bench.rs | Security | 9 | HTML/JSON scan, streaming vs batch |
| header_profiler_bench | header_profiler_bench.rs | Security | 14 | Header learning, anomaly detection |
| actor_session_bench | actor_session_bench.rs | Session | 11 | Create, lookup, block, session binding |
| subsystems | subsystems.rs | Session | 25 | Trends, crawler, credential stuffing, travel |
| contention | contention.rs | Operational | 5 | Token bucket, DashMap, DLP scaling |
| reload_bench | reload_bench.rs | Operational | 4 | Config reload, concurrent reads |
| sustained_bench | sustained_bench.rs | Operational | 6 | 60s sustained workloads |
| proxy_overhead_bench | proxy_overhead_bench.rs | Operational | 10 | Vhost, fingerprint, entity lookup |
| goblins | goblins.rs | Operational | 9 | DLP scan, JA4, entity LRU, serde |

## Correctness Validation

Benchmarks include correctness gates to ensure measured code paths are exercising real logic, not optimized-away stubs:

*   **Detection benchmarks** validate that known attack payloads trigger risk scores > 0.
*   **DLP benchmarks** validate PII detection (credit cards, SSNs, email addresses).
*   **Bot detection** validates matching against the full 500+ signature database.
*   **Domain validation** rejects IDN homograph attacks.
*   **Schema validation** rejects type mismatches and constraint violations.
*   All benchmarks use `black_box()` to prevent the compiler from eliding measured work.

## Interpreting Results

*   **Reports:** Criterion generates HTML reports. Open `report/index.html` under the target directory's `criterion/` folder for graphs and regression analysis. The workspace-level target directory may differ from the default `~/.cargo/target/`.
*   **Regressions:** The `change` field in Criterion output shows comparison to the previous run (if a baseline exists). A negative percentage indicates improvement; positive indicates regression.
*   **Noise Threshold:** Most suites use the default 0.05 (5%). Sustained benchmarks use 0.10 (10%) to account for OS scheduling jitter over longer measurement windows.
*   **Measurement Time:** Most suites use 5s per benchmark. Throughput-oriented tests use 10s. Sustained tests run for 60s.
*   **Variance:** Pay attention to outliers. A variance >10% often indicates regex backtracking issues on specific payloads or GC-like pressure from allocator contention.
*   **Scaling:** Compare "Baseline Complex" (no body) vs "Heavy Complex" to isolate the cost of body inspection.
*   **Environment:** Always run benchmarks on comparable hardware (CI/CD runners or dedicated metal) to ensure consistency.

## Historical Reports

*   [January 2026 - Bimodal Performance Discovery](../archive/performance/BENCHMARK_REPORT_2026_01.md)
*   [February 2026 - Comprehensive Suite Report](./BENCHMARK_REPORT_2026_02.md)

## Adding New Benchmarks

When adding a new benchmark suite:

1.  Create a new `.rs` file in `benches/` following the naming convention (`<subsystem>.rs` or `<subsystem>_bench.rs`).
2.  Register it as a `[[bench]]` entry in `Cargo.toml` with `harness = false`.
3.  Use Criterion groups to organize related measurements.
4.  Include correctness assertions (via `assert!` or conditional panics) before the measurement loop to verify the code path is exercising real logic.
5.  Add data files to `benches/` or `benches/fixtures/` as needed.
6.  Update the **Benchmark Suite Reference** table in this document.
7.  Choose appropriate Criterion settings:
    *   `measurement_time`: 5s for micro-benchmarks, 10s for throughput, 60s for sustained.
    *   `noise_threshold`: 0.05 default, 0.10 for sustained or OS-sensitive tests.
    *   `sample_size`: Criterion default (100) is fine for most; reduce for expensive benchmarks.

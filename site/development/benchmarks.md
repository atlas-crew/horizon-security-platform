---
title: Benchmarks
---

# Benchmarks

Synapse uses [Criterion.rs](https://bheisler.github.io/criterion.rs/book/) for benchmarking. There are 10 benchmark suites with 306 total benchmarks.

## Running Benchmarks

```sh
cd apps/synapse-pingora

# All benchmarks
cargo bench

# Specific suite
cargo bench --bench detection
cargo bench --bench hot_path_bench
```

Criterion generates HTML reports in `target/criterion/`. Open `target/criterion/report/index.html` for an interactive dashboard.

## Benchmark Suites

| Suite | What It Measures |
| --- | --- |
| `detection` | WAF rule detection latency across attack vectors |
| `risk_scoring` | Risk calculation and entity scoring |
| `schema_bench` | API schema profiling and learning |
| `profiler_bench` | Behavioral endpoint profiling |
| `hot_path_bench` | Critical per-request operations |
| `sustained_bench` | Sustained load over time |
| `escalation_bench` | Attack escalation and response patterns |
| `header_profiler_bench` | Header analysis performance |
| `captcha_bench` | CAPTCHA challenge generation |
| `goblins` | Chaos and stress testing |

## Key Performance Numbers

### Detection Engine

| Operation | Latency |
| --- | --- |
| Simple GET (no params) | ~10 μs |
| SQLi detection (avg) | ~27 μs |
| XSS detection (avg) | ~23 μs |
| Evasive attacks (hex, unicode, polyglot) | ~25–33 μs |
| Full rule set (237 rules) | ~72 μs |

### Per-Request Hot Path

| Operation | Latency |
| --- | --- |
| Rate limit check | 61 ns |
| ACL evaluation (100 rules) | 156 ns |
| Trap matching (honeypot) | 33 ns |
| Actor is-blocked check | 45 ns |
| Session validation | 304 ns |

### End-to-End Pipeline

| Scenario | Latency |
| --- | --- |
| Clean GET, full chain | 72 μs |
| WAF + DLP (4 KB body) | 247 μs |
| WAF + DLP (8 KB body) | 442 μs |
| E-commerce order (heavy) | 1.6 ms |
| Healthcare claim (PII + DLP) | 2.3 ms |

### Comparison

| Implementation | Detection Latency | Notes |
| --- | --- | --- |
| **Synapse (Pingora)** | ~10–25 μs | Pure Rust, no FFI boundary |
| libsynapse (NAPI) | ~62–73 μs | Node.js + Rust FFI overhead |
| ModSecurity | 100–500 μs | Depends on ruleset |
| AWS WAF | 50–200 μs | Cloud service |

::: info Benchmark environment
Numbers are from February 2026 Criterion.rs runs on macOS arm64, release build with LTO. See `docs/performance/BENCHMARK_REPORT_2026_02.md` in the Synapse directory for the full report.
:::

## Load Testing

For realistic load testing beyond micro-benchmarks, see:

- `apps/synapse-pingora/docs/performance/TUNNEL_LOAD_TEST.md` — WebSocket tunnel load testing
- `apps/synapse-pingora/docs/performance/BENCHMARK_METHODOLOGY.md` — testing methodology and reproducibility

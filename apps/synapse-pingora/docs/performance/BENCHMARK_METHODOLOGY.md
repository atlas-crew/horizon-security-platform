# Benchmark Methodology

## Overview
This document outlines the standardized methodology for benchmarking the Synapse-Pingora detection engine. Our goal is to provide realistic, reproducible performance metrics that cover both "fast-path" and "heavy-path" traffic scenarios.

## Benchmark Profiles

### 1. Fast-Path (Light Traffic)
Represents the majority of high-frequency API traffic.
*   **Composition:**
    *   Simple GET requests.
    *   Small POSTs (Login, simple search).
    *   Standard headers (<5).
    *   No or small body (<500 bytes).
*   **Target Latency:** < 20 µs.

### 2. Attack Vectors
Represents malicious traffic triggering detection rules.
*   **Composition:**
    *   SQL Injection (SQLi) patterns in query parameters.
    *   Cross-Site Scripting (XSS) payloads in headers/body.
    *   Path Traversal attempts.
*   **Target Latency:** < 30 µs.

### 3. Heavy-Path (Complex Traffic)
Represents "worst-case" but legitimate business traffic (e.g., bulk operations, large form submissions).
*   **Composition:**
    *   **Body:** > 10 KB JSON (Nested objects, arrays).
    *   **Headers:** > 20 (Simulating full browser/client context).
    *   **Query Params:** > 10.
*   **Target Latency:** < 300 µs.

## Execution

### 1. Preparation
Before running benchmarks, you must generate the realistic payload data. This is done via standalone Node.js scripts that simulate real traffic patterns without requiring the full k6 environment.

```bash
# Run from the project root or synapse-pingora directory
cd apps/synapse-pingora
npm run bench:setup
```
This command executes:
- `bench-generate-payloads.mjs`: Creates `payloads.json` with normal logins/orders and attack strings.
- `bench-generate-heavy.mjs`: Creates `heavy_payloads.json` with a ~15KB body and 20+ headers.

### 2. Running Rust Engine Benchmarks
We use **Criterion** for high-precision micro-benchmarking of the detection logic.

```bash
cd apps/synapse-pingora
cargo bench
```
*Note: Results are generated in `target/criterion/report/index.html`.*

### 3. Running Native Addon Benchmarks (Node.js)
To test the performance of the Rust engine when called from Node.js (via N-API), use the native benchmark harness in `risk-server`.

```bash
cd apps/risk-server
npm run native:bench
```
This tests:
- JS vs Native execution overhead.
- Parallel processing (Rayon).
- Zero-copy FlatBuffer serialization.

## Analysis Guidelines
*   **Variance:** Pay attention to outliers. A variance >10% often indicates regex backtracking issues on specific payloads.
*   **Scaling:** Compare "Baseline Complex" (no body) vs "Heavy Complex" to isolate the cost of body inspection.
*   **Environment:** Always run benchmarks on comparable hardware (CI/CD runners or dedicated metal) to ensure consistency.

## Historical Reports
*   [January 2026 - Bimodal Performance Discovery](./BENCHMARK_REPORT_2026_01.md)

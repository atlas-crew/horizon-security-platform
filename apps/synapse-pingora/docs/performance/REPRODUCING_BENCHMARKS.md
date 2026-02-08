# Reproducing Benchmark Results

## Prerequisites

### System Requirements
- Rust toolchain (stable, 1.75+)
- macOS or Linux (benchmarks are OS-portable)
- At least 8 GB RAM (benchmark compilation is memory-intensive)
- gnuplot (optional, for prettier HTML reports)

### Install Dependencies
```bash
# macOS
brew install gnuplot  # Optional: for criterion plot backend

# Linux (Debian/Ubuntu)
sudo apt-get install gnuplot  # Optional
```

### Build Verification
```bash
cd apps/synapse-pingora

# Compile all benchmarks without running (catches build errors)
cargo bench --no-run
```

This compiles with the bench profile: LTO thin, codegen-units=1, opt-level=3. First compilation takes ~8-10 minutes.

## Running Benchmarks

### Full Suite (All 19 Benchmarks)
```bash
cd apps/synapse-pingora
cargo bench 2>&1 | tee benchmark-results.txt
```

**Warning:** A full run takes 45-90 minutes depending on hardware due to Criterion's statistical sampling (100-5000 samples per benchmark, 19 suites, 250+ individual benchmarks).

### By Category

#### Detection Engine
Tests WAF detection latency for clean and malicious requests against 237 rules.
```bash
cargo bench --bench detection
```
**Expected duration:** ~10-15 min
**Key file dependencies:** `data/rules.json`, `benches/payloads.json`, `benches/heavy_payloads.json`, `benches/scenarios.json`
**Correctness gate:** At least one known attack (SQLi, XSS, path traversal, command injection) must trigger risk > 0. The benchmark validates this before measuring.

#### Request Pipeline
Tests rate limiting, access control, tarpit, and full request pipeline.
```bash
cargo bench --bench pipeline --bench hot_path_bench
```
**Expected duration:** ~8-10 min
**Key metrics:** Token bucket latency (~50-70 ns), ACL matching (~5-160 ns), full pipeline (~65-72 us)

#### Threat Intelligence
Tests risk scoring, correlation engine, API profiler, and schema validation.
```bash
cargo bench --bench risk_scoring --bench correlation --bench profiler_bench --bench schema_bench
```
**Expected duration:** ~10-12 min
**Key metrics:** Risk scoring (~150-960 ns), fingerprint lookup (~73-5,200 ns), schema learning (~1.8-9.6 us)

#### Security Features
Tests bot detection, escalation, CAPTCHA, response scanning, and header profiling.
```bash
cargo bench --bench bot_detection_bench --bench escalation_bench --bench captcha_bench --bench response_scan_bench --bench header_profiler_bench
```
**Expected duration:** ~10-15 min
**Key metrics:** Bot check (~150-1,800 ns), CAPTCHA round-trip (~10 us), cookie generation (~3.9 us)

#### Session & Actor Management
Tests actor lifecycle, session binding, credential stuffing detection, impossible travel.
```bash
cargo bench --bench actor_session_bench --bench subsystems
```
**Expected duration:** ~8-10 min
**Key metrics:** Actor creation (~750 ns), session validation (~300 ns), impossible travel (~700 ns)

#### Operational
Tests multi-threaded contention, config reload, sustained throughput, proxy overhead.
```bash
cargo bench --bench contention --bench reload_bench --bench sustained_bench --bench proxy_overhead_bench --bench goblins
```
**Expected duration:** ~15-20 min (sustained_bench alone uses 60s measurement windows)
**Key metrics:** Config reload (~240 us), entity LRU eviction (~1.2 us), JA4 fingerprint (~4.8 us)

### Individual Benchmarks
```bash
# Run a single suite
cargo bench --bench detection

# Filter to specific benchmarks within a suite
cargo bench --bench detection -- "sqli"
cargo bench --bench contention -- "token_bucket"
cargo bench --bench hot_path_bench -- "sni"

# Only show terminal output (skip HTML report generation)
cargo bench --bench detection -- --quick
```

## Viewing Results

### Terminal Output
Criterion prints results in this format:
```
benchmark_name    time:   [lower_bound  mean  upper_bound]
                  change: [-X%  -Y%  -Z%] (p = 0.XX < 0.05)
                  Performance has improved.
```

- `time`: Statistical estimate [lower CI, point estimate, upper CI]
- `change`: Comparison to previous run (if baseline exists)
- `p-value`: Statistical significance of the change

### HTML Reports
Criterion generates detailed HTML reports with graphs:
```bash
# Reports are saved to the cargo target directory
# (may be ~/.cargo/target/criterion/ if using a workspace-level target dir)
open ~/.cargo/target/criterion/report/index.html

# Or for a specific benchmark
open ~/.cargo/target/criterion/actor_create_lookup/report/index.html
```

Each report includes:
- PDF/CDF plots of measurement distributions
- Violin plots comparing old vs new runs
- Regression analysis and outlier detection
- Iteration time plots showing measurement stability

### Extracting Raw Data
```bash
# Extract all mean estimates from JSON (nanoseconds)
cd ~/.cargo/target/criterion
find . -name "estimates.json" -path "*/new/*" | while read f; do
  dir=$(echo "$f" | sed 's|/new/estimates.json||' | sed 's|^\./||')
  mean=$(python3 -c "import json; d=json.load(open('$f')); print(d['mean']['point_estimate'])")
  echo "$dir|${mean}ns"
done | sort
```

## Validation Checklist

Before accepting benchmark results as authoritative, verify:

### Environment
- [ ] No other CPU-intensive processes running during benchmarks
- [ ] Laptop plugged in (no power throttling)
- [ ] macOS: Disable Spotlight indexing for the project directory
- [ ] No thermal throttling (check activity monitor for CPU frequency drops)

### Build
- [ ] Bench profile active: LTO thin, codegen-units=1, opt-level=3
- [ ] Release mode compilation (cargo bench uses release by default)
- [ ] No debug assertions (`debug_assertions` is off in bench profile)

### Results Quality
- [ ] Outlier count < 10% for most benchmarks
- [ ] Variance < 15% between lower and upper CI bounds
- [ ] No "WARNING: Unable to complete N samples" messages (increase measurement time if seen)
- [ ] Sustained benchmarks (60s) show stable latency without drift

### Correctness Gates
- [ ] Detection benchmarks: Known attacks trigger risk > 0 or blocked status
- [ ] DLP benchmarks: PII patterns (CC, SSN, email) are detected
- [ ] Bot detection: 500+ signature database loaded
- [ ] Domain validation: Homograph attacks rejected (Cyrillic 'a')
- [ ] Schema validation: Type mismatches rejected after min_samples

## Comparing Against Baseline

### Setting a Baseline
```bash
# Run benchmarks and save as baseline
cargo bench --bench detection -- --save-baseline my-baseline

# Later, compare against baseline
cargo bench --bench detection -- --baseline my-baseline
```

### Regression Detection
Changes larger than the noise threshold (default 5%, sustained tests 10%) are flagged:
- `Performance has improved.` — Statistically significant improvement
- `Performance has regressed.` — Statistically significant regression
- `No change in performance detected.` — Within noise threshold

## Performance Targets

| Category | Target | Measured |
|----------|--------|----------|
| Simple GET detection | < 20 us | ~10 us |
| Attack detection (SQLi/XSS) | < 30 us | ~23-30 us |
| Heavy payload (14KB, 20 headers) | < 2 ms | ~1.45 ms |
| Token bucket rate limit | < 100 ns | ~50-70 ns |
| ACL lookup (100 rules) | < 200 ns | ~5-156 ns |
| Full pipeline (clean GET) | < 100 us | ~72 us |
| Risk scoring (single rule) | < 500 ns | ~224 ns |
| Actor creation | < 1 us | ~750 ns |
| Session validation | < 500 ns | ~304 ns |
| Bot check (hit) | < 1 us | ~409 ns |
| DLP scan (8KB, no PII) | < 50 us | ~42 us |
| Config reload | < 500 us | ~240 us |
| Schema validation | < 2 us | ~970 ns |

## Troubleshooting

### Benchmark Fails to Compile
```
error: could not compile `synapse-pingora`
```
**Fix:** Run `cargo test --no-run` first to verify the project compiles, then try `cargo bench --no-run`.

### Very High Variance
```
time: [45.2 ns 89.7 ns 134.2 ns]  # >100% spread
```
**Cause:** CPU frequency scaling, background processes, or thermal throttling.
**Fix:** Close other applications, ensure power is connected, wait for cool-down, re-run.

### "Unable to complete N samples" Warning
**Cause:** Benchmark is too slow for the configured sample size.
**Fix:** This is informational — Criterion adjusts automatically. For very slow benchmarks, this is expected.

### Missing `data/rules.json`
```
panicked at 'Failed to read rules'
```
**Fix:** Ensure you're running from the `apps/synapse-pingora` directory where the data files exist.

### Criterion Reports Not Generated
**Cause:** `--quick` flag skips report generation, or gnuplot not installed.
**Fix:** Run without `--quick` and install gnuplot (optional — Criterion falls back to plotters).

## k6 End-to-End Load Tests

For system-level benchmarks including network I/O and proxy overhead:

### Prerequisites
```bash
# Install k6
brew install k6  # macOS
# or
sudo snap install k6  # Linux
```

### Running
```bash
# Start the proxy
cd apps/synapse-pingora
cargo run --release -- --dev &

# Wait for startup
sleep 3

# Run load test
k6 run benches/k6/scenarios.js      # 100 RPS, 30s
k6 run benches/k6/high_load.js      # 5,000 RPS, 60s
```

### Thresholds
| Test | p95 | p99 | Error Rate |
|------|-----|-----|------------|
| scenarios.js | < 500 ms | — | — |
| high_load.js | < 100 ms | < 200 ms | < 1% |

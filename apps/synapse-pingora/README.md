# Synapse-Pingora PoC

A proof-of-concept integrating the **real Synapse WAF detection engine** (237 production rules) with Cloudflare's [Pingora](https://github.com/cloudflare/pingora) proxy framework. **Pure Rust, no Node.js, no FFI**.

## Performance Headlines (Honest Benchmarks)

| Metric | Result |
|--------|--------|
| **Detection Latency** | **~30-50 μs** |
| Rules loaded | **237** production rules |
| Clean traffic | **~36 μs** average |
| Attack traffic | **~50 μs** average |
| vs Atlas Crew Cloud (~5 ms) | **~100x faster** |

> **Note**: These numbers use the **real libsynapse engine** with 237 production rules,
> not a toy benchmark. The engine includes behavioral tracking, entity risk scoring,
> and the full production rule set.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Client    │────▶│  Synapse Pingora │────▶│   Backend    │
│             │◀────│  (Detection WAF) │◀────│   Server     │
└─────────────┘     └──────────────────┘     └──────────────┘
                            │
                    ┌───────┴────────┐
                    │ Detection Engine│
                    │  • SQLi         │
                    │  • XSS          │
                    │  • Path Traversal│
                    │  • Cmd Injection│
                    └─────────────────┘
```

## Quick Start

```bash
# Build release binary
cargo build --release

# Run (uses default config)
./target/release/synapse-pingora

# Or with config file
cp config.example.yaml config.yaml
./target/release/synapse-pingora

# Run integration tests
./test.sh
```

## Benchmark Results

Actual results on Apple M-series (release build, 1,000 iterations, 237 production rules):

| Benchmark | Time | Notes |
|-----------|------|-------|
| **Clean traffic** | **36 μs** | Majority of production workload |
| **Attack (UNION SELECT)** | **91 μs** | Complex SQLi pattern |
| **Attack (path traversal)** | **31 μs** | Simple pattern match |
| **Mixed attack workload** | **50 μs** | Average across attack types |

### Comparison Table

| Implementation | Detection Latency | Rules | Notes |
|----------------|-------------------|-------|-------|
| **Synapse-Pingora** | **~30-50 μs** | 237 | Pure Rust, real engine |
| libsynapse (NAPI) | ~25 μs | 237 | Node.js + Rust FFI |
| Atlas Crew Cloud | ~5 ms | 237+ | Network RTT included |
| ModSecurity | ~50-500 μs | varies | Depends on ruleset |

### Honest Assessment

The pure Rust implementation performs **comparably** to the Node.js NAPI implementation,
not dramatically faster. The value proposition is:

1. **No Node.js runtime** - Simpler deployment, fewer dependencies
2. **Native Pingora integration** - No FFI overhead between proxy and detection
3. **Thread-local engines** - Each worker has its own engine instance
4. **Zero-copy where possible** - Direct memory access without serialization

## Configuration

Copy `config.example.yaml` to `config.yaml`:

```yaml
# Server settings
server:
  listen: "0.0.0.0:6190"
  workers: 0  # 0 = auto-detect

# Upstream backends (round-robin)
upstreams:
  - host: "127.0.0.1"
    port: 8080
  - host: "127.0.0.1"
    port: 8081

# Rate limiting
rate_limit:
  rps: 10000
  enabled: true

# Logging
logging:
  level: "info"  # trace, debug, info, warn, error
  format: "text"
  access_log: true

# Detection toggles
detection:
  sqli: true
  xss: true
  path_traversal: true
  command_injection: true
  action: "block"  # block, log, challenge
  block_status: 403
```

## Pingora Hooks Used

| Hook | Purpose |
|------|---------|
| `early_request_filter` | Rate limiting (pre-TLS) |
| `request_filter` | Attack detection (main filter) |
| `request_body_filter` | Body inspection stub (DLP future) |
| `upstream_peer` | Round-robin backend selection |
| `upstream_request_filter` | Add `X-Synapse-*` headers |
| `logging` | Access logs with timing |

## Integration Tests

Run the test script to verify everything works:

```bash
# With proxy already running
./test.sh

# Or start proxy, run tests, stop proxy
./test.sh --start
```

Sample output:
```
============================================
  Synapse-Pingora Integration Tests
============================================

[INFO] Testing clean requests (should PASS)...
[PASS] Simple GET / (502 - allowed)
[PASS] API endpoint (502 - allowed)
...

[INFO] Testing SQL injection (should BLOCK)...
[PASS] SQLi: OR condition (403) - 2ms
[PASS] SQLi: UNION SELECT (403) - 1ms
...

============================================
  Results: 23/23 passed
============================================

All tests passed!
```

## Graceful Reload

Pingora supports zero-downtime graceful reload:

```bash
# Graceful restart (old workers finish current requests)
pkill -SIGQUIT synapse-pingora && ./target/release/synapse-pingora -u

# The -u flag tells Pingora to take over from the previous instance
```

How it works:
1. `SIGQUIT` tells Pingora to stop accepting new connections
2. Existing requests are allowed to complete
3. New instance starts with `-u` (upgrade) flag
4. Socket is passed from old to new process
5. Old process exits when all requests are done

## Building

```bash
# Development build
cargo build

# Release build (optimized)
cargo build --release

# With full optimizations (LTO + native CPU)
RUSTFLAGS="-C target-cpu=native" cargo build --release

# Run tests
cargo test

# Run benchmarks
cargo bench
```

## Example Usage

### Clean Request (Allowed)
```bash
curl -v http://localhost:6190/api/users/123
# → Proxied to backend
# → X-Synapse-Analyzed: true
# → X-Synapse-Detection-Time-Us: 1
```

### SQL Injection (Blocked)
```bash
curl -v "http://localhost:6190/api/users?id=1'+OR+'1'%3D'1"
# → HTTP 403 Forbidden
# → {"error": "blocked", "reason": "sqli"}
```

### XSS (Blocked)
```bash
curl -v "http://localhost:6190/search?q=%3Cscript%3Ealert(1)%3C/script%3E"
# → HTTP 403 Forbidden
# → {"error": "blocked", "reason": "xss"}
```

### POST with Body
```bash
curl -v -X POST -d '{"user":"test"}' http://localhost:6190/api/users
# Body size logged: "Request body complete: 15 bytes"
```

## Upstream Headers

The proxy adds these headers to upstream requests:

| Header | Description |
|--------|-------------|
| `X-Synapse-Analyzed` | Always "true" |
| `X-Synapse-Detection-Time-Us` | Detection time in microseconds |
| `X-Synapse-Client-IP` | Client IP (from X-Forwarded-For or connection) |

## Detection Engine

This PoC uses the **real libsynapse engine** from `../risk-server/libsynapse/`, which includes:

- **237 production rules** covering SQLi, XSS, path traversal, command injection, and more
- **Behavioral tracking** - Entity risk accumulates across requests from the same IP
- **Risk scoring** - Graduated risk levels (0-100) with configurable blocking thresholds
- **Rule chaining** - Multiple rules can match and contribute to overall risk

### Verified Detections

Tested and verified to block:
- `UNION SELECT` SQLi attacks (rule 200200)
- Path traversal attempts (rules 200014, 200016)
- Various other attack patterns from the production rule set

### Rules Loading

Rules are loaded at startup from (in order of preference):
1. `../risk-server/libsynapse/rules.json` (production rules)
2. `rules.json` (local override)
3. `/etc/synapse-pingora/rules.json` (system-wide)
4. `src/minimal_rules.json` (fallback with 7 basic patterns)

## Performance Optimizations

1. **Thread-local engines**: Each Pingora worker has its own Synapse instance
2. **Lazy rule loading**: Rules parsed once at startup via `once_cell::Lazy`
3. **Zero-copy headers**: Header references passed directly to engine
4. **LTO**: Link-time optimization in release builds (profile: fat LTO, 1 codegen unit)
5. **Native CPU**: Build with `RUSTFLAGS="-C target-cpu=native"` for best performance

## Future Work (Not in This PoC)

- [x] Full detection rule parity with libsynapse (DONE - using real engine)
- [ ] Signal Horizon telemetry integration
- [ ] DLP scanning in `request_body_filter`
- [ ] TLS configuration
- [ ] Health check endpoint
- [ ] Metrics endpoint (Prometheus)
- [ ] Production hardening
- [ ] Request body inspection (POST/PUT payloads)

## Files

```
synapse-pingora/
├── Cargo.toml           # Dependencies (includes libsynapse)
├── config.example.yaml  # Example configuration
├── test.sh              # Integration test script
├── README.md            # This file
├── src/
│   ├── main.rs          # Full implementation with real engine
│   └── minimal_rules.json  # Fallback rules (7 patterns)
└── benches/
    └── detection.rs     # Criterion benchmarks
```

## License

Apache 2.0 (same as Pingora)

## See Also

- [Pingora GitHub](https://github.com/cloudflare/pingora)
- [Pingora Documentation](https://docs.rs/pingora)
- [libsynapse](../risk-server/libsynapse/) - Full Synapse engine

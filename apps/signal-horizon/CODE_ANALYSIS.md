# Bug Hunting: Signal Horizon + Synapse Integration

## Code Analysis

### 18. Rust (synapse-pingora)

Run:
```bash
cargo clippy -- -W clippy::all -W clippy::pedantic
cargo audit
```

Look for:
- `unwrap()` on network/IO operations — should be `?` or handled
- `panic!` in request path — crashes whole proxy
- `clone()` in hot path — unnecessary allocation
- Missing error propagation — silent failures
- Unbounded `Vec` or `HashMap` growth — memory DoS
- `unsafe` blocks — justify each one
- Mutex held across await — deadlock potential
- Race conditions in entity store updates

Specific files to audit:
- `src/main.rs` — request handling path
- `src/entity/store.rs` — concurrent access patterns
- `src/fingerprint/ja4.rs` — parsing untrusted input
- `src/telemetry.rs` — circuit breaker logic

### 19. TypeScript (risk-server, Signal Horizon)

Run:
```bash
npm run lint
npm run typecheck
npx tsc --noEmit --strict
```

Look for:
- `any` types — type safety holes
- Missing null checks — `Cannot read property of undefined`
- Unhandled promise rejections — silent failures
- `catch` blocks that swallow errors — `catch (e) {}`
- SQL/NoSQL injection — string concatenation in queries
- Missing input validation on API endpoints
- `JSON.parse` without try/catch — crashes on bad input
- Hardcoded secrets or API keys

Specific areas:
- `src/proxy-handler.ts` — upstream error handling
- `src/middleware.ts` — schema validation edge cases
- `src/horizon/client.ts` — WebSocket error handling
- `src/geo/geoip-service.ts` — external service failure

### 20. Dependency Audit

Run:
```bash
# Rust
cargo audit
cargo outdated

# Node
npm audit
npx npm-check-updates
```

Look for:
- Known CVEs in dependencies
- Outdated deps with security fixes
- Yanked crate versions
- Deprecated packages

### 21. Test Coverage Gaps

Run:
```bash
# Rust
cargo tarpaulin --out Html

# Node
npm run test -- --coverage
```

Look for:
- Error paths not tested
- Edge cases in parsing (empty, huge, unicode, null bytes)
- Timeout/retry logic untested
- Integration between components untested

Priority coverage gaps:
- Entity risk calculation
- Blocklist sync
- Profile persistence
- WebSocket reconnection
- DLP pattern matching

### 22. Concurrency Issues

Rust specific:
- `Arc<Mutex<>>` vs `Arc<RwLock<>>` — read-heavy should be RwLock
- Mutex lock ordering — consistent across codebase?
- Async mutex held across yield points
- Entity store concurrent updates — any lost writes?

Node specific:
- Event loop blocking — any sync file/network calls?
- Race conditions in async handlers
- Shared state mutations without locks

### 23. Error Handling Patterns

Grep for:
```bash
# Rust - panics in prod code
rg "unwrap\(\)" --type rust
rg "expect\(" --type rust
rg "panic!" --type rust

# Rust - silent error drops
rg "let _ =" --type rust
rg "\.ok\(\)" --type rust

# Node - swallowed errors
rg "catch.*\{\s*\}" --type ts
rg "catch \(e\) \{\}" --type ts

# Node - any types
rg ": any" --type ts
rg "as any" --type ts
```

Each result is a potential bug or crash waiting to happen.

## Tools

- Network tab in browser for API calls
- wscat or similar for WebSocket testing
- Kill Signal Horizon process directly
- Flood with synthetic telemetry from curl/script
- Check logs on both sides during tests

## Report Format

For each bug found:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Severity (Critical / High / Medium / Low)
5. Screenshots/logs if applicable

Have fun breaking it.

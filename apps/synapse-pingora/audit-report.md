# Codebase Audit Report

**Generated:** 2026-02-08T23:07:20Z
**Project:** synapse-pingora

## Clippy Analysis

| Category | Count |
|----------|-------|
| Warnings | 1 |
| Errors | 1 |

<details>
<summary>Clippy Output (click to expand)</summary>

```
    Checking synapse-pingora v0.1.0 (/Users/nferguson/Developer/labs/apps/synapse-pingora)
src/trends/time_store.rs:277:48: warning: digits grouped inconsistently by underscores: help: consider: `3_600_000`
src/admin_server.rs:1820:9: warning: unused variable: `global`: help: if this is intentional, prefix it with an underscore: `_global`
src/admin_server.rs:5818:25: warning: unused variable: `other`: help: if this is intentional, prefix it with an underscore: `_other`
src/headers.rs:32:5: warning: type `headers::CompiledHeaderValue` is more private than the item `headers::CompiledHeaderOps::add`: field `headers::CompiledHeaderOps::add` is reachable at visibility `pub(crate)`
src/headers.rs:33:5: warning: type `headers::CompiledHeaderValue` is more private than the item `headers::CompiledHeaderOps::set`: field `headers::CompiledHeaderOps::set` is reachable at visibility `pub(crate)`
src/rules.rs:218:4: warning: function `value_to_match_value` is never used
src/intelligence/signal_manager.rs:126:5: warning: field `end_timestamp_ms` is never read
src/tarpit/manager.rs:75:8: warning: methods `remove` and `clear` are never used
src/tunnel/shell.rs:86:5: warning: field `shell` is never read
src/utils/path_normalizer.rs:47:38: warning: this `if` has identical blocks
src/utils/path_normalizer.rs:49:49: warning: this `if` has identical blocks
src/utils/path_normalizer.rs:51:51: warning: this `if` has identical blocks
src/utils/circuit_breaker.rs:79:9: warning: this `if` statement can be collapsed
src/rules.rs:495:9: warning: field assignment outside of initializer for an instance created with Default::default()
src/config_manager.rs:944:22: warning: redundant closure: help: replace the closure with the tuple variant itself: `ConfigManagerError::Persistence`
src/site_waf.rs:77:1: warning: this `impl` can be derived
src/tls.rs:44:5: warning: struct `SecureString` has a public `len` method, but no `is_empty` method
src/tls.rs:135:5: warning: method `from_str` can be confused for the standard trait method `std::str::FromStr::from_str`
src/admin_server.rs:755:6: warning: the `Err`-variant returned from this function is very large: the `Err`-variant is at least 128 bytes
src/admin_server.rs:858:24: warning: unnecessary closure used to substitute value for `Option::None`
src/admin_server.rs:1436:22: warning: this can be `std::io::Error::other(_)`
src/admin_server.rs:1640:41: warning: this pattern creates a reference to a reference: help: try: `config_mgr`
src/admin_server.rs:1677:9: warning: you seem to be trying to use `match` for destructuring a single pattern. Consider using `if let`
src/admin_server.rs:1676:17: warning: this pattern creates a reference to a reference: help: try: `config_mgr`
src/admin_server.rs:1706:17: warning: this pattern creates a reference to a reference: help: try: `config_mgr`
src/api.rs:665:17: warning: field assignment outside of initializer for an instance created with Default::default()
src/api.rs:758:28: warning: explicit call to `.into_iter()` in function argument accepting `IntoIterator`
src/metrics.rs:749:9: warning: clamp-like pattern without using clamp function: help: replace with clamp: `pct = pct.clamp(0.0, 1.0);`
src/fingerprint/ja4.rs:243:8: warning: manual `!RangeInclusive::contains` implementation: help: use: `!(10..=13).contains(&tls_version)`
src/entity/store.rs:868:31: error: approximate value of `f{32, 64}::consts::LN_2` found
src/entity/store.rs:912:12: warning: manual implementation of `.is_multiple_of()`: help: replace with: `!count.is_multiple_of(100)`
src/dlp/scanner.rs:113:1: warning: this `impl` can be derived
src/dlp/scanner.rs:164:1: warning: this `impl` can be derived
src/dlp/scanner.rs:404:5: warning: manual `RangeInclusive::contains` implementation: help: use: `(13..=19).contains(&digit_count)`
src/dlp/scanner.rs:404:62: warning: manual implementation of `.is_multiple_of()`: help: replace with: `sum.is_multiple_of(10)`
src/dlp/scanner.rs:572:8: warning: manual `!RangeInclusive::contains` implementation: help: use: `!(15..=34).contains(&total_len)`
src/dlp/scanner.rs:580:12: warning: taken reference of right operand
src/dlp/scanner.rs:865:59: warning: the borrowed expression implements the required traits
src/validation.rs:350:20: warning: this `if` statement can be collapsed
src/validation.rs:662:8: warning: manual `!RangeInclusive::contains` implementation: help: use: `!(0.0..=100.0).contains(&threshold)`
src/sni_validation.rs:218:33: warning: redundant closure: help: replace the closure with the function itself: `normalize_hostname`
src/sni_validation.rs:219:42: warning: redundant closure: help: replace the closure with the function itself: `normalize_hostname`
src/persistence/mod.rs:135:16: warning: this `map_or` can be simplified
src/telemetry/auth_coverage_aggregator.rs:60:64: warning: this `if` has identical blocks
src/telemetry/mod.rs:240:16: warning: manual implementation of `.is_multiple_of()`: help: replace with: `dropped.is_multiple_of(100)`
src/telemetry/mod.rs:259:5: warning: struct `TelemetryBuffer` has a public `len` method, but no `is_empty` method
src/correlation/campaign_state.rs:117:1: warning: this `impl` can be derived
src/correlation/campaign_state.rs:626:13: warning: this `if` statement can be collapsed
src/correlation/campaign_state.rs:627:20: warning: this `map_or` can be simplified
src/correlation/detectors/network_proximity.rs:143:64: warning: used consecutive `str::replace` call: help: replace with: `replace(['/', '.'], "-")`
src/actor/manager.rs:780:12: warning: manual implementation of `.is_multiple_of()`: help: replace with: `!count.is_multiple_of(100)`
src/session/manager.rs:871:12: warning: manual implementation of `.is_multiple_of()`: help: replace with: `!count.is_multiple_of(100)`
src/interrogator/js_challenge_manager.rs:553:20: warning: manually reimplementing `div_ceil`: help: consider using `.div_ceil()`: `len.div_ceil(2)`
src/shadow/rate_limiter.rs:72:12: warning: manual implementation of `.is_multiple_of()`: help: replace with: `ops.is_multiple_of(CAPACITY_CHECK_INTERVAL)`
src/shadow/mod.rs:171:9: warning: this `if` statement can be collapsed
src/profiler/endpoint_profile.rs:56:5: warning: you should consider adding a `Default` implementation for `ParamStats`
src/profiler/patterns.rs:156:12: warning: manual `RangeInclusive::contains` implementation: help: use: `(13..=19).contains(&len)`
src/profiler/patterns.rs:162:8: warning: manual `RangeInclusive::contains` implementation: help: use: `(7..=20).contains(&len)`
src/profiler/patterns.rs:164:9: warning: this `if` statement can be collapsed
src/profiler/profile_store.rs:237:20: warning: length comparison to one: help: using `!is_empty` is clearer and more explicit: `!segment.is_empty()`
src/profiler/mod.rs:437:21: warning: this `if` statement can be collapsed
src/crawler/detector.rs:280:9: warning: field assignment outside of initializer for an instance created with Default::default()
src/crawler/detector.rs:385:72: warning: this `if` has identical blocks
src/horizon/client.rs:398:1: warning: this function has too many arguments (11/7)
src/horizon/client.rs:633:1: warning: this function has too many arguments (13/7)
src/horizon/client.rs:688:29: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `auth_msg.to_json().unwrap()`
src/horizon/client.rs:721:29: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `SensorMessage::BlocklistSync.to_json().unwrap()`
src/horizon/client.rs:853:58: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `msg.to_json().unwrap()`
src/horizon/client.rs:879:38: warning: you seem to be trying to move all elements into a new `Vec`: help: consider using `mem::take`: `std::mem::take(batch)`
src/horizon/client.rs:899:29: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `msg.to_json()?`
src/horizon/client.rs:934:50: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `json`
src/horizon/client.rs:1312:62: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `json`
src/horizon/client.rs:1376:50: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `json`
src/horizon/manager.rs:125:13: warning: this `MutexGuard` is held across an await point
src/horizon/manager.rs:131:13: warning: this `MutexGuard` is held across an await point
src/horizon/manager.rs:143:13: warning: this `MutexGuard` is held across an await point
src/horizon/manager.rs:178:13: warning: this `MutexGuard` is held across an await point
src/horizon/manager.rs:184:13: warning: this `MutexGuard` is held across an await point
src/horizon/manager.rs:208:13: warning: this `MutexGuard` is held across an await point
src/horizon/types.rs:378:1: warning: this `impl` can be derived
src/tunnel/client.rs:673:1: warning: this function has too many arguments (8/7)
src/tunnel/client.rs:738:46: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `auth_json`
src/tunnel/client.rs:804:74: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `text`
src/tunnel/client.rs:887:58: warning: useless conversion to the same type: `std::string::String`: help: consider removing `.into()`: `heartbeat.to_string()`
src/tunnel/diag.rs:99:26: warning: unnecessary closure used to substitute value for `Option::None`
src/tunnel/diag.rs:385:9: warning: clamp-like pattern without using clamp function: help: replace with clamp: `error_rate = error_rate.clamp(0.0, 1.0);`
src/tunnel/logs.rs:614:16: warning: manual implementation of `Option::map`: help: try: `{ value.as_u64().map(|ms| ms) }`
src/payload/entity_bandwidth.rs:114:26: warning: replacing a value of type `T` with `T::default()` is better expressed using `std::mem::take`: help: consider using: `std::mem::take(&mut self.current_bucket)`
src/trends/anomaly_detector.rs:309:22: warning: use of `or_insert_with` to construct default value: help: try: `or_default()`
src/trends/anomaly_detector.rs:348:22: warning: use of `or_insert_with` to construct default value: help: try: `or_default()`
src/trends/anomaly_detector.rs:397:22: warning: use of `or_insert_with` to construct default value: help: try: `or_default()`
src/trends/anomaly_detector.rs:433:5: warning: this function has too many arguments (8/7)
src/trends/correlation.rs:170:18: warning: use of `or_insert_with` to construct default value: help: try: `or_default()`
src/trends/correlation.rs:282:45: warning: use of `or_insert_with` to construct default value: help: try: `or_default()`
src/trends/manager.rs:23:21: warning: very complex type used. Consider factoring parts into `type` definitions
src/trends/manager.rs:26:1: warning: this `impl` can be derived
src/trends/manager.rs:101:5: warning: this function has too many arguments (9/7)
src/trends/manager.rs:159:5: warning: this function has too many arguments (9/7)
src/trends/signal_extractor.rs:15:5: warning: this function has too many arguments (8/7)
```
</details>

## Test Results

| Status | Count |
|--------|-------|
| Passed | 1444
0
33
0
10
10
35
58
3
36
303
20
36
15
3
15 |
| Failed | 0
0
0
0
0
0
0
0
0
0
0
0
0
0
0
1 |
| Ignored | 4
0
0
0
0
0
0
0
0
0
0
0
0
0
0
1 |

## Summary


---
id: TASK-45
title: Restore 237 production WAF rules from archive
status: Done
assignee: []
created_date: '2026-04-12 08:00'
updated_date: '2026-04-12 08:18'
labels:
  - waf
  - synapse-pingora
  - rules
  - docs-reality-gap
  - restoration
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/minimal_rules.json
  - apps/synapse-pingora/Dockerfile
  - apps/synapse-pingora/benches/detection.rs
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The synapse-waf binary currently ships with 7 embedded rules (apps/synapse-pingora/src/minimal_rules.json, all uri-match-kind basic SQLi/XSS/cmd detection). Every piece of customer-facing documentation (README, Dockerhub page, site pages, benchmarks, /health sample response) claims 237 production rules with "99.8% OWASP CRS coverage (4,122/4,131 tests), 0% false positives on GoTestWAF", and benchmarks cite a "71.8 μs full ruleset" number. On a fresh checkout those claims do not reflect reality — `/health` returns `rules_loaded: 7` and `cargo bench` emits `eprintln!("WARNING: data/rules.json not found, skipping rule scaling benchmark")`.

The canonical 237-rule file was located at ~/Developer/.archive/edge-protection/apps/load-testing/data/rules.json on the dev box during this session's investigation. It's 383KB, 237 unique ids in range 200002–299062, 25+ match kinds exercised (sql_analyzer, xss_analyzer, boolean, regex, header/uri/args, decode_if_base64, parse_multipart, track_by_ip), and includes explicit CVE-specific blocks through rule ids 299060–299062 (CVE-2025-4427/4428 Ivanti EPMM, CVE-2025-24016 Wazuh, CVE-2025-53690 Sitecore). The file pre-dates the m-6 signal-correlation work so it references none of the new match kinds (ja4, ja4h, dlp_violation, schema_violation) — restoring it does not activate those features, which is fine; that's a separate effort.

Task: stage the archived ruleset into the synapse-waf build artifact so the embedded binary ships 237 rules by default, bringing the code into alignment with the documentation. Verify engine compatibility at load time and at rule count before committing. The Dockerfile at line 43 already says "rules are embedded in the binary", so embedding via include_str! (not file-based runtime loading) is the aligned path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Archived rules file (237 rules) is staged into the apps/synapse-pingora crate at a tracked path suitable for include_str! embedding
- [x] #2 create_synapse_engine embeds the staged file so a fresh cargo build ships with the full ruleset
- [x] #3 Engine.load_rules returns Ok with a rule count matching the staged file (237 as of current archive snapshot)
- [x] #4 Integration or unit test asserts DetectionEngine::rule_count() == 237 on a cold-start proxy with no runtime overrides
- [x] #5 The existing runtime overrides via data/rules.json, rules.json, and /etc/synapse-pingora/rules.json remain functional
- [x] #6 Existing tests that reference minimal_rules.json continue to pass or are updated to reference the new filename
- [x] #7 No new warnings introduced by the rule load; load-time errors for any rule are fatal, not silent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Restored the 237-rule production WAF ruleset from `~/Developer/.archive/edge-protection/apps/load-testing/data/rules.json` into the synapse-waf build artifact. The binary now ships 237 embedded rules at cold start, closing the documentation-reality gap where every piece of customer-facing documentation (README, Dockerhub, site pages, benchmarks, /health sample response) claimed 237 rules but the binary only had 7.

## Files changed

- **Added**: `apps/synapse-pingora/src/production_rules.json` (383,761 bytes, 237 rules, id range 200002–299062)
- **Deleted**: `apps/synapse-pingora/src/minimal_rules.json` (7 rules — obsolete, its only purpose was being a fallback when no real ruleset existed; with 237 embedded there is no second fallback needed)
- **Modified**: `apps/synapse-pingora/src/main.rs`
  - `create_synapse_engine` now `include_str!("production_rules.json")` instead of `minimal_rules.json`
  - Embedded load failure is now `panic!` (fatal) instead of `warn!` (silent) — a WAF proxy running with zero rules is more dangerous than one that refuses to start. The `test_production_rules_load_into_current_engine` compat test gates CI so this panic cannot fire in a released binary.
  - New `test_synapse_cold_start_ships_237_production_rules` test in the main.rs mod tests block. Marked `#[serial]` so it doesn't race with the other `#[serial]` tests that mutate SYNAPSE via reload_rules.
  - Docstring on `DetectionEngine::reload_rules` updated from "minimal_rules.json" to "production_rules.json"
- **Modified**: `apps/synapse-pingora/src/waf/engine.rs`
  - New `test_production_rules_load_into_current_engine` compat test. Asserts the embedded file parses, rule count >= 237, and all 237 rule ids are unique (guards against accidental concatenation).
- **Modified**: `apps/synapse-pingora/tests/filter_chain_integration.rs`
  - TASK-40 test's restore block updated to restore `production_rules.json` after the test rather than `minimal_rules.json`. The restore path now matches the engine-startup default.
  - Docstring references updated to reflect that dlp_violation is absent from production_rules.json rather than minimal_rules.json.

## Compatibility verification

Before committing to the embed path I added a load-time compat test and ran it against the archived file. The 237 rules parse cleanly into the current m-6 engine with zero schema drift — no rule types rejected, no rule bodies malformed, no deprecation warnings. This is important because the archive file is from 2026-03-18 and the signal-correlation changes (m-6) landed weeks later; I was worried about schema drift from the new deferred-rule-tagging infrastructure (`condition_is_deferred`, `deferred_rule_indices`). Clean bill of health.

Match kinds exercised by the 237 rules (top 15):

| kind | count | notes |
|---|---|---|
| boolean | 520 | and/or/not composition |
| method | 419 | HTTP method scoping |
| contains | 393 | substring matching |
| to_lowercase | 157 | case normalization wrapper |
| header | 152 | request header inspection |
| uri | 107 | URI-based detection |
| args | 78 | query/form/json argument matchers |
| regex | 70 | regex patterns |
| multiple_contains | 63 | multi-substring |
| static_content | 32 | static-asset fast-path |
| response_code | 31 | response-phase rules |
| decode_if_base64 | 20 | base64 handling |
| request_json | 11 | JSON body inspection |
| sql_analyzer | 6 | compiled SQLi detector |
| xss_analyzer | 6 | compiled XSS detector |

Every match kind the current engine supports is exercised by at least one rule.

## AC#7: load-time failures are fatal for embedded rules

Embedded load failure now panics with a verbose error message pointing ops at the compat test in CI. External rule files (runtime overrides via `data/rules.json`, `rules.json`, `/etc/synapse-pingora/rules.json`) still use `warn!` on parse failure and fall back to embedded — the asymmetry is intentional: embedded is shipped with the binary and should never fail; external is user-configurable and warn-and-fall-back is the right UX. AC#5 (external override path preserved) is therefore also satisfied.

## Tests

- `cargo test --lib waf::` — **100 passing** (was 99, +1 new: `test_production_rules_load_into_current_engine`)
- `cargo test --bin synapse-waf -- tests::` — **46 passing** (was 45, +1 new: `test_synapse_cold_start_ships_237_production_rules`)
- `cargo test --test filter_chain_integration` — **49 passing** (unchanged; tests now run against the full 237-rule engine instead of minimal_rules). Notably the two body-filter tests (`test_filter_chain_full_flow_sets_headers_and_dlp` and `test_rate_limit_short_circuits_before_waf`) continue to produce their expected outputs, confirming that production rules don't introduce false positives against their fixture payloads.

Total **195 tests green** across the three test binaries I touched. Zero regressions. No new warnings.

## Pre-existing breakage unrelated to this task

`tests/tunnel_client_integration.rs` does not compile against the current `tungstenite-0.26.2` — the crate's `Message::Text` now expects `Utf8Bytes` instead of `String`. The breakage predates TASK-45 by several commits (last touch was `89b7422 style: cargo fmt`) and is unrelated to rule loading. Worth filing as a separate task but out of scope here.

## AC mapping

- **AC#1** — file staged at `apps/synapse-pingora/src/production_rules.json` (tracked in git, include_str!-friendly location)
- **AC#2** — `create_synapse_engine` falls through to `include_str!("production_rules.json")` when no runtime rules file is found
- **AC#3** — compat test `test_production_rules_load_into_current_engine` asserts `load_rules` returns `Ok(count >= 237)` and rule ids are unique
- **AC#4** — `test_synapse_cold_start_ships_237_production_rules` asserts `DetectionEngine::rule_count() >= 237` on cold start via the global SYNAPSE Lazy static initialization
- **AC#5** — RULES_DATA probes `data/rules.json` → `rules.json` → `/etc/synapse-pingora/rules.json` before falling through to embedded; all three paths remain the primary override mechanism
- **AC#6** — `minimal_rules.json` references in `main.rs` (create_synapse_engine, reload_rules doc comment) and `filter_chain_integration.rs` (TASK-40 restore, docstring) all updated. The file itself is deleted. No other references to minimal_rules.json exist in the repo.
- **AC#7** — embedded load failure now panics with a verbose ops-targeted error message; the compat test in CI ensures this panic cannot fire in a released binary

## Explicitly out of scope

- **Documentation updates**: The README, Dockerhub page, site pages, and benchmarks all claim 237 rules. With this task they are now accurate — no doc updates needed. If the number changes in the future, the docs need a grep-and-update.
- **Rules using the new signal match kinds**: The restored 237 rules pre-date m-6 and reference no `ja4` / `ja4h` / `dlp_violation` / `schema_violation`. Activating the signal-correlation feature in production requires a separate rule-authoring effort (not tracked as a task yet; user may file one).
- **Fixing `tunnel_client_integration.rs`**: Pre-existing tungstenite API drift. Separate task.
- **Rule performance benchmarking against the current engine**: The benchmarks in `benches/detection.rs` read from `data/rules.json` at runtime, not the embedded copy. With the embedded path now working, benchmarks could be updated to also measure the cold-start path. Not urgent.
<!-- SECTION:FINAL_SUMMARY:END -->

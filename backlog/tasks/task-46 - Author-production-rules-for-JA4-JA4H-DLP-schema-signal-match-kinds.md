---
id: TASK-46
title: Author production rules for JA4/JA4H/DLP/schema signal match kinds
status: Done
assignee: []
created_date: '2026-04-12 19:20'
updated_date: '2026-04-12 19:28'
labels:
  - waf
  - synapse-pingora
  - rules
  - signal-correlation
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/production_rules.json
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/waf/engine.rs
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The m-6 signal-correlation work (TASK-32 through TASK-41) added four new match kinds to the WAF engine: `ja4`, `ja4h`, `dlp_violation`, and `schema_violation`. The plumbing is production-ready and tested end-to-end (telemetry, deferred pass, response body, NOT-gate handling, schema-learner poisoning prevention, runtime 403 classification). TASK-45 restored 237 production rules from archive.

However, the restored 237 rules pre-date the m-6 work and reference NONE of the new match kinds. The signal-correlation feature therefore has no rules exercising it — the infrastructure is live but dormant. To give the feature production teeth, someone needs to author rules that actually use these match kinds.

Task: add a small, high-confidence set of rules using the new match kinds. Prioritize rules that have obvious production value and low false-positive risk. Ship them as part of the embedded production_rules.json so they load at cold start alongside the existing 237. Each new rule needs a targeted test asserting it fires on its intended trigger.

Rule design priorities (ordered):

1. **DLP exfiltration blocks** (highest ROI, lowest FP risk): credentials and high-volume PII in request bodies are definitively wrong. API keys, AWS keys, private keys, JWTs, and mass credit-card/SSN dumps in POST bodies never belong there.
2. **Schema violation drift**: warning-level score thresholds to surface API-shape anomalies without blocking, plus a high-threshold block for severe deviations.
3. **JA4 deprecated TLS versions**: TLS 1.0/1.1 clients in 2026 are rare and suspicious. Non-blocking risk contribution is safer than a hard block.
4. **JA4H-specific rules are out of scope for this task** — ja4h-based detection needs a curated fingerprint list to be production-safe, and authoring that list is a separate research effort.

The existing ruleset uses id range 200002–299062 with 29xxxx heavily populated by CVE-specific blocks. New rules should use a reserved range that is clearly namespaced and does not collide.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At least 8 new rules are added to production_rules.json using the ja4, dlp_violation, and schema_violation match kinds
- [x] #2 All new rule ids fall in a reserved namespace that does not collide with the existing 237 rules (200002-299062)
- [x] #3 Each new rule has a targeted unit or integration test asserting it fires on its intended trigger (positive case) AND does not fire on a benign baseline (negative case)
- [x] #4 DLP rules block credential leakage (api_key, aws_key, private_key, jwt) and mass PII disclosure (credit_card, ssn) in request bodies
- [x] #5 Schema rules provide both a warning-level and a blocking-level threshold
- [x] #6 JA4 rules target deprecated TLS versions (TLS 1.0 / 1.1) with non-blocking risk contribution, not a hard block
- [x] #7 JA4H rules are explicitly NOT added in this task and the rationale is documented for the future rule-authoring effort
- [x] #8 test_production_rules_load_into_current_engine continues to pass with the updated rule count
- [x] #9 test_synapse_cold_start_ships_237_production_rules is updated or loosened to reflect the new count floor
- [x] #10 All new rules load cleanly into the current engine with zero parse errors and no new cargo warnings
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Authored 11 new WAF rules using the m-6 signal-correlation match kinds (`ja4`, `dlp_violation`, `schema_violation`) and appended them to `apps/synapse-pingora/src/production_rules.json`. The embedded binary now ships **248 rules** (237 from TASK-45 + 11 from TASK-46) and activates the signal-correlation feature that was previously dormant.

## Rule inventory (220000-block reserved for signal-correlation)

### DLP exfiltration (220001-220007)

All deferred — evaluated in `upstream_request_filter` after the async DLP scan completes.

| ID | Description | Risk | Blocking | Trigger |
|---|---|---|---|---|
| 220001 | Mass DLP leak (any type) | 90 | ✓ | `dlp_violation >= 5` |
| 220002 | API key in body | 85 | ✓ | `dlp_violation field=api_key >= 1` |
| 220003 | AWS credential in body | 95 | ✓ | `dlp_violation field=aws_key >= 1` |
| 220004 | Private key in body | 95 | ✓ | `dlp_violation field=private_key >= 1` |
| 220005 | JWT in body (misuse — JWTs belong in Authorization header) | 70 | ✓ | `dlp_violation field=jwt >= 1` |
| 220006 | Mass SSN disclosure | 80 | ✓ | `dlp_violation field=ssn >= 3` |
| 220007 | Mass credit card disclosure | 80 | ✓ | `dlp_violation field=credit_card >= 3` |

### Schema violation (220010-220011)

Body-phase — fire via `schema_violation` match kind against `SCHEMA_LEARNER`'s learned baseline.

| ID | Description | Risk | Blocking | Trigger |
|---|---|---|---|---|
| 220010 | Schema drift warning (observability) | 15 | — | `schema_violation >= 10` |
| 220011 | Severe schema deviation | 60 | ✓ | `schema_violation >= 25` |

The warning-level rule is the only non-blocking schema rule in the 220000 block — it contributes risk for observability without acting. Rule 220011 catches obvious API-shape attacks.

### JA4 deprecated TLS (220020-220021)

Non-blocking risk contribution only. TLS 1.0 and TLS 1.1 clients in 2026 are rare but not universally malicious (some legacy IoT/partner integrations still exist); a hard block would false-positive on them, but a risk bump surfaces the signal.

| ID | Description | Risk | Blocking | Trigger |
|---|---|---|---|---|
| 220020 | TLS 1.0 client (deprecated) | 10 | — | `ja4` contains `"t10"` |
| 220021 | TLS 1.1 client (deprecated) | 10 | — | `ja4` contains `"t11"` |

## Explicitly out of scope (AC#7)

**JA4H-specific rules are NOT added in this task.** JA4H detection needs a curated fingerprint list of known-bad HTTP client signatures (curl, wget, common scanners, headless browsers) to be production-safe. Authoring that list requires either an external threat-intel feed or empirical traffic analysis, neither of which is in scope for a pure rule-authoring task. JA4H detection should be picked up as a separate research effort once there's a source of reliable fingerprints.

## ID namespace

Reserved the 220000 block for signal-correlation rules. The existing 237 rules cluster in six 1000-blocks (200xxx, 210xxx, 250xxx, 280xxx, 290xxx, 299xxx) with all other blocks in the 200000-299999 range empty. 220xxx is clearly namespaced, unused, and easy to grep for. Future signal-correlation rule additions should grow within this block (220022+ for JA4, 220012+ for schema, 220008+ for DLP) before spilling into a new block.

## Tests (3 new)

Added three table-driven tests in `apps/synapse-pingora/src/waf/engine.rs`, each loading the full `production_rules.json` into a local `Engine` and exercising one match kind:

1. **`test_signal_correlation_dlp_rules_fire_on_intended_triggers`** — 7 positive cases (one per DLP rule 220001-220007) plus a benign baseline (single email match fires no credential/PII rule). Uses `analyze_deferred_with_timeout` because DLP rules are tagged deferred. Includes a boundary check (3 SSNs fire 220006 but NOT 220001 which needs 5).

2. **`test_signal_correlation_schema_rules_fire_on_intended_triggers`** — three score cases (30 above both thresholds → both rules fire + block; 15 between thresholds → only 220010 fires, non-blocking; 5 below both → neither fires) plus a no-schema_result baseline. Exercises both the blocking-threshold gate and the warning-level observability path.

3. **`test_signal_correlation_ja4_rules_fire_on_deprecated_tls`** — positive cases for TLS 1.0 (`t10` prefix → 220020 fires) and TLS 1.1 (`t11` prefix → 220021 fires), plus a modern TLS 1.3 baseline (`t13` prefix → neither rule fires, the critical false-positive guard), plus a no-fingerprint baseline. Constructs `ClientFingerprint` struct literals with synthesized `Ja4Fingerprint` raw strings since that's the only way to deterministically set the JA4 prefix.

All three tests use a local `Engine` instance (not the global `SYNAPSE`) to avoid needing `#[serial]` coordination. They don't race with the other global-state tests.

## Updated existing tests

- **`test_production_rules_load_into_current_engine`** (waf/engine.rs): threshold bumped from `>= 237` to `>= 248` to reflect the new floor. Rule-id uniqueness check continues to pass (all 11 new ids are unique in the 220000 block).
- **`test_synapse_cold_start_ships_237_production_rules`** (main.rs): renamed to `test_synapse_cold_start_ships_full_production_ruleset` (removes the hardcoded "237" from the name so it doesn't need renaming on every rule addition) and threshold bumped from `>= 237` to `>= 248`.

## Verification

- `cargo test --lib waf::` — **103 passing** (was 100, +3 new signal-correlation tests)
- `cargo test --bin synapse-waf -- tests::` — **46 passing** (unchanged; cold-start test updated in place)
- `cargo test --test filter_chain_integration` — **49 passing** (unchanged)
- **Total: 198 tests green**, zero regressions

Engine accepts all 248 rules with no parse errors, no new warnings.

## AC mapping

- **AC#1** (≥8 new rules using the new match kinds) — 11 added: 7 DLP + 2 schema + 2 JA4.
- **AC#2** (reserved namespace, no collisions) — 220000 block, previously unused, verified pre-write via a Python scan.
- **AC#3** (targeted positive + negative tests for each rule) — three table-driven tests cover all 11 rules. DLP test has 7 positive + 1 benign baseline; schema test has 3 score-level cases + no-schema baseline; JA4 test has 2 positive + TLS 1.3 baseline + no-fingerprint baseline.
- **AC#4** (DLP covers credentials + PII) — api_key, aws_key, private_key, jwt (credentials) plus credit_card and ssn mass disclosure (PII). All are blocking.
- **AC#5** (warning + blocking schema thresholds) — 220010 at score≥10 (non-blocking warning), 220011 at score≥25 (blocking). Test exercises both paths and the in-between case.
- **AC#6** (JA4 deprecated TLS, non-blocking) — 220020 (TLS 1.0) and 220021 (TLS 1.1) both `blocking: false` with risk=10.
- **AC#7** (JA4H out of scope, documented) — section above explains why.
- **AC#8** (existing compat test still passes) — yes, threshold updated to `>= 248`.
- **AC#9** (cold-start test floor updated) — yes, `>= 248` and renamed to `_full_production_ruleset`.
- **AC#10** (clean load, no new warnings) — cargo check clean; only 8 pre-existing lib warnings unrelated to rules.

## Activating the m-6 feature in production

With TASK-45 (restore 237 rules) and TASK-46 (add 11 signal-correlation rules) both complete, the m-6 signal-correlation feature is now **fully active** in production:

- The deferred WAF pass in `upstream_request_filter` runs whenever DLP scan completes (TASK-35)
- Rules 220001-220007 evaluate in that deferred pass and block credential/PII exfiltration (new)
- Rules 220010-220011 fire in the body-phase pass against the learned schema baseline (new)
- Rules 220020-220021 fire in the body-phase pass against JA4 fingerprints set in `request_filter` (new)
- All new rules emit WafBlock telemetry via the TASK-32 path (deferred) or the existing body-phase telemetry path (schema/JA4)
- All new blocking rules produce the canonical JSON envelope via the TASK-34 unified response helper

The infrastructure from TASK-32 through TASK-41 is no longer dormant — it has rules exercising every hot code path.
<!-- SECTION:FINAL_SUMMARY:END -->

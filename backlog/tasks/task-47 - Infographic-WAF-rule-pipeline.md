---
id: TASK-47
title: 'Infographic: WAF rule pipeline'
status: Done
assignee: []
created_date: '2026-04-12 19:27'
updated_date: '2026-04-12 22:42'
labels:
  - brand
  - infographic
  - waf
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a brand infographic visualizing the Synapse WAF rule pipeline: the 237-rule set, phase ordering (header → body → response), and how verdicts flow into Pingora 403 classification. Output HTML, PNG, and PDF to brand/infographics/.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HTML, PNG, and PDF assets exist under brand/infographics/{html,png,pdf}
- [x] #2 Shows header/body/response phase ordering and rule count
- [x] #3 Depicts verdict → Pingora 403 classification path
- [x] #4 Visual style matches existing infographics (risk-scoring-lifecycle, request-processing-lifecycle)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered three assets for the WAF rule pipeline infographic, grounded in the live rule set and block-response code paths.

## Assets
- `brand/infographics/html/waf-rule-pipeline.html` (source of truth, scaffolded via `just infographic-new`)
- `brand/infographics/png/waf-rule-pipeline.png` (1200×2105)
- `brand/infographics/pdf/waf-rule-pipeline.pdf` (single page, `@page{size:1200px 2180px}`)

## Rule count
Uses the current live count of **248 rules** from `apps/synapse-pingora/src/production_rules.json`. The task description's "237" was carried over from an earlier archive-restore commit message (`083f434`); the rule set has grown by 11 since that restore. Confirmed by user: 248 is correct.

## Content sections
1. **Hero stats** — 248 rules · 30 threat classes · 2 eval phases · canonical 403.
2. **Pipeline rail (5 stages)** — Index Candidates (RuleIndex) → Body-Phase Pass (skips deferred rule ids via O(1) HashSet) → DLP Scanner → Deferred Pass (re-evaluates only `deferred_rule_indices`) → Verdict → 403. Trailing callout explains *why* two phases: `dlp_violation` match kind needs scanner output unavailable during the synchronous body pass.
3. **Threat classifications grid** — top 15 classes with counts: KnownVulnerability (37), Toolkit (35), CommandInjection (19), ProgrammaticAccess (17), BadBot (14), WebAttack (13), SqlInjection (12), DirTraversal (11), InfoDisclosure (11), Evasion (9), SoftwareDetection (9), BadTraffic (8), XSS (6), ContentEnumeration (6), BotnetActivity (5), plus "+15 more classes (26)".
4. **Match-kind distribution** — horizontal bars: boolean (196), header (12), count (11), args (7), dlp_violation ★deferred (7), uri (6), named_argument (3), schema_violation (2), ja4 (2), is_tor_exit (1), track_by_ip (1).
5. **Blocking vs observational split** — 62 blocking (25%) / 186 observational (75%), explaining that most rules feed the risk lifecycle rather than triggering immediate 403s.
6. **Canonical 403 contract** — JSON body `{"error":"access_denied"}`, headers (`:status 403`, `content-type`, `content-length`, `x-request-id` echo, HSTS on HTTPS), and the API-stability guarantee that every block site uses `send_waf_block_response` for byte-identical output.

## Grounding
All numbers verified against:
- `apps/synapse-pingora/src/production_rules.json` — rule count, classifications, match kinds, blocking split (parsed via Python).
- `apps/synapse-pingora/src/waf/engine.rs:371-408` — `DEFERRED_MATCH_KINDS = &["dlp_violation"]`, `deferred_rule_indices`, `deferred_rule_id_set`.
- `apps/synapse-pingora/src/main.rs:2020-2065` — `WAF_BLOCK_BODY` constant, `build_waf_block_response_header`, `send_waf_block_response` (the single canonical exit point).

## Pipeline scaffolding used
This is the first infographic rendered entirely through the new Tier 1 tooling:

    just infographic-new waf-rule-pipeline "WAF Rule Pipeline"
    # ...fill sections...
    just infographic-render waf-rule-pipeline

Pipeline caught a real issue during iteration: initial `@page` height of 1900px was too small (content measured at 2105px), and the page-count check flagged the resulting 2-page PDF before it could ship. Bumped `@page` to 2180px and re-rendered. The Tier 1 tooling prevented an otherwise-easy shipping mistake.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: TASK-49
title: 'Infographic: Signal Horizon telemetry pipeline'
status: Done
assignee: []
created_date: '2026-04-12 19:27'
updated_date: '2026-04-12 22:46'
labels:
  - brand
  - infographic
  - signal-horizon
  - telemetry
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a brand infographic for the Signal Horizon telemetry pipeline: event ingest → ClickHouse → dashboards/alerts. Pairs with the existing risk-scoring-lifecycle infographic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HTML, PNG, and PDF assets exist under brand/infographics/{html,png,pdf}
- [x] #2 Shows ingest → storage (ClickHouse) → query/visualization layers
- [x] #3 Calls out retention and aggregation stages
- [x] #4 Style matches existing infographics
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered three assets for the Signal Horizon telemetry pipeline infographic:

- `brand/infographics/html/signal-horizon-telemetry-pipeline.html`
- `brand/infographics/png/signal-horizon-telemetry-pipeline.png` (1200×1706)
- `brand/infographics/pdf/signal-horizon-telemetry-pipeline.pdf` (1 page, @page 2100px)

## Content
1. **Hero stats** — 10K signals/sec · 5000 events/batch · 10 materialized views · 365d longest retention.
2. **Ingest rail (5 stages)** — Edge Sensors → Telemetry API (JWT + nonce replay protection + Zod batch validation) → Retry Buffer → ClickHouse → Dashboards & Hunts.
3. **Ingest contract trio** — 10K/s target, ~100B/signal ZSTD compression, 5000 events/batch max enforced by TelemetryBatchSchema.
4. **Tiered retention gantt** — blocklist_history (365d), campaign_history (180d), signal_events (90d), http_transactions (30d), sensor_logs (30d). Bar widths scaled relative to 365d.
5. **10 materialized views grid** — signal_hourly_mv, ip_daily_mv, top_actors_hourly, attack_trends_daily, blocks_by_sensor_hourly, campaign_velocity_hourly, geo_distribution_daily, actor_sensor_matrix, fingerprint_spread_daily, daily_summary — each with aggregation keys and purpose.

## Grounding
- `apps/signal-horizon/clickhouse/schema.sql:1-401` — table list, retention TTLs, materialized view definitions, compression and throughput notes from header comments.
- `apps/signal-horizon/api/src/api/telemetry.ts:1-60` — TelemetryBatchSchema (5000 events max), requireTelemetryJwt middleware, replay-protection nonce store, ClickHouseRetryBuffer.

Built entirely through `just infographic-new` + `just infographic-render` with no manual render steps. @page sized to 2100px on first try based on content density estimate; final PNG came in at 1706px — still well within the page so no re-render needed.
<!-- SECTION:FINAL_SUMMARY:END -->

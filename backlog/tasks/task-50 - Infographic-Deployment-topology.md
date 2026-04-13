---
id: TASK-50
title: 'Infographic: Deployment topology'
status: Done
assignee: []
created_date: '2026-04-12 19:27'
updated_date: '2026-04-12 22:49'
labels:
  - brand
  - infographic
  - architecture
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a brand infographic showing the Edge Protection deployment topology: edge PoPs, control plane, client SDK, and how configuration/rules propagate outward to the edge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HTML, PNG, and PDF assets exist under brand/infographics/{html,png,pdf}
- [x] #2 Depicts edge PoPs, control plane, and client SDK
- [x] #3 Shows config/rule propagation flow from control plane to edge
- [x] #4 Style matches existing infographics
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered three assets for the deployment topology infographic:

- `brand/infographics/html/deployment-topology.html`
- `brand/infographics/png/deployment-topology.png` (1200×1870)
- `brand/infographics/pdf/deployment-topology.pdf` (1 page, @page 2050px)

## Content
1. **Hero stats** — 1 control plane · N edge PoPs · 5 tunnel channels · multi-tenant isolated.
2. **Topology SVG diagram** — Signal Horizon control plane (RuleDistributor, RolloutOrchestrator, FleetCommander, TunnelBroker, Telemetry API, ClickHouse) at the top, persistent WSS tunnel in the middle, 4 edge PoPs (us-east, eu-west, ap-south, sa-east) each running Synapse Pingora + Apparatus sensor, and protected origins with the `@atlascrew/synapse-client` SDK below. Violet arrows for rules/config going edge-ward, coral dashed arrows for telemetry returning, a dashed divider between CONTROL PLANE and DATA PLANE bands.
3. **Control-plane services grid** — 6 cards: RuleDistributor (fleet rule sync + tenant isolation), RolloutOrchestrator (BullMQ health-aware batched rollouts), FleetCommander (remote control commands), TunnelBroker (WS session mgr with per-session auth, per-channel rate limits, per-sensor session cap), Telemetry API, DeploymentStateStore (blue/green state).
4. **Rollout stages** — 1% canary → 10% early wave → 50% half fleet → 100% full rollout, each explaining the health gate and blue/green semantics.
5. **Tunnel channels** — Shell (PTY), Logs (live streaming w/ filters), Diag (health/mem/rules/actors), Control (reload/restart/drain/resume), Files (secure xfer & browse).
6. **Tenant isolation callout** — explains that rule distribution, tunnel sessions, and telemetry queries all enforce tenant scoping, throwing `TenantIsolationError` before any side effect.

## Grounding
- `apps/signal-horizon/api/src/services/fleet/rule-distributor.ts:1-50` — `RuleDistributor`, `TenantIsolationError`, `BlueGreenDeploymentState`, `DeploymentStateStore`.
- `apps/signal-horizon/api/src/services/fleet/rollout-orchestrator.ts:1-50` — `RolloutOrchestrator`, BullMQ queue, health-aware batch processing.
- `apps/signal-horizon/api/src/websocket/tunnel-broker.ts:1-35` — 5 tunnel channels (Shell, Logs, Diag, Control, Files), per-session auth, per-channel rate limiting, per-sensor max concurrent sessions, session timeout, audit logging.

Rendered in a single pass through `just infographic-render` — page height estimated at 2050px, final PNG 1870px, well within budget.
<!-- SECTION:FINAL_SUMMARY:END -->

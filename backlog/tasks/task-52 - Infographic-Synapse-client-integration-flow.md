---
id: TASK-52
title: 'Infographic: Synapse client integration flow'
status: Done
assignee: []
created_date: '2026-04-12 19:27'
updated_date: '2026-04-13 01:13'
labels:
  - brand
  - infographic
  - synapse-client
  - docs
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a developer-facing brand infographic covering the Synapse client onboarding: SDK install → configuration → first protected request. Useful for docs and marketing site.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HTML, PNG, and PDF assets exist under brand/infographics/{html,png,pdf}
- [x] #2 Shows SDK install, configuration, and first protected request stages
- [x] #3 Developer-persona framing (not operator)
- [x] #4 Style matches existing infographics
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered three assets for the Synapse client integration infographic:

- `brand/infographics/html/synapse-client-integration-flow.html`
- `brand/infographics/png/synapse-client-integration-flow.png` (1200×1851)
- `brand/infographics/pdf/synapse-client-integration-flow.pdf` (1 page, @page 2050px)

## Framing note
Task AC said "SDK install → configuration → first protected request." The actual product isn't a per-request protection SDK — `@atlascrew/synapse-client` is a **CLI + TypeScript management client** for operators and developers integrating with a running Synapse deployment. Reframed the infographic as a CLI+API onboarding flow (install → point → verify → operate) which matches the real product. The "first protected request" idea survives as the `synapse evaluate GET /api/users?id=1` command — a dry-run that asks "what would Synapse do with this request?"

## Content
1. **Hero stats** — 4 onboarding steps · 20+ CLI commands · TS typed client · Node 18+ runtime.
2. **4-step onboarding columns** — Install (`npm install -g @atlascrew/synapse-client`), Point (`export SYNAPSE_URL=...`), Verify (`synapse health` → `{"ok":true}`), Operate (`synapse status --json`, `synapse evaluate`). Each column is color-coded left border with a terminal snippet.
3. **Command surface grid (6 panels)** — Health & Status, Entity Management, Rule Management, Rule Evaluation, Configuration, Global Flags. Syntax-highlighted mono-variant pre blocks with operator colors.
4. **Environment configuration table** — SYNAPSE_URL, SYNAPSE_JSON, SYNAPSE_DEBUG, SYNAPSE_TIMEOUT with matching CLI flags and descriptions.
5. **Programmatic TypeScript code panel** — full `SynapseClient` example: instantiation, `health()`, `getStatus()`, `addRule({ ttlSec })`, and `evaluate()` dry-run with `verdict.blocked` handling. Syntax-highlighted with the same CASL/MONO variation as rest of the brand.

## Grounding
- `apps/synapse-client/package.json` — package name, CLI binaries (`synapse`, `syn`), Node 18+ engine requirement.
- `apps/synapse-client/README.md:1-80` — install instructions, full command list, global flags table, env vars.
- `apps/synapse-client/src/client.ts` + `index.ts` — confirms `@atlascrew/synapse-client` re-exports `SynapseClient` from `@atlascrew/synapse-api`, and shows the canonical usage snippet.

Rendered cleanly in one pass — @page 2050px, final PNG 1851px.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: TASK-53
title: 'Infographic: Analyst incident workflow'
status: Done
assignee: []
created_date: '2026-04-12 19:27'
updated_date: '2026-04-13 01:17'
labels:
  - brand
  - infographic
  - operator
  - workflow
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a brand infographic depicting the human-in-the-loop analyst workflow: alert → triage → rule tuning → deploy. Operator persona view; complements the runtime-focused infographics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 HTML, PNG, and PDF assets exist under brand/infographics/{html,png,pdf}
- [x] #2 Shows alert → triage → tuning → deploy stages
- [x] #3 Operator/analyst persona framing
- [x] #4 Style matches existing infographics
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered three assets for the analyst incident workflow infographic:

- `brand/infographics/html/analyst-incident-workflow.html`
- `brand/infographics/png/analyst-incident-workflow.png` (1200×1576)
- `brand/infographics/pdf/analyst-incident-workflow.pdf` (1 page, @page 2100px)

## Content
1. **Hero stats** — 4 workflow stages · <5m alert→triage · <15m triage→rule · canary deploy posture.
2. **Four-stage rail** — Alert (red, "Something just spiked. Is it real?") → Triage (amber, "Who else is hit?") → Tune (blue, "Minimal rule that catches this?") → Deploy (green, "Ship it — safely"). Each stage has an italic analyst-voice question, bullet list of concrete actions with `→` arrow markers, and a colored SLA/goal footer.
3. **Tools per stage grid (4 cols)** — real Horizon UI surfaces and API routes:
   - **Alert**: OverviewPage, WarRoomPage, LiveMapPage, ScenariosPage
   - **Triage**: ActorDetailPage, SessionDetailPage, CampaignDetailPage, RequestTimeline, SocSearchPage
   - **Tune**: HuntingPage, hunt-sigma API (`POST /api/hunt/sigma`), `synapse rule-add`, PlaybooksPage
   - **Deploy**: RolloutOrchestrator (BullMQ), FleetCommander (reload/drain), DeploymentStateStore (blue/green), AutopilotPage
4. **Response actions grid (8)** — Block IP, Release, Runtime Rule, Sigma Hunt, Config Tune, Playbook, War Room, Rollback. Each with concrete command or endpoint in cyan inline code.
5. **Loop-never-closes callout** — explains that deployed rules are the next rule's telemetry. Circular SVG icon. Frames the whole infographic as itself a loop, not a linear funnel.

## Persona framing
Operator/analyst first-person voice throughout — italic "questions" at each stage mirror what an analyst actually asks. Deliberate contrast with the architecture-heavy infographics: this one leads with the *human decisions*, not the services behind them.

## Grounding
- `apps/signal-horizon/ui/src/pages/` — confirmed real page files: OverviewPage, WarRoomPage, ScenariosPage, AutopilotPage, HuntingPage, PlaybooksPage, DesignLabPage.
- `apps/signal-horizon/ui/src/pages/soc/` — ActorDetailPage, ActorsPage, SessionDetailPage, SessionsPage, CampaignDetailPage, CampaignsPage, LiveMapPage, SocSearchPage.
- `apps/signal-horizon/ui/src/pages/hunting/` — CampaignTimelinePage, RequestTimelinePage.
- `apps/signal-horizon/api/src/api/routes/` — confirmed routes: hunt.ts, hunt-sigma.ts, playbooks.ts, warroom.ts, threats.ts, campaigns.ts, blocklist.ts, synapse.ts, intel/.
- Cross-referenced with `RolloutOrchestrator`, `FleetCommander`, `DeploymentStateStore` from deployment-topology infographic (TASK-50).

Rendered in one pass — @page 2100px, final PNG 1576px (smallest of the seven, since this one's content is dominated by text and lists rather than SVGs).
<!-- SECTION:FINAL_SUMMARY:END -->

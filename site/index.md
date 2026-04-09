---
layout: home

hero:
  name: Horizon
  text: Edge Protection Platform
  tagline: Embedded intelligence for API security. Fleet-aware WAF, inline DLP, and behavioral profiling — all running locally at the edge.
  actions:
    - theme: brand
      text: Live Demo →
      link: https://horizon-demo.atlascrew.dev
    - theme: alt
      text: View Architecture
      link: /architecture/
    - theme: alt
      text: Get Started
      link: /getting-started/

features:
  - icon:
      dark: /images/brand/synapse-icon-dark.svg
      light: /images/brand/synapse-icon-dark.svg
    title: Synapse — Edge Sensor
    details: Pure Rust WAF on Cloudflare Pingora. 237 rules, 500+ bot signatures, 22+ DLP patterns, 8 correlation detectors. Sub-millisecond detection. Deploy standalone or as a fleet sensor.
    link: /architecture/synapse
    linkText: Synapse architecture
  - icon:
      dark: /images/brand/horizon-icon-dark.svg
      light: /images/brand/horizon-icon-dark.svg
    title: Horizon — Fleet Hub
    details: Centralized intelligence for distributed Synapse sensors. Cross-tenant campaign correlation, real-time threat map, Sigma rules, CyberChef, and fleet-wide rule distribution.
    link: /architecture/horizon
    linkText: Horizon architecture
  - title: Signal Pipeline
    details: WebSocket telemetry from every sensor to the hub. Dual-write PostgreSQL + ClickHouse, live broadcaster to SOC dashboards, sub-100ms sync. Resilient ingest with no single point of failure.
    link: /architecture/data-flow
    linkText: Data flow details
---

<div class="vp-doc home-sections">

## Core Capabilities

<div class="card-grid">
  <a class="card" href="/reference/synapse-features">
    <div class="card-label" style="color: var(--vp-c-brand-1);">Detection</div>
    <div class="card-title">Synapse Feature Catalog</div>
    <div class="card-desc">Every detector, rule family, and behavioral signal Synapse evaluates — SQLi through session hijacking, with latency budgets and config knobs.</div>
  </a>
  <a class="card" href="/reference/horizon-features">
    <div class="card-label" style="color: var(--vp-c-brand-1);">Fleet Ops</div>
    <div class="card-title">Horizon Feature Catalog</div>
    <div class="card-desc">SOC tooling, fleet management, hunt queries, war-room workflows, and all the intelligence that coordinates a multi-sensor deployment.</div>
  </a>
  <a class="card" href="/configuration/">
    <div class="card-label" style="color: var(--vp-c-brand-1);">Config</div>
    <div class="card-title">Configuration &amp; Hot Reload</div>
    <div class="card-desc">~240μs atomic config swap with zero dropped requests. Rule hot-reload, feature toggles, and fleet-wide config distribution from Horizon.</div>
  </a>
  <a class="card" href="/reference/horizon-api">
    <div class="card-label" style="color: var(--vp-c-brand-1);">APIs</div>
    <div class="card-title">Admin &amp; Hunt APIs</div>
    <div class="card-desc">80+ REST endpoints plus WebSocket streams. Signals, campaigns, fleet state, drills, and remote shell tunnels — all with per-tenant rate limiting.</div>
  </a>
</div>

## Deploy &amp; Integrate

<div class="card-grid cols-3">
  <a class="card" href="/deployment/synapse-standalone">
    <div class="card-label" style="color: var(--vp-c-purple-1, #8B5CF6);">Standalone</div>
    <div class="card-title">Single-binary WAF</div>
    <div class="card-desc">Drop Synapse in front of any HTTP app. 25MB binary, no control plane required. Ideal for monoliths, internal tools, and air-gapped deployments.</div>
  </a>
  <a class="card" href="/deployment/kubernetes">
    <div class="card-label" style="color: var(--vp-c-brand-1);">Fleet Mode</div>
    <div class="card-title">Kubernetes &amp; Docker</div>
    <div class="card-desc">Helm charts, Docker images, and Terraform modules for running Synapse fleets with a self-hosted Horizon control plane.</div>
  </a>
  <a class="card" href="/deployment/production">
    <div class="card-label" style="color: var(--vp-c-green-1, #10B981);">Production</div>
    <div class="card-title">Production Checklist</div>
    <div class="card-desc">TLS termination, secrets management, observability hooks, capacity planning, and hardening defaults for every Synapse + Horizon deployment.</div>
  </a>
</div>

## Technical Infographics

<div class="card-grid infographics">
  <a class="card infographic" href="/infographics/full-architecture.html" target="_blank">
    <div class="card-label" style="color: #F97316;">Platform</div>
    <div class="card-title">Full Architecture</div>
    <div class="card-desc">End-to-end view of the Horizon + Synapse platform — clients, edge sensors, control plane, storage, and consumers — with timing, resilience model, and component responsibilities.</div>
  </a>
  <a class="card infographic" href="/infographics/request-processing-lifecycle.html" target="_blank">
    <div class="card-label" style="color: #1E90FF;">Pipeline</div>
    <div class="card-title">Request Processing</div>
    <div class="card-desc">Six-stage sequential pipeline from TLS fingerprint to final decision. Per-stage timing, challenge escalation, and edge-vs-cloud latency comparison.</div>
  </a>
  <a class="card infographic" href="/infographics/dlp-edge-protection.html" target="_blank">
    <div class="card-label" style="color: #10B981;">DLP</div>
    <div class="card-title">DLP at the Edge</div>
    <div class="card-desc">Inline response inspection with 5 detection categories. How Synapse catches credential leaks and PII exposure before they leave the response body.</div>
  </a>
  <a class="card infographic" href="/infographics/campaign-correlation-engine.html" target="_blank">
    <div class="card-label" style="color: #8B5CF6;">Correlation</div>
    <div class="card-title">Campaign Correlation</div>
    <div class="card-desc">Seven weighted detectors that link distributed attacks into unified campaigns. Confidence thresholds, graph correlation, and fleet-wide propagation.</div>
  </a>
  <a class="card infographic" href="/infographics/interrogator-system.html" target="_blank">
    <div class="card-label" style="color: #8B5CF6;">Challenges</div>
    <div class="card-title">Interrogator System</div>
    <div class="card-desc">Progressive challenge escalation — Cookie → JS PoW → CAPTCHA → Tarpit → Block. How Synapse separates bots from humans with adaptive friction.</div>
  </a>
  <a class="card infographic" href="/infographics/risk-scoring-lifecycle.html" target="_blank">
    <div class="card-label" style="color: #F97316;">Scoring</div>
    <div class="card-title">Risk Scoring</div>
    <div class="card-desc">Per-entity risk score computation from multiple signal sources. Decay, escalation thresholds, and the action triggers that follow each score band.</div>
  </a>
</div>

</div>

<style scoped>
.home-sections {
  max-width: 1152px;
  margin: 64px auto 0;
  padding: 0 48px;
}

.home-sections h2 {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.2px;
  color: var(--vp-c-text-1);
  margin: 48px 0 20px;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-divider);
}

.home-sections h2:first-child {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.card-grid.cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.card-grid.infographics {
  grid-template-columns: repeat(3, 1fr);
}

.card {
  display: block;
  padding: 20px 22px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.25s, background 0.25s, transform 0.2s;
}

.card:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-elv);
  transform: translateY(-1px);
}

.card-label {
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 6px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin-bottom: 6px;
  line-height: 1.3;
}

.card-desc {
  font-size: 13px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

@media (max-width: 768px) {
  .home-sections {
    padding: 0 24px;
    margin-top: 48px;
  }
  .card-grid,
  .card-grid.cols-3,
  .card-grid.infographics {
    grid-template-columns: 1fr;
  }
}
</style>

# Signal Horizon Component Audit
_Generated: 2026-02-12 14:19_

## Summary

**Total findings: 308**

### Findings by Component

| Component | Hits | Action |
|-----------|------|--------|
| Stack (row+align+gap) | 308 | Tailwind flex + items-center + gap → use <Stack direction=row align=center> |

### Files by Hit Count (Work Order)

Priority files to migrate first (most raw patterns):

| Hits | File |
|------|------|
| 19 | `pages/fleet/ReleasesPage.tsx` |
| 18 | `components/fleet/FileBrowser.tsx` |
| 17 | `pages/AdminSettingsPage.tsx` |
| 12 | `pages/fleet/BandwidthDashboardPage.tsx` |
| 11 | `pages/beam/threats/ThreatActivityPage.tsx` |
| 11 | `components/fleet/SessionSearchResults.tsx` |
| 9 | `pages/fleet/sensor-detail/ConfigurationTab.tsx` |
| 9 | `pages/beam/threats/BlockedRequestsPage.tsx` |
| 9 | `pages/beam/threats/AttackPatternsPage.tsx` |
| 9 | `components/fleet/LogViewer.tsx` |
| 8 | `pages/beam/catalog/SchemaChangesPage.tsx` |
| 8 | `pages/beam/catalog/ApiCatalogPage.tsx` |
| 8 | `pages/beam/BeamDashboardPage.tsx` |
| 8 | `components/fleet/RolloutManager.tsx` |
| 8 | `components/LoadingStates.tsx` |
| 7 | `pages/fleet/RuleDistributionPage.tsx` |
| 7 | `pages/fleet/GlobalSessionSearchPage.tsx` |
| 7 | `components/fleet/RemoteShell.tsx` |
| 6 | `pages/soc/SessionsPage.tsx` |
| 6 | `pages/beam/analytics/ErrorAnalysisPage.tsx` |
| 5 | `pages/fleet/SensorConfigPage.tsx` |
| 5 | `pages/fleet/OnboardingPage.tsx` |
| 5 | `pages/fleet/FleetHealthPage.tsx` |
| 5 | `pages/beam/analytics/ResponseTimesPage.tsx` |
| 5 | `pages/WarRoomPage.tsx` |
| 5 | `pages/OverviewPage.tsx` |
| 5 | `components/fleet/pingora/CrawlerConfig.tsx` |
| 4 | `pages/soc/SessionDetailPage.tsx` |
| 4 | `pages/soc/LiveMapPage.tsx` |
| 4 | `pages/soc/CampaignsPage.tsx` |
| 4 | `pages/fleet/SensorKeysPage.tsx` |
| 4 | `pages/beam/catalog/ServicesPage.tsx` |
| 4 | `pages/beam/analytics/TrafficAnalyticsPage.tsx` |
| 4 | `pages/SupportPage.tsx` |
| 4 | `components/fleet/pingora/EntityConfig.tsx` |
| 3 | `pages/soc/ActorDetailPage.tsx` |
| 3 | `pages/fleet/DlpDashboardPage.tsx` |
| 3 | `pages/fleet/CapacityForecastPage.tsx` |
| 3 | `pages/CampaignDetailPage.tsx` |
| 3 | `components/fleet/EmbeddedDashboard.tsx` |

---

## Detailed Findings

### Stack (row+align+gap)
Tailwind flex + items-center + gap → use <Stack direction=row align=center>

| File | Line | Match |
|------|------|-------|
| `components/warroom/PlaybookRunner.tsx` | 81 | `<h3 className="font-medium text-ac-blue flex items-center gap-2">` |
| `components/warroom/PlaybookRunner.tsx` | 110 | `<div className="flex items-center gap-3">` |
| `components/warroom/PlaybookSelector.tsx` | 20 | `<div className="flex items-center gap-2">` |
| `components/fleet/LogViewer.tsx` | 389 | `<div className="flex items-center gap-3">` |
| `components/fleet/LogViewer.tsx` | 394 | `<div className="flex items-center gap-1.5">` |
| `components/fleet/LogViewer.tsx` | 409 | `<div className="flex items-center gap-2">` |
| `components/fleet/LogViewer.tsx` | 435 | `<div className="flex items-center gap-3">` |
| `components/fleet/LogViewer.tsx` | 485 | `<div className="flex items-center gap-4 mt-2 pt-2 border-t border-border-subtle"` |
| `components/fleet/LogViewer.tsx` | 489 | `className="flex items-center gap-1.5 cursor-pointer select-none"` |
| `components/fleet/LogViewer.tsx` | 507 | `<div className="flex items-center gap-2">` |
| `components/fleet/LogViewer.tsx` | 533 | `className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-ink-se` |
| `components/fleet/LogViewer.tsx` | 543 | `className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-ink-se` |
| `components/fleet/pingora/TarpitConfig.tsx` | 54 | `<div className="flex items-center gap-2">` |
| `components/fleet/pingora/TarpitConfig.tsx` | 197 | `<div className="flex items-center gap-1 mb-1">` |
| `components/fleet/pingora/BlockPageConfig.tsx` | 23 | `<div className="flex items-center gap-2">` |
| `components/fleet/pingora/BlockPageConfig.tsx` | 77 | `<label key={key} className="flex items-center gap-2 cursor-pointer">` |
| `components/fleet/pingora/RateLimitConfig.tsx` | 20 | `<div className="flex items-center gap-2">` |
| `components/fleet/pingora/EntityConfig.tsx` | 63 | `<div className="flex items-center gap-2">` |
| `components/fleet/pingora/EntityConfig.tsx` | 107 | `<label htmlFor="entity-risk-decay" className="text-xs font-medium text-ink-secon` |
| `components/fleet/pingora/EntityConfig.tsx` | 189 | `<div className="flex items-center gap-2">` |
| `components/fleet/pingora/EntityConfig.tsx` | 199 | `<label className="text-xs font-medium text-ink-secondary flex items-center gap-1` |
| `components/fleet/pingora/AccessControlConfig.tsx` | 44 | `<div className="flex items-center gap-2">` |
| `components/fleet/pingora/CrawlerConfig.tsx` | 32 | `<div className="flex items-center gap-2">` |
| `components/fleet/pingora/CrawlerConfig.tsx` | 55 | `<label className="flex items-center gap-2 cursor-pointer">` |
| `components/fleet/pingora/CrawlerConfig.tsx` | 62 | `<div className="flex items-center gap-1">` |
| `components/fleet/pingora/CrawlerConfig.tsx` | 67 | `<label className="flex items-center gap-2 cursor-pointer">` |
| `components/fleet/pingora/CrawlerConfig.tsx` | 74 | `<div className="flex items-center gap-1">` |
| `components/fleet/pingora/WafConfig.tsx` | 35 | `<div className="flex items-center gap-2">` |
| `components/fleet/pingora/WafConfig.tsx` | 109 | `<div className="flex items-center gap-3">` |
| `components/fleet/RemoteShell.tsx` | 283 | `<div className={`flex items-center gap-2 ${config.className}`}>` |


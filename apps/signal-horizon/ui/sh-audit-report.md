# Signal Horizon Component Audit
_Generated: 2026-02-12 19:36_

## Summary

**Total findings: 31**

### Findings by Component

| Component | Hits | Action |
|-----------|------|--------|
| Stack (row+align+gap) | 31 | Tailwind flex + items-center + gap → use <Stack direction=row align=center> |

### Files by Hit Count (Work Order)

Priority files to migrate first (most raw patterns):

| Hits | File |
|------|------|
| 4 | `pages/fleet/SensorKeysPage.tsx` |
| 4 | `pages/SupportPage.tsx` |
| 3 | `pages/fleet/DlpDashboardPage.tsx` |
| 3 | `pages/fleet/CapacityForecastPage.tsx` |
| 3 | `pages/CampaignDetailPage.tsx` |
| 2 | `pages/fleet/sensor-detail/OverviewTab.tsx` |
| 2 | `pages/fleet/FleetOverviewPage.tsx` |
| 1 | `pages/hunting/RequestTimelinePage.tsx` |
| 1 | `pages/fleet/sensor-detail/shared.tsx` |
| 1 | `pages/fleet/sensor-detail/PerformanceTab.tsx` |
| 1 | `pages/fleet/SensorDetailPage.tsx` |
| 1 | `pages/fleet/ConfigManagerPage.tsx` |
| 1 | `pages/IntelPage.tsx` |
| 1 | `pages/ApiIntelligencePage.tsx` |
| 1 | `components/fleet/SessionSearchResults.tsx` |
| 1 | `components/api-intelligence/ViolationsFeed.tsx` |
| 1 | `components/api-intelligence/ApiTreemap.tsx` |

---

## Detailed Findings

### Stack (row+align+gap)
Tailwind flex + items-center + gap → use <Stack direction=row align=center>

| File | Line | Match |
|------|------|-------|
| `components/fleet/SessionSearchResults.tsx` | 314 | `<div className="flex items-center justify-end gap-2">` |
| `components/api-intelligence/ViolationsFeed.tsx` | 41 | `<span className="text-[10px] text-ink-muted flex items-center gap-1">` |
| `components/api-intelligence/ApiTreemap.tsx` | 139 | `<div key={service.name} className="flex items-center gap-2">` |
| `pages/ApiIntelligencePage.tsx` | 161 | `<div className="flex items-center gap-2">` |
| `pages/hunting/RequestTimelinePage.tsx` | 390 | `<div className="flex items-center gap-3">` |
| `pages/SupportPage.tsx` | 252 | `<div className="flex items-center gap-10">` |
| `pages/SupportPage.tsx` | 263 | `<nav className="flex items-center gap-2">` |
| `pages/SupportPage.tsx` | 1003 | `<div className="flex items-center gap-2 text-[10px] font-bold text-ink-muted upp` |
| `pages/SupportPage.tsx` | 1010 | `<div className="flex items-center gap-4 mb-10 pb-6 border-b border-border-subtle` |
| `pages/IntelPage.tsx` | 139 | `<div className="flex items-center gap-3">` |
| `pages/CampaignDetailPage.tsx` | 114 | `className="text-sm text-link hover:text-link-hover flex items-center gap-1"` |
| `pages/CampaignDetailPage.tsx` | 140 | `<div className="flex items-center gap-2">` |
| `pages/CampaignDetailPage.tsx` | 379 | `<div className="card p-4 flex items-center gap-3">` |
| `pages/fleet/sensor-detail/OverviewTab.tsx` | 180 | `<span className="inline-flex items-center gap-2 text-xs text-ink-primary">` |
| `pages/fleet/sensor-detail/OverviewTab.tsx` | 294 | `<div className="flex items-center gap-3">` |
| `pages/fleet/sensor-detail/shared.tsx` | 81 | `className="group flex items-center gap-2 px-4 py-3 bg-surface-subtle border bord` |
| `pages/fleet/sensor-detail/PerformanceTab.tsx` | 59 | `<span className="inline-flex items-center gap-2 text-sm font-medium text-ink-pri` |
| `pages/fleet/DlpDashboardPage.tsx` | 89 | `<div className="flex items-center gap-2 px-3 py-1.5 bg-status-success/10 border ` |
| `pages/fleet/DlpDashboardPage.tsx` | 229 | `<h3 className="text-lg font-medium text-ink-primary mb-6 flex items-center gap-2` |
| `pages/fleet/DlpDashboardPage.tsx` | 268 | `<h3 className="text-lg font-medium text-ink-primary mb-6 flex items-center gap-2` |
| `pages/fleet/CapacityForecastPage.tsx` | 219 | `<div className="flex items-center gap-2 px-3 py-1.5 bg-ac-orange/10 border bord` |
| `pages/fleet/CapacityForecastPage.tsx` | 375 | `<div className="mt-3 flex items-center gap-2 text-xs">` |
| `pages/fleet/CapacityForecastPage.tsx` | 377 | `<span className={clsx('flex items-center gap-1 font-medium', trendColor)}>` |
| `pages/fleet/SensorKeysPage.tsx` | 231 | `className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blu` |
| `pages/fleet/SensorKeysPage.tsx` | 399 | `className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white focu` |
| `pages/fleet/SensorKeysPage.tsx` | 505 | `className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white focu` |
| `pages/fleet/SensorKeysPage.tsx` | 565 | `<label key={perm.id} className="flex items-center gap-2 cursor-pointer">` |
| `pages/fleet/ConfigManagerPage.tsx` | 868 | `<div className="flex items-center gap-3">` |
| `pages/fleet/FleetOverviewPage.tsx` | 321 | `<div className="flex items-center gap-4">` |
| `pages/fleet/FleetOverviewPage.tsx` | 388 | `<div className="flex items-center gap-3">` |


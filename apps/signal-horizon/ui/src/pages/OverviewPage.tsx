/**
 * Threat Overview Page
 * Live attack map, threat feed, sensor status, active campaigns
 *
 * Migrated to @/ui component library for brand consistency.
 */

import { motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import land from 'world-atlas/land-110m.json';
import {
  Shield,
  AlertTriangle,
  Activity,
  Server,
  RefreshCw,
  Download,
  Settings,
  Database,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useHorizonStore, useTimeRange } from '../stores/horizonStore';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  StatsGridSkeleton,
  CampaignListSkeleton,
  AlertFeedSkeleton,
  TableSkeleton,
} from '../components/LoadingStates';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAttackMap, type AttackPoint, type AttackRoute, type AttackSeverity } from '../hooks/useAttackMap';
import { useRelativeTime } from '../hooks/useRelativeTime';

// ─── @/ui library imports ────────────────────────────────────────────────────
import {
  SectionHeader,
  KpiStrip,
  Button,
  colors,
} from '@/ui';

const ActiveCampaignList = lazy(() => import('../components/soc/ActiveCampaignList'));
const ThreatTrajectoryFeed = lazy(() => import('../components/soc/ThreatTrajectoryFeed'));

const fallbackAttackers = [
  { label: '185.228.101.0/24', value: 12421 },
  { label: '45.134.26.0/24', value: 8234 },
  { label: '91.240.148.0/24', value: 5891 },
  { label: 'AS12345', value: 5102 },
  { label: '45.134.26.0/24', value: 2567 },
];

const fallbackFingerprints = [
  { label: 'python-requests', value: 3421 },
  { label: 'curl/7.68', value: 2740 },
  { label: 'go-http-client', value: 2198 },
  { label: 'custom-scanner', value: 1203 },
  { label: 'headless-chrome', value: 901 },
];

const mapFilters = ['All Attacks', 'Top Bots (1h)', 'Cross-Tenant'];

export default function OverviewPage() {
  useDocumentTitle('Overview');
  const { campaigns, threats, alerts, stats, isLoading: isStoreLoading } = useHorizonStore();
  const timeRange = useTimeRange();
  const { points: mapPoints, routes: mapRoutes, isLoading: isMapLoading, error, refetch } = useAttackMap();
  const isLoading = isStoreLoading || isMapLoading;
  const [activeFilter, setActiveFilter] = useState(mapFilters[0]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const lastUpdatedText = useRelativeTime(lastUpdated);

  useEffect(() => {
    if (!isLoading && (campaigns.length > 0 || threats.length > 0 || alerts.length > 0)) {
      setLastUpdated(Date.now());
    }
  }, [isLoading, campaigns.length, threats.length, alerts.length]);

  const filteredMapPoints = useMemo(() => {
    if (activeFilter === 'Top Bots (1h)') return mapPoints.filter((p) => p.category === 'bot');
    if (activeFilter === 'Cross-Tenant') return mapPoints.filter((p) => p.scope === 'fleet');
    return mapPoints;
  }, [activeFilter, mapPoints]);

  const filteredMapRoutes = useMemo(() => {
    const visible = new Set(filteredMapPoints.map((p) => p.id));
    return mapRoutes.filter((r) => {
      if (!visible.has(r.from) || !visible.has(r.to)) return false;
      if (activeFilter === 'Top Bots (1h)') return r.category === 'bot';
      return true;
    });
  }, [activeFilter, filteredMapPoints, mapRoutes]);

  const topAttackers = useMemo(() => {
    if (threats.length === 0) return fallbackAttackers;
    return [...threats]
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 5)
      .map((t) => ({ label: t.indicator, value: t.hitCount }));
  }, [threats]);

  const topFingerprints = useMemo(() => {
    const fp = threats.filter((t) => t.threatType.toLowerCase().includes('fingerprint'));
    const source = fp.length > 0 ? fp : threats;
    if (source.length === 0) return fallbackFingerprints;
    return [...source]
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 5)
      .map((t) => ({ label: t.indicator, value: t.hitCount }));
  }, [threats]);

  const kpiMetrics = useMemo(() => [
    { label: 'Active Campaigns', value: stats.activeCampaigns, subtitle: '+2 from yesterday', borderColor: colors.red, icon: <Shield className="w-4 h-4" /> },
    { label: 'Campaigns (24h)', value: campaigns.length, subtitle: '+4 from yesterday', borderColor: colors.orange, icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Blocked', value: stats.blockedIndicators, subtitle: '+12% from yesterday', borderColor: colors.green, icon: <Activity className="w-4 h-4" /> },
    { label: 'Sensors Reporting', value: `${stats.sensorsOnline}`, subtitle: '1 sensor offline', borderColor: colors.blue, icon: <Server className="w-4 h-4" /> },
    { label: 'API Discovery', value: stats.apiStats?.discoveryEvents ?? 0, subtitle: `${stats.apiStats?.schemaViolations ?? 0} schema changes`, borderColor: colors.purple, icon: <Database className="w-4 h-4" /> },
  ], [stats, campaigns.length]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" role="main" aria-busy="true" aria-label="Loading threat overview">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light text-ink-primary">Threat Overview</h1>
            <p className="text-ink-secondary mt-1">Loading fleet intelligence...</p>
          </div>
        </div>
        <StatsGridSkeleton />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2"><CampaignListSkeleton /></div>
          <AlertFeedSkeleton />
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  const lastUpdatedSuffix = lastUpdatedText ? ` · Updated ${lastUpdatedText}` : '';

  return (
    <div className="p-6 space-y-6" role="main" aria-label="Threat overview dashboard">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <SectionHeader
        eyebrow={`Signal Horizon · Last ${timeRange}`}
        title="Threat Overview"
        description={`Fleet threat intelligence and collective defense across ${stats.sensorsOnline} sensors${lastUpdatedSuffix}`}
        size="h2"
        mb="sm"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outlined" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={() => refetch()}>Refresh</Button>
            <Button variant="outlined" size="sm" icon={<Download className="w-4 h-4" />}>Export Report</Button>
            <Button variant="secondary" size="sm" icon={<Settings className="w-4 h-4" />}>Settings</Button>
          </div>
        }
      />

      {/* ─── KPI Strip ───────────────────────────────────────────────── */}
      <KpiStrip metrics={kpiMetrics} cols={5} size="default" />

      {/* ─── Attack Map + Threat Feed ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 card scanlines tactical-bg relative overflow-hidden" aria-labelledby="attack-map-heading">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-white/5 diagonal-split pointer-events-none" />
          <div className="card-header flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <h2 id="attack-map-heading" className="font-medium text-ink-primary tracking-wide">Live Attack Map</h2>
              {error && (
                <span className="text-xs text-ac-orange flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />Using cached data
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {mapFilters.map((filter) => (
                <Button
                  key={filter}
                  variant={activeFilter === filter ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFilter(filter)}
                  style={{ fontSize: '12px', height: '28px', padding: '0 12px' }}
                >{filter}</Button>
              ))}
            </div>
          </div>
          <div className="card-body relative z-10">
            <AttackMap points={filteredMapPoints} routes={filteredMapRoutes} />
          </div>
        </section>
        <div className="flex flex-col h-fit">
          <ErrorBoundary fallback={<AlertFeedSkeleton />}>
            <Suspense fallback={<AlertFeedSkeleton />}>
              <ThreatTrajectoryFeed threats={threats} alerts={alerts} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      {/* ─── Active Campaigns ────────────────────────────────────────── */}
      <section className="card border-t-4 border-ac-blue flex flex-col min-h-[300px]" aria-labelledby="campaigns-heading">
        <div className="card-header flex items-center justify-between bg-surface-subtle/50 shrink-0">
          <h2 id="campaigns-heading" className="text-sm font-bold text-ink-primary tracking-tight">Active Campaigns</h2>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">
              {campaigns.filter(c => c.status === 'ACTIVE').length} ACTIVE
            </span>
            <Button variant="ghost" size="sm" style={{ fontSize: '10px', height: '24px', letterSpacing: '0.1em' }}>
              View All Campaigns &gt;
            </Button>
          </div>
        </div>
        <div className="card-body p-0">
          <ErrorBoundary fallback={<CampaignListSkeleton />}>
            <Suspense fallback={<CampaignListSkeleton />}>
              <ActiveCampaignList campaigns={campaigns} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </section>

      {/* ─── Strategic Insights + Top Metrics ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategic Insight hero */}
        <div className="group flex flex-col justify-center min-h-[450px] relative overflow-hidden" style={{ background: colors.navy, padding: '24px' }}>
          <div className="absolute top-0 right-0 w-32 h-full bg-white/5 diagonal-split transition-transform group-hover:scale-110 duration-500" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3" style={{ color: colors.skyBlue }}>
              <Shield className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Strategic Insight</span>
            </div>
            <h3 className="text-xl font-light mb-4 tracking-tight" style={{ color: '#F0F4F8' }}>Fleet Vulnerability Analysis</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Current telemetry indicates a 14% increase in credential stuffing attempts targeting the catalog-api.
              Edge sensors have automatically shifted to aggressive rate-limiting.
            </p>
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span>Threat Level</span>
                <span style={{ color: colors.orange }}>Elevated</span>
              </div>
              <div className="h-1 w-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full w-[65%]" style={{ background: colors.orange }} />
              </div>
            </div>
            <Button variant="ghost" size="sm" iconAfter={<Activity className="w-3 h-3" />} style={{ color: colors.magenta, fontSize: '10px', letterSpacing: '0.1em', padding: 0, height: 'auto' }}>
              Review Recommended Policies
            </Button>
          </div>
        </div>

        {/* Top Attackers */}
        <section className="card border-t border-border-subtle flex flex-col h-full min-h-[450px]" aria-labelledby="attackers-heading">
          <div className="card-header py-3 bg-surface-subtle/30 shrink-0">
            <h2 id="attackers-heading" className="text-xs font-bold text-ink-muted tracking-widest">Top Attackers (24h)</h2>
          </div>
          <div className="card-body space-y-5 overflow-auto flex-grow">
            {topAttackers.map((a) => (
              <div key={a.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-ink-secondary truncate pr-2">{a.label}</span>
                  <span className="text-ink-muted font-bold">{a.value.toLocaleString()}</span>
                </div>
                <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full" style={{ background: `${colors.blue}B3`, width: `${Math.min(100, (a.value / (topAttackers[0]?.value || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top Fingerprints */}
        <section className="card border-t border-border-subtle flex flex-col h-full min-h-[450px]" aria-labelledby="fingerprints-heading">
          <div className="card-header py-3 bg-surface-subtle/30 shrink-0">
            <h2 id="fingerprints-heading" className="text-xs font-bold text-ink-muted tracking-widest">Top Fingerprints (24h)</h2>
          </div>
          <div className="card-body space-y-5 overflow-auto flex-grow">
            {topFingerprints.map((f) => (
              <div key={f.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-ink-secondary truncate pr-2">{f.label}</span>
                  <span className="text-ink-muted font-bold">{f.value.toLocaleString()}</span>
                </div>
                <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full" style={{ background: `${colors.magenta}B3`, width: `${Math.min(100, (f.value / (topFingerprints[0]?.value || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

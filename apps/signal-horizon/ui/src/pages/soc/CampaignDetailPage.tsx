import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  Breadcrumb,
  Button,
  EmptyState,
  SectionHeader,
  StatusBadge,
  alpha,
  axisDefaults,
  colors,
  gridDefaultsSoft,
  spacing,
  tooltipDefaults,
  xAxisNoLine,
} from '@/ui';
import {
  Target,
  Clock,
  Users,
  Shield,
  Activity,
  ExternalLink,
  AlertTriangle,
  Flame,
  Swords,
  ChevronRight,
  Network,
  Building,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useDemoMode } from '../../stores/demoModeStore';
import { fetchCampaignActors, fetchCampaignDetail } from '../../hooks/soc/api';
import { useSocSensor } from '../../hooks/soc/useSocSensor';
import { CampaignGraph } from '../../components/soc/CampaignGraph';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import type {
  SocCampaign,
  SocCampaignActor,
  SocCampaignDetailResponse,
  SocCampaignActorsResponse,
  SocCampaignSignal,
} from '../../types/soc';

function campaignStatusToBadge(
  status: SocCampaign['status'],
): 'error' | 'warning' | 'info' | 'success' {
  if (status === 'ACTIVE') return 'error';
  if (status === 'DETECTED') return 'warning';
  if (status === 'DORMANT') return 'info';
  return 'success';
}

function severityToBadge(severity: SocCampaign['severity']): 'error' | 'warning' | 'info' {
  if (severity === 'CRITICAL') return 'error';
  if (severity === 'HIGH' || severity === 'MEDIUM') return 'warning';
  return 'info';
}

const demoSignals: SocCampaignSignal[] = [
  {
    type: 'HTTP Fingerprint Match',
    confidence: 0.96,
    reason: 'Shared fingerprint across 4 sensors.',
  },
  {
    type: 'Timing Correlation',
    confidence: 0.89,
    reason: 'Burst pattern repeats every 15 minutes.',
  },
  { type: 'Target Overlap', confidence: 0.81, reason: 'Same endpoint matrix across tenants.' },
];

const demoCampaign: SocCampaign = {
  campaignId: 'cmp-demo-1',
  name: 'Credential Stuffing Wave',
  status: 'ACTIVE',
  severity: 'HIGH',
  confidence: 0.88,
  actorCount: 18,
  firstSeen: Date.now() - 36 * 3600 * 1000,
  lastSeen: Date.now() - 22 * 60 * 1000,
  summary: 'Automated credential stuffing across API auth and checkout paths.',
  correlationTypes: ['fingerprint', 'timing', 'endpoint'],
};

const demoActors: SocCampaignActor[] = Array.from({ length: 6 }).map((_, index) => ({
  actorId: `actor-demo-${index + 1}`,
  riskScore: 70 + index * 4,
  lastSeen: Date.now() - index * 35 * 60 * 1000,
  ips: [`203.0.113.${80 + index}`],
}));

const demoParticipatingIps = [
  { ip: '185.228.101.34', hits: 8421, status: 'BLOCKED' as const },
  { ip: '185.228.101.35', hits: 7892, status: 'BLOCKED' as const },
  { ip: '45.134.26.108', hits: 6234, status: 'BLOCKED' as const },
  { ip: '45.134.26.109', hits: 5102, status: 'BLOCKED' as const },
  { ip: '91.240.118.42', hits: 4891, status: 'MONITORING' as const },
];

const demoAffectedCustomers = [
  { name: 'Healthcare-A', attempts: 12421, status: 'ACTIVE' as const },
  { name: 'Finance-B', attempts: 9832, status: 'ACTIVE' as const },
  { name: 'Retail-C', attempts: 8421, status: 'PROTECTED' as const },
  { name: 'Healthcare-D', attempts: 6234, status: 'PROTECTED' as const },
  { name: 'E-commerce-E', attempts: 4102, status: 'PROTECTED' as const },
];

function buildVelocitySeries(baseTime: number) {
  return Array.from({ length: 8 }).map((_, index) => {
    const timestamp = baseTime - (7 - index) * 30 * 60 * 1000;
    const value = 120 + index * 140 + Math.round(Math.sin(index) * 40);
    return {
      time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      volume: Math.max(60, value),
    };
  });
}

function buildDemoCampaignDetail(id?: string): SocCampaignDetailResponse {
  return {
    campaign: {
      ...demoCampaign,
      campaignId: id ?? demoCampaign.campaignId,
    },
    signals: demoSignals,
  };
}

function buildDemoCampaignActors(id?: string): SocCampaignActorsResponse {
  return {
    campaignId: id ?? demoCampaign.campaignId,
    actors: demoActors,
  };
}

export default function CampaignDetailPage() {
  useDocumentTitle('SOC - Campaign Detail');
  const { id } = useParams();
  const { sensorId } = useSocSensor();
  const { isEnabled: isDemoMode } = useDemoMode();

  const { data: campaignResponse, isLoading } = useQuery({
    queryKey: ['soc', 'campaign', sensorId, id, isDemoMode],
    queryFn: async () => {
      if (isDemoMode) return buildDemoCampaignDetail(id);
      if (!id) throw new Error('Missing campaign ID');
      return fetchCampaignDetail(sensorId, id);
    },
    enabled: !!id,
  });

  const { data: actorsResponse } = useQuery({
    queryKey: ['soc', 'campaign-actors', sensorId, id, isDemoMode],
    queryFn: async () => {
      if (isDemoMode) return buildDemoCampaignActors(id);
      if (!id) throw new Error('Missing campaign ID');
      return fetchCampaignActors(sensorId, id);
    },
    enabled: !!id,
  });

  const campaign = campaignResponse?.campaign;
  const actors = actorsResponse?.actors ?? [];
  const signals = campaignResponse?.signals ?? [];

  const velocityData = useMemo(() => {
    const base = campaign?.lastSeen ?? Date.now();
    return buildVelocitySeries(base);
  }, [campaign?.lastSeen]);

  if (isLoading && !campaign) {
    return <div className="p-6 text-ink-muted">Loading campaign...</div>;
  }

  if (!campaign) {
    return (
      <EmptyState
        icon={<AlertTriangle aria-hidden="true" />}
        title="Campaign Not Found"
        description="The requested campaign could not be found."
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'Campaigns', to: '/campaigns' }, { label: campaign.name }]} />
      <header className="space-y-2">
        <Link
          to="/campaigns"
          className="text-sm text-link hover:text-link-hover flex items-center gap-1"
        >
          <ChevronRight aria-hidden="true" className="w-4 h-4 rotate-180" />
          Back to Campaigns
        </Link>
        <SectionHeader
          title={campaign.name}
          description={campaign.summary ?? 'Coordinated campaign detected across multiple signals.'}
          size="h3"
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <Button
                variant="outlined"
                size="sm"
                icon={<ExternalLink aria-hidden="true" className="w-4 h-4" />}
              >
                Export IOCs
              </Button>
              <Button size="sm" icon={<Shield aria-hidden="true" className="w-4 h-4" />}>
                Open War Room
              </Button>
            </div>
          }
        />
        <div className="flex items-center gap-2">
          <StatusBadge status={campaignStatusToBadge(campaign.status)} variant="subtle" size="sm">
            {campaign.status}
          </StatusBadge>
          <StatusBadge status={severityToBadge(campaign.severity)} variant="subtle" size="sm">
            {campaign.severity}
          </StatusBadge>
          {campaign.actorCount > 5 && (
            <StatusBadge status="accent" variant="subtle" size="sm">
              Cross-Tenant
            </StatusBadge>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatMini icon={Users} label="Actors" value={campaign.actorCount.toString()} />
        <StatMini
          icon={Activity}
          label="Confidence"
          value={`${Math.round(campaign.confidence * 100)}%`}
        />
        <StatMini
          icon={Clock}
          label="First Seen"
          value={new Date(campaign.firstSeen).toLocaleDateString()}
        />
        <StatMini
          icon={Target}
          label="Last Seen"
          value={new Date(campaign.lastSeen).toLocaleTimeString()}
        />
      </div>

      {/* Campaign Correlation Graph */}
      <ErrorBoundary>
        <CampaignGraph campaignId={id} />
      </ErrorBoundary>

      <section className="card">
        <div className="card-header">
          <h2 className="font-medium text-ink-primary">Campaign Velocity</h2>
        </div>
        <div className="card-body h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={velocityData}>
              <CartesianGrid {...gridDefaultsSoft} />
              <XAxis dataKey="time" {...xAxisNoLine} />
              <YAxis {...axisDefaults.y} />
              <Tooltip {...tooltipDefaults} />
              <Area
                type="monotone"
                dataKey="volume"
                stroke={colors.red}
                fill={colors.red}
                fillOpacity={0.25}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="card-header">
            <h2 className="font-medium text-ink-primary">Correlation Signals</h2>
          </div>
          <div className="card-body space-y-4">
            {signals.length === 0 && (
              <div className="text-ink-muted">No correlation signals yet.</div>
            )}
            {signals.map((signal) => (
              <div key={signal.type} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-secondary">{signal.type}</span>
                  <span className="text-ink-primary font-medium">
                    {Math.round(signal.confidence * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-surface-subtle border border-border-subtle">
                  <div
                    className="h-full"
                    style={{
                      background: colors.green,
                      width: `${Math.round(signal.confidence * 100)}%`,
                    }}
                  />
                </div>
                {signal.reason && <p className="text-xs text-ink-muted">{signal.reason}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-medium text-ink-primary">Associated Actors</h2>
            <Button variant="outlined" size="sm">
              Add to Watchlist
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Actors associated with this campaign</caption>
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Risk</th>
                  <th>IPs</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {actors.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-ink-muted">
                      No actors linked yet.
                    </td>
                  </tr>
                )}
                {actors.map((actor) => (
                  <tr key={actor.actorId}>
                    <td className="font-mono text-sm text-ink-primary">
                      <Link
                        to={`/actors/${actor.actorId}`}
                        className="text-link hover:text-link-hover"
                      >
                        {actor.actorId}
                      </Link>
                    </td>
                    <td className="text-ink-secondary">{Math.round(actor.riskScore)}</td>
                    <td className="text-ink-secondary">{actor.ips.length}</td>
                    <td className="text-ink-secondary">
                      {new Date(actor.lastSeen).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Participating IPs & Affected Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-medium text-ink-primary">Participating IPs</h2>
            <Button variant="outlined" size="sm">
              Block All
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">IP addresses participating in this campaign</caption>
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Hits</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {demoParticipatingIps.map((ip) => (
                  <tr key={ip.ip}>
                    <td className="font-mono text-sm text-ink-primary">{ip.ip}</td>
                    <td className="text-ink-secondary">{ip.hits.toLocaleString()}</td>
                    <td>
                      <StatusBadge
                        status={ip.status === 'BLOCKED' ? 'error' : 'warning'}
                        variant="subtle"
                        size="sm"
                      >
                        {ip.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-medium text-ink-primary">Affected Customers</h2>
            <Button variant="outlined" size="sm">
              View All
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Customers affected by this campaign</caption>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Attempts</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {demoAffectedCustomers.map((customer) => (
                  <tr key={customer.name}>
                    <td className="text-ink-primary">{customer.name}</td>
                    <td className="text-ink-secondary">{customer.attempts.toLocaleString()}</td>
                    <td>
                      <StatusBadge
                        status={customer.status === 'ACTIVE' ? 'error' : 'success'}
                        variant="subtle"
                        size="sm"
                      >
                        {customer.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Response Actions */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <ActionButton icon={Swords} label="Block All IPs" tone={colors.red} />
        <ActionButton icon={Shield} label="Block Fingerprint" tone={colors.red} />
        <ActionButton icon={Network} label="Block ASN" tone={colors.red} />
        <ActionButton icon={Flame} label="Challenge Mode" tone={colors.orange} />
        <ActionButton icon={ExternalLink} label="Export IOCs" tone={colors.blue} />
        <ActionButton icon={Building} label="Notify Customers" tone={colors.blue} />
      </section>
    </div>
  );
}

function StatMini({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-surface-subtle flex items-center justify-center">
        <Icon aria-hidden="true" className="w-5 h-5" style={{ color: colors.blue }} />
      </div>
      <div>
        <p className="text-xs tracking-[0.2em] uppercase text-ink-muted">{label}</p>
        <p className="text-lg font-medium text-ink-primary mt-1">{value}</p>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Target;
  label: string;
  tone: string;
}) {
  return (
    <Button
      size="sm"
      fill
      icon={<Icon aria-hidden="true" className="w-4 h-4" />}
      style={{
        background: tone,
        border: `1px solid ${alpha(tone, 0.6)}`,
        color: '#FFFFFF',
      }}
    >
      {label}
    </Button>
  );
}

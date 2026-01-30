import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Target,
  Clock,
  Users,
  Shield,
  Activity,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
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
import type { SocCampaign, SocCampaignActor, SocCampaignDetailResponse, SocCampaignActorsResponse, SocCampaignSignal } from '../../types/soc';

const demoSignals: SocCampaignSignal[] = [
  { type: 'HTTP Fingerprint Match', confidence: 0.96, reason: 'Shared fingerprint across 4 sensors.' },
  { type: 'Timing Correlation', confidence: 0.89, reason: 'Burst pattern repeats every 15 minutes.' },
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
      <div className="p-6">
        <div className="card p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-ink-muted mx-auto mb-3" />
          <p className="text-ink-secondary">Campaign not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link to="/campaigns" className="text-sm text-link hover:text-link-hover">
            Back to Campaigns
          </Link>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-light text-ink-primary">{campaign.name}</h1>
            <span
              className={clsx(
                'px-2 py-0.5 text-xs border',
                campaign.status === 'ACTIVE' && 'bg-ac-red/15 text-ac-red border-ac-red/40',
                campaign.status === 'DETECTED' && 'bg-ac-orange/15 text-ac-orange border-ac-orange/40',
                campaign.status === 'DORMANT' && 'bg-ac-blue/10 text-ac-blue border-ac-blue/40',
                campaign.status === 'RESOLVED' && 'bg-ac-green/10 text-ac-green border-ac-green/40'
              )}
            >
              {campaign.status}
            </span>
            <span
              className={clsx(
                'px-2 py-0.5 text-xs border',
                campaign.severity === 'CRITICAL' && 'bg-ac-red/15 text-ac-red border-ac-red/40',
                campaign.severity === 'HIGH' && 'bg-ac-orange/20 text-ac-orange border-ac-orange/40',
                campaign.severity === 'MEDIUM' && 'bg-ac-orange/10 text-ac-orange border-ac-orange/30',
                campaign.severity === 'LOW' && 'bg-ac-blue/10 text-ac-blue border-ac-blue/30'
              )}
            >
              {campaign.severity}
            </span>
          </div>
          <p className="text-ink-secondary mt-2">
            {campaign.summary ?? 'Coordinated campaign detected across multiple signals.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline h-10 px-4 text-xs">
            <ExternalLink className="w-4 h-4 mr-2" />
            Export IOCs
          </button>
          <button className="btn-primary h-10 px-4 text-xs">
            <Shield className="w-4 h-4 mr-2" />
            Resolve Campaign
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatMini icon={Users} label="Actors" value={campaign.actorCount.toString()} />
        <StatMini icon={Activity} label="Confidence" value={`${Math.round(campaign.confidence * 100)}%`} />
        <StatMini icon={Clock} label="First Seen" value={new Date(campaign.firstSeen).toLocaleDateString()} />
        <StatMini icon={Target} label="Last Seen" value={new Date(campaign.lastSeen).toLocaleTimeString()} />
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="font-medium text-ink-primary">Campaign Velocity</h2>
        </div>
        <div className="card-body h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={velocityData}>
              <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="4 4" />
              <XAxis dataKey="time" stroke="var(--text-muted)" />
              <YAxis stroke="var(--text-muted)" />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-base)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
              <Area type="monotone" dataKey="volume" stroke="var(--ac-red)" fill="var(--ac-red)" fillOpacity={0.25} />
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
            {signals.length === 0 && <div className="text-ink-muted">No correlation signals yet.</div>}
            {signals.map((signal) => (
              <div key={signal.type} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-secondary">{signal.type}</span>
                  <span className="text-ink-primary font-medium">{Math.round(signal.confidence * 100)}%</span>
                </div>
                <div className="h-2 bg-surface-subtle border border-border-subtle">
                  <div
                    className="h-full bg-ac-green"
                    style={{ width: `${Math.round(signal.confidence * 100)}%` }}
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
            <button className="btn-outline h-8 px-3 text-xs">Add to Watchlist</button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
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
                      <Link to={`/actors/${actor.actorId}`} className="text-link hover:text-link-hover">
                        {actor.actorId}
                      </Link>
                    </td>
                    <td className="text-ink-secondary">{Math.round(actor.riskScore)}</td>
                    <td className="text-ink-secondary">{actor.ips.length}</td>
                    <td className="text-ink-secondary">{new Date(actor.lastSeen).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
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
      <div className="w-10 h-10 rounded-full bg-surface-subtle flex items-center justify-center text-ink-muted">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs tracking-[0.2em] uppercase text-ink-muted">{label}</p>
        <p className="text-lg font-medium text-ink-primary mt-1">{value}</p>
      </div>
    </div>
  );
}

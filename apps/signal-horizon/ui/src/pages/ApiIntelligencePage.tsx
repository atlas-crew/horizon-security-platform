
import {
  BarChart3,
  Search,
  ShieldAlert,
  FileCode,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import { useApiIntelligence } from '../hooks/useApiIntelligence';
import { LoadingSpinner, StatsGridSkeleton, TableSkeleton } from '../components/LoadingStates';

export default function ApiIntelligencePage() {
  const { stats, endpoints, signals, isLoading, error } = useApiIntelligence();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light text-ink-primary">API Intelligence</h1>
            <p className="text-ink-secondary mt-1">Discover endpoints and monitor schema compliance</p>
          </div>
        </div>
        <StatsGridSkeleton />
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-ac-red">
        <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
        <h2 className="text-xl">Failed to load API Intelligence</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-light text-ink-primary">API Intelligence</h1>
          <p className="text-ink-secondary mt-1">
            Fleet-wide endpoint discovery and schema validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline h-9 px-3 text-xs">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search endpoints..."
              className="h-9 pl-9 pr-4 bg-surface-base border border-border-subtle rounded text-sm w-64 focus:border-link focus:ring-1 focus:ring-link outline-none"
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Endpoints"
          value={stats?.totalEndpoints ?? 0}
          sublabel={`+${stats?.newThisWeek ?? 0} new this week`}
          icon={FileCode}
          tone="text-ac-blue"
        />
        <StatCard
          label="Schema Violations (24h)"
          value={stats?.schemaViolations24h ?? 0}
          sublabel={`${stats?.schemaViolations7d ?? 0} in 7 days`}
          icon={ShieldAlert}
          tone="text-ac-orange"
        />
        <StatCard
          label="Coverage"
          value="94%"
          sublabel="Endpoints with schema"
          icon={CheckCircle}
          tone="text-ac-green"
        />
        <StatCard
          label="Discovery Rate"
          value={`+${stats?.newToday ?? 0}`}
          sublabel="New endpoints today"
          icon={BarChart3}
          tone="text-ac-purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card h-80">
          <div className="card-header">
            <h2 className="font-medium text-ink-primary">Discovery Trend (7 Days)</h2>
          </div>
          <div className="card-body h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.discoveryTrend ?? []}>
                <defs>
                  <linearGradient id="colorDiscovery" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--ac-blue)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--ac-blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface-base)', borderColor: 'var(--border-subtle)' }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--ac-blue)" fillOpacity={1} fill="url(#colorDiscovery)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card h-80">
          <div className="card-header">
            <h2 className="font-medium text-ink-primary">Top Violating Endpoints</h2>
          </div>
          <div className="card-body h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.topViolatingEndpoints ?? []} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-subtle)" />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={12} hide />
                <YAxis dataKey="endpoint" type="category" width={150} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-subtle)' }}
                  contentStyle={{ backgroundColor: 'var(--surface-base)', borderColor: 'var(--border-subtle)' }}
                />
                <Bar dataKey="violationCount" fill="var(--ac-orange)" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints Table */}
        <div className="card lg:col-span-2">
          <div className="card-header flex justify-between items-center">
            <h2 className="font-medium text-ink-primary">Discovered Endpoints</h2>
            <span className="text-xs text-ink-muted">{stats?.totalEndpoints} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-ink-muted uppercase bg-surface-subtle border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Schema</th>
                  <th className="px-4 py-3">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {endpoints.map((ep) => (
                  <tr key={ep.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      <span className={clsx(
                        'px-2 py-0.5 rounded',
                        ep.method === 'GET' && 'bg-ac-blue/10 text-ac-blue',
                        ep.method === 'POST' && 'bg-ac-green/10 text-ac-green',
                        ep.method === 'DELETE' && 'bg-ac-red/10 text-ac-red',
                        ep.method === 'PUT' && 'bg-ac-orange/10 text-ac-orange',
                      )}>{ep.method}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-primary">{ep.path}</td>
                    <td className="px-4 py-3 text-ink-secondary">{ep.service}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-0.5 text-xs rounded border',
                        ep.riskLevel === 'critical' && 'bg-ac-red/10 text-ac-red border-ac-red/30',
                        ep.riskLevel === 'high' && 'bg-ac-orange/10 text-ac-orange border-ac-orange/30',
                        ep.riskLevel === 'medium' && 'bg-ac-yellow/10 text-ac-yellow border-ac-yellow/30',
                        ep.riskLevel === 'low' && 'bg-ac-blue/10 text-ac-blue border-ac-blue/30',
                      )}>
                        {ep.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ep.hasSchema ? (
                        <CheckCircle className="w-4 h-4 text-ac-green" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-ac-orange" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted text-xs">
                      {new Date(ep.lastSeenAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Violations Feed */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-medium text-ink-primary">Recent Violations</h2>
          </div>
          <div className="card-body space-y-4 max-h-[600px] overflow-y-auto">
            {signals.map((signal) => (
              <div key={signal.id} className="p-3 bg-surface-subtle rounded border border-border-subtle">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-mono text-xs font-semibold text-ac-red bg-ac-red/10 px-1.5 py-0.5 rounded">
                    {signal.metadata.violationType || 'SCHEMA_VIOLATION'}
                  </span>
                  <span className="text-[10px] text-ink-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(signal.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm font-medium text-ink-primary mb-1">
                  {signal.metadata.method} {signal.metadata.endpoint}
                </div>
                <div className="text-xs text-ink-secondary">
                  {signal.metadata.violationMessage || 'Request did not match schema definition.'}
                </div>
              </div>
            ))}
            {signals.length === 0 && (
              <div className="text-center text-ink-muted py-8">
                No recent violations
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sublabel, icon: Icon, tone }: any) {
  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <div className="text-xs tracking-wider uppercase text-ink-muted mb-1">{label}</div>
        <div className="text-2xl font-light text-ink-primary">{value}</div>
        <div className="text-xs text-ink-secondary mt-1">{sublabel}</div>
      </div>
      <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center bg-surface-subtle", tone)}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SensorStatusBadge, MetricCard } from '../../components/fleet';
import type { SensorDetail, PerformanceMetric } from '../../types/fleet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003';

type TabType = 'overview' | 'performance' | 'configuration';

async function fetchSensorDetail(id: string): Promise<SensorDetail> {
  const response = await fetch(`${API_BASE}/api/fleet/sensors/${id}`);
  if (!response.ok) throw new Error('Failed to fetch sensor details');
  return response.json();
}

async function fetchPerformance(id: string): Promise<PerformanceMetric[]> {
  const response = await fetch(`${API_BASE}/api/fleet/sensors/${id}/performance`);
  if (!response.ok) throw new Error('Failed to fetch performance');
  return response.json();
}

export function SensorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { data: sensor, isLoading } = useQuery({
    queryKey: ['fleet', 'sensor', id],
    queryFn: () => fetchSensorDetail(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const { data: performance = [] } = useQuery({
    queryKey: ['fleet', 'sensor', id, 'performance'],
    queryFn: () => fetchPerformance(id!),
    enabled: !!id && activeTab === 'performance',
    refetchInterval: 5000,
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/fleet/sensors/${id}/restart`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to restart sensor');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fleet', 'sensor', id] }),
  });

  const pushConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/fleet/sensors/${id}/config`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to push config');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fleet', 'sensor', id] }),
  });

  if (isLoading || !sensor) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading sensor details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/fleet')}
            className="mb-2 text-sm text-[#0057B7] hover:text-[#001E62] flex items-center gap-1"
          >
            ← Back to Fleet
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{sensor.name}</h1>
          <div className="mt-2 flex items-center gap-4">
            <SensorStatusBadge status={sensor.status} />
            <span className="text-sm text-gray-600">ID: {sensor.id}</span>
            <span className="text-sm text-gray-600">v{sensor.version}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => restartMutation.mutate()}
            disabled={restartMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0057B7] hover:bg-[#001E62] disabled:opacity-50"
          >
            {restartMutation.isPending ? 'Restarting...' : 'Restart'}
          </button>
          <button
            onClick={() => pushConfigMutation.mutate()}
            disabled={pushConfigMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-[#0057B7] border border-[#0057B7] hover:bg-[#0057B7] hover:text-white disabled:opacity-50"
          >
            {pushConfigMutation.isPending ? 'Pushing...' : 'Push Config'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-8">
          {(['overview', 'performance', 'configuration'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-[#0057B7] text-[#0057B7]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="CPU Usage" value={`${sensor.cpu.toFixed(1)}%`} />
            <MetricCard label="Memory Usage" value={`${sensor.memory.toFixed(1)}%`} />
            <MetricCard label="Requests/sec" value={sensor.rps.toLocaleString()} />
            <MetricCard label="Latency" value={`${sensor.latencyMs.toFixed(0)}ms`} />
          </div>
          <div className="bg-white border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sensor Information</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Region</dt>
                <dd className="text-sm text-gray-900">{sensor.region}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Uptime</dt>
                <dd className="text-sm text-gray-900">
                  {Math.floor(sensor.uptime / 86400)}d {Math.floor((sensor.uptime % 86400) / 3600)}h
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Last Seen</dt>
                <dd className="text-sm text-gray-900">{new Date(sensor.lastSeen).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Config Version</dt>
                <dd className="text-sm text-gray-900">{sensor.configVersion}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500">Errors</dt>
                <dd className="text-sm text-gray-900">{sensor.errors}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance (Last Hour)</h3>
          {performance.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No performance data available</div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-2">
              {performance.slice(-20).map((metric, idx) => (
                <div key={idx} className="flex-1 bg-[#0057B7]" style={{ height: `${metric.cpu}%` }} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'configuration' && (
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
          <pre className="bg-gray-50 p-4 font-mono text-sm text-gray-800">
{JSON.stringify({
  version: sensor.configVersion,
  sensor_id: sensor.id,
  region: sensor.region,
  collection_interval: 5000,
  buffer_size: 10000,
  compression: true,
}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

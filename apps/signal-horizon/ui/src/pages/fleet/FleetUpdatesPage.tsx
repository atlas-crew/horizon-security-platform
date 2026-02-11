import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MetricCard, SensorStatusBadge } from '../../components/fleet';
import { useSensors } from '../../hooks/fleet';
import { Button, SectionHeader, alpha, colors } from '@/ui';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';
const authHeaders = { Authorization: `Bearer ${API_KEY}` };
const CARD_HEADER_TITLE_STYLE = {
  fontSize: '18px',
  lineHeight: '28px',
  fontWeight: 500,
  color: 'var(--text-primary)',
};

interface SensorVersion {
  sensorId: string;
  name: string;
  currentVersion: string;
  targetVersion?: string;
  updateStatus: 'up_to_date' | 'update_available' | 'updating' | 'failed';
  lastUpdated?: string;
}

interface AvailableUpdate {
  version: string;
  releaseDate: string;
  changelog: string[];
  critical: boolean;
}

async function fetchVersions(): Promise<SensorVersion[]> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/updates/versions`, {
    headers: authHeaders,
  });
  if (!response.ok) throw new Error('Failed to fetch versions');
  return response.json();
}

async function fetchAvailableUpdates(): Promise<AvailableUpdate[]> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/updates/available`, {
    headers: authHeaders,
  });
  if (!response.ok) throw new Error('Failed to fetch updates');
  return response.json();
}

async function triggerUpdate(sensorIds: string[], version: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/updates/trigger`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sensorIds, version }),
  });
  if (!response.ok) throw new Error('Failed to trigger update');
}

export function FleetUpdatesPage() {
  const queryClient = useQueryClient();
  const [selectedSensors, setSelectedSensors] = useState<Set<string>>(new Set());
  const [targetVersion, setTargetVersion] = useState<string>('');

  const { data: sensors = [] } = useSensors();

  const { data: versions = [] } = useQuery({
    queryKey: ['fleet', 'updates', 'versions'],
    queryFn: fetchVersions,
    refetchInterval: 30000,
  });

  const { data: availableUpdates = [] } = useQuery({
    queryKey: ['fleet', 'updates', 'available'],
    queryFn: fetchAvailableUpdates,
  });

  const updateMutation = useMutation({
    mutationFn: () => triggerUpdate(Array.from(selectedSensors), targetVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'updates'] });
      setSelectedSensors(new Set());
    },
  });

  const toggleSensor = useCallback((sensorId: string) => {
    setSelectedSensors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sensorId)) newSet.delete(sensorId);
      else newSet.add(sensorId);
      return newSet;
    });
  }, []);

  // Single-pass optimization for sensor versions + status counts
  const { sensorVersions, statusCounts } = useMemo(() => {
    const merged = sensors.map((sensor) => {
      const version = versions.find((v) => v.sensorId === sensor.id);
      return {
        ...sensor,
        currentVersion: version?.currentVersion ?? sensor.version,
        updateStatus: version?.updateStatus ?? 'up_to_date',
        lastUpdated: version?.lastUpdated,
      };
    });

    const counts = merged.reduce(
      (acc, s) => {
        acc[s.updateStatus]++;
        return acc;
      },
      { up_to_date: 0, update_available: 0, updating: 0, failed: 0 },
    );

    return {
      sensorVersions: merged,
      statusCounts: {
        upToDate: counts.up_to_date,
        needsUpdate: counts.update_available,
        updating: counts.updating,
        failed: counts.failed,
      },
    };
  }, [sensors, versions]);

  const { upToDate, needsUpdate, updating, failed } = statusCounts;

  const statusStyles: Record<
    SensorVersion['updateStatus'],
    { bg: string; text: string; border: string }
  > = {
    up_to_date: {
      bg: alpha(colors.green, 0.1),
      text: colors.green,
      border: alpha(colors.green, 0.3),
    },
    update_available: {
      bg: alpha(colors.orange, 0.1),
      text: colors.orange,
      border: alpha(colors.orange, 0.3),
    },
    updating: {
      bg: alpha(colors.blue, 0.1),
      text: colors.blue,
      border: alpha(colors.blue, 0.3),
    },
    failed: {
      bg: alpha(colors.red, 0.1),
      text: colors.red,
      border: alpha(colors.red, 0.3),
    },
  };

  const statusLabels = {
    up_to_date: 'Up to Date',
    update_available: 'Update Available',
    updating: 'Updating...',
    failed: 'Update Failed',
  };

  return (
    <div className="space-y-6 p-6">
      <SectionHeader
        title="Fleet Updates"
        description="Manage sensor firmware and software updates"
        actions={
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={selectedSensors.size === 0 || !targetVersion || updateMutation.isPending}
            size="lg"
          >
            {updateMutation.isPending ? 'Updating...' : `Update Selected (${selectedSensors.size})`}
          </Button>
        }
      />

      {/* Status Overview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard label="Up to Date" value={upToDate} />
        <MetricCard label="Needs Update" value={needsUpdate} />
        <MetricCard label="Updating" value={updating} />
        <MetricCard label="Failed" value={failed} />
      </div>

      {/* Available Updates */}
      {availableUpdates.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-ink-primary mb-4">Available Updates</h3>
          <div className="space-y-4">
            {availableUpdates.map((update) => (
              <div
                key={update.version}
                className="p-4 border"
                style={
                  update.critical
                    ? {
                        borderColor: alpha(colors.red, 0.4),
                        background: alpha(colors.red, 0.1),
                      }
                    : { borderColor: alpha(colors.white, 0.08) }
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-medium text-ink-primary">
                        Version {update.version}
                      </span>
                      {update.critical && (
                        <span
                          className="px-2 py-0.5 text-xs font-medium border"
                          style={{
                            background: alpha(colors.red, 0.15),
                            color: colors.red,
                            borderColor: alpha(colors.red, 0.3),
                          }}
                        >
                          Critical
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-ink-muted mt-1">
                      Released {new Date(update.releaseDate).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    onClick={() => setTargetVersion(update.version)}
                    variant={targetVersion === update.version ? 'primary' : 'outlined'}
                    size="sm"
                  >
                    {targetVersion === update.version ? 'Selected' : 'Select'}
                  </Button>
                </div>
                <ul className="mt-3 space-y-1">
                  {update.changelog.map((item, idx) => (
                    <li key={idx} className="text-sm text-ink-secondary flex items-start gap-2">
                      <span className="text-ink-muted">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensor Versions Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <SectionHeader
            title="Sensor Versions"
            size="h4"
            style={{ marginBottom: 0 }}
            titleStyle={CARD_HEADER_TITLE_STYLE}
            actions={
              <div className="flex gap-2">
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() =>
                    setSelectedSensors(
                      new Set(
                        sensorVersions
                          .filter((s) => s.updateStatus === 'update_available')
                          .map((s) => s.id),
                      ),
                    )
                  }
                >
                  Select Outdated
                </Button>
                <Button variant="outlined" size="sm" onClick={() => setSelectedSensors(new Set())}>
                  Clear Selection
                </Button>
              </div>
            }
          />
        </div>

        <table className="min-w-full divide-y divide-border-subtle">
          <caption className="sr-only">Fleet sensor versions and update status</caption>
          <thead className="bg-surface-subtle">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-widest">
                Select
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-widest">
                Sensor
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-widest">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-widest">
                Current Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-widest">
                Update Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-widest">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface-base divide-y divide-border-subtle">
            {sensorVersions.map((sensor) => (
              <tr key={sensor.id} className="hover:bg-surface-subtle">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedSensors.has(sensor.id)}
                    onChange={() => toggleSensor(sensor.id)}
                    disabled={sensor.updateStatus === 'updating'}
                    className="w-4 h-4 border-border-subtle disabled:opacity-50"
                    style={{ accentColor: colors.blue }}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-ink-primary">{sensor.name}</span>
                    <span className="text-sm text-ink-muted">{sensor.region}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <SensorStatusBadge status={sensor.status} />
                </td>
                <td className="px-6 py-4 text-sm text-ink-primary font-mono">
                  {sensor.currentVersion}
                </td>
                <td className="px-6 py-4">
                  <span
                    className="px-2 py-1 text-xs font-medium border"
                    style={{
                      background: statusStyles[sensor.updateStatus].bg,
                      color: statusStyles[sensor.updateStatus].text,
                      borderColor: statusStyles[sensor.updateStatus].border,
                    }}
                  >
                    {statusLabels[sensor.updateStatus]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-ink-muted">
                  {sensor.lastUpdated ? new Date(sensor.lastUpdated).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MetricCard, SensorStatusBadge } from '../../components/fleet';
import { useSensors } from '../../hooks/fleet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003';

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
  const response = await fetch(`${API_BASE}/api/fleet/updates/versions`);
  if (!response.ok) throw new Error('Failed to fetch versions');
  return response.json();
}

async function fetchAvailableUpdates(): Promise<AvailableUpdate[]> {
  const response = await fetch(`${API_BASE}/api/fleet/updates/available`);
  if (!response.ok) throw new Error('Failed to fetch updates');
  return response.json();
}

async function triggerUpdate(sensorIds: string[], version: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/fleet/updates/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const toggleSensor = (sensorId: string) => {
    const newSet = new Set(selectedSensors);
    if (newSet.has(sensorId)) newSet.delete(sensorId);
    else newSet.add(sensorId);
    setSelectedSensors(newSet);
  };

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
      { up_to_date: 0, update_available: 0, updating: 0, failed: 0 }
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

  const statusColors = {
    up_to_date: 'bg-green-100 text-green-800',
    update_available: 'bg-yellow-100 text-yellow-800',
    updating: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
  };

  const statusLabels = {
    up_to_date: 'Up to Date',
    update_available: 'Update Available',
    updating: 'Updating...',
    failed: 'Update Failed',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fleet Updates</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage sensor firmware and software updates
          </p>
        </div>
        <button
          onClick={() => updateMutation.mutate()}
          disabled={selectedSensors.size === 0 || !targetVersion || updateMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-[#0057B7] hover:bg-[#001E62] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending
            ? 'Updating...'
            : `Update Selected (${selectedSensors.size})`}
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard label="Up to Date" value={upToDate} className="border-green-200" />
        <MetricCard
          label="Needs Update"
          value={needsUpdate}
          className={needsUpdate > 0 ? 'border-yellow-200' : ''}
        />
        <MetricCard
          label="Updating"
          value={updating}
          className={updating > 0 ? 'border-blue-200' : ''}
        />
        <MetricCard
          label="Failed"
          value={failed}
          className={failed > 0 ? 'border-red-200' : ''}
        />
      </div>

      {/* Available Updates */}
      {availableUpdates.length > 0 && (
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Updates</h3>
          <div className="space-y-4">
            {availableUpdates.map((update) => (
              <div
                key={update.version}
                className={`p-4 border ${
                  update.critical ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-medium text-gray-900">
                        Version {update.version}
                      </span>
                      {update.critical && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                          Critical
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Released {new Date(update.releaseDate).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setTargetVersion(update.version)}
                    className={`px-3 py-1.5 text-sm font-medium ${
                      targetVersion === update.version
                        ? 'bg-[#0057B7] text-white'
                        : 'border border-[#0057B7] text-[#0057B7] hover:bg-[#0057B7] hover:text-white'
                    }`}
                  >
                    {targetVersion === update.version ? 'Selected' : 'Select'}
                  </button>
                </div>
                <ul className="mt-3 space-y-1">
                  {update.changelog.map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-gray-400">•</span>
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
      <div className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Sensor Versions</h2>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setSelectedSensors(
                  new Set(
                    sensorVersions
                      .filter((s) => s.updateStatus === 'update_available')
                      .map((s) => s.id)
                  )
                )
              }
              className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
            >
              Select Outdated
            </button>
            <button
              onClick={() => setSelectedSensors(new Set())}
              className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
            >
              Clear Selection
            </button>
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Select
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Sensor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Current Version
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Update Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sensorVersions.map((sensor) => (
              <tr key={sensor.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedSensors.has(sensor.id)}
                    onChange={() => toggleSensor(sensor.id)}
                    disabled={sensor.updateStatus === 'updating'}
                    className="w-4 h-4 text-[#0057B7] border-gray-300 disabled:opacity-50"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{sensor.name}</span>
                    <span className="text-sm text-gray-500">{sensor.region}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <SensorStatusBadge status={sensor.status} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                  {sensor.currentVersion}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium ${statusColors[sensor.updateStatus]}`}
                  >
                    {statusLabels[sensor.updateStatus]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {sensor.lastUpdated
                    ? new Date(sensor.lastUpdated).toLocaleDateString()
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

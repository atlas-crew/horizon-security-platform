import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MetricCard, SensorStatusBadge } from '../../components/fleet';
import { useSensors } from '../../hooks/fleet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003';

interface Rule {
  id: string;
  name: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  category: string;
  createdAt: string;
}

interface RuleSyncStatus {
  sensorId: string;
  totalRules: number;
  syncedRules: number;
  pendingRules: number;
  failedRules: number;
  lastSync?: string;
}

type RolloutStrategy = 'immediate' | 'canary' | 'scheduled';

async function fetchRules(): Promise<Rule[]> {
  const response = await fetch(`${API_BASE}/api/fleet/rules`);
  if (!response.ok) throw new Error('Failed to fetch rules');
  return response.json();
}

async function fetchRuleSyncStatus(): Promise<RuleSyncStatus[]> {
  const response = await fetch(`${API_BASE}/api/fleet/rules/sync-status`);
  if (!response.ok) throw new Error('Failed to fetch sync status');
  return response.json();
}

async function pushRules(
  ruleIds: string[],
  sensorIds: string[],
  strategy: RolloutStrategy
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/fleet/rules/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruleIds, sensorIds, strategy }),
  });
  if (!response.ok) throw new Error('Failed to push rules');
}

export function RuleDistributionPage() {
  const queryClient = useQueryClient();
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [selectedSensors, setSelectedSensors] = useState<Set<string>>(new Set());
  const [rolloutStrategy, setRolloutStrategy] = useState<RolloutStrategy>('immediate');
  const [showDeployModal, setShowDeployModal] = useState(false);

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['fleet', 'rules'],
    queryFn: fetchRules,
  });

  const { data: syncStatus = [] } = useQuery({
    queryKey: ['fleet', 'rules', 'sync-status'],
    queryFn: fetchRuleSyncStatus,
    refetchInterval: 10000,
  });

  const { data: sensors = [] } = useSensors();

  const pushMutation = useMutation({
    mutationFn: () =>
      pushRules(Array.from(selectedRules), Array.from(selectedSensors), rolloutStrategy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'rules'] });
      setShowDeployModal(false);
      setSelectedRules(new Set());
      setSelectedSensors(new Set());
    },
  });

  const toggleRule = (ruleId: string) => {
    const newSet = new Set(selectedRules);
    if (newSet.has(ruleId)) newSet.delete(ruleId);
    else newSet.add(ruleId);
    setSelectedRules(newSet);
  };

  const toggleSensor = (sensorId: string) => {
    const newSet = new Set(selectedSensors);
    if (newSet.has(sensorId)) newSet.delete(sensorId);
    else newSet.add(sensorId);
    setSelectedSensors(newSet);
  };

  const totalSynced = syncStatus.reduce((sum, s) => sum + s.syncedRules, 0);
  const totalPending = syncStatus.reduce((sum, s) => sum + s.pendingRules, 0);
  const totalFailed = syncStatus.reduce((sum, s) => sum + s.failedRules, 0);

  const severityColors = {
    low: 'bg-gray-100 text-gray-800 border-gray-200',
    medium: 'bg-blue-100 text-blue-800 border-blue-200',
    high: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rule Distribution</h1>
          <p className="mt-1 text-sm text-gray-600">
            Deploy and manage WAF rules across your sensor fleet
          </p>
        </div>
        <button
          onClick={() => setShowDeployModal(true)}
          disabled={selectedRules.size === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-[#0057B7] hover:bg-[#001E62] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Deploy Selected ({selectedRules.size})
        </button>
      </div>

      {/* Sync Status */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard label="Total Rules" value={rules.length} />
        <MetricCard label="Synced" value={totalSynced} className="border-green-200" />
        <MetricCard
          label="Pending"
          value={totalPending}
          className={totalPending > 0 ? 'border-yellow-200' : ''}
        />
        <MetricCard
          label="Failed"
          value={totalFailed}
          className={totalFailed > 0 ? 'border-red-200' : ''}
        />
      </div>

      {/* Rules Table */}
      <div className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">WAF Rules</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedRules(new Set(rules.map((r) => r.id)))}
              className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedRules(new Set())}
              className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
            >
              Clear Selection
            </button>
          </div>
        </div>

        {rulesLoading ? (
          <div className="p-12 text-center text-gray-500">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No rules found.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Select
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedRules.has(rule.id)}
                      onChange={() => toggleRule(rule.id)}
                      className="w-4 h-4 text-[#0057B7] border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    {rule.description && (
                      <div className="text-sm text-gray-500">{rule.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{rule.category}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium border ${severityColors[rule.severity]}`}
                    >
                      {rule.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium ${
                        rule.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Deploy Rules ({selectedRules.size} selected)
            </h2>

            {/* Rollout Strategy */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rollout Strategy
              </label>
              <div className="grid grid-cols-3 gap-4">
                {(['immediate', 'canary', 'scheduled'] as const).map((strategy) => (
                  <button
                    key={strategy}
                    onClick={() => setRolloutStrategy(strategy)}
                    className={`p-4 border text-left ${
                      rolloutStrategy === strategy
                        ? 'border-[#0057B7] bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-medium text-gray-900 capitalize">{strategy}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {strategy === 'immediate' && 'Deploy to all sensors at once'}
                      {strategy === 'canary' && '10% → 50% → 100% rollout'}
                      {strategy === 'scheduled' && 'Deploy at a specific time'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Sensors */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Sensors ({selectedSensors.size === 0 ? 'All' : selectedSensors.size})
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 divide-y divide-gray-200">
                {sensors.map((sensor) => (
                  <label
                    key={sensor.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSensors.has(sensor.id)}
                      onChange={() => toggleSensor(sensor.id)}
                      className="w-4 h-4 text-[#0057B7] border-gray-300"
                    />
                    <SensorStatusBadge status={sensor.status} />
                    <span className="font-medium text-gray-900">{sensor.name}</span>
                    <span className="text-sm text-gray-500">{sensor.region}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => pushMutation.mutate()}
                disabled={pushMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0057B7] hover:bg-[#001E62] disabled:opacity-50"
              >
                {pushMutation.isPending ? 'Deploying...' : 'Deploy Rules'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

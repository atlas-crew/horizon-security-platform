import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MetricCard } from '../../components/fleet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3003';

interface ConfigTemplate {
  id: string;
  name: string;
  description?: string;
  environment: 'production' | 'staging' | 'dev';
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SyncStatus {
  totalSensors: number;
  syncedSensors: number;
  outOfSyncSensors: number;
  errorSensors: number;
  syncPercentage: number;
}

async function fetchTemplates(): Promise<ConfigTemplate[]> {
  const response = await fetch(`${API_BASE}/api/fleet/config/templates`);
  if (!response.ok) throw new Error('Failed to fetch templates');
  return response.json();
}

async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await fetch(`${API_BASE}/api/fleet/config/sync-status`);
  if (!response.ok) throw new Error('Failed to fetch sync status');
  return response.json();
}

async function pushConfig(templateId: string, sensorIds: string[]): Promise<void> {
  const response = await fetch(`${API_BASE}/api/fleet/config/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, sensorIds }),
  });
  if (!response.ok) throw new Error('Failed to push config');
}

export function ConfigManagerPage() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['fleet', 'config', 'templates'],
    queryFn: fetchTemplates,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['fleet', 'config', 'sync-status'],
    queryFn: fetchSyncStatus,
    refetchInterval: 10000,
  });

  const pushMutation = useMutation({
    mutationFn: ({ templateId, sensorIds }: { templateId: string; sensorIds: string[] }) =>
      pushConfig(templateId, sensorIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'config'] });
    },
  });

  const envColors = {
    production: 'bg-red-100 text-red-800 border-red-200',
    staging: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    dev: 'bg-green-100 text-green-800 border-green-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuration Manager</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage and deploy configuration templates across your fleet
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-[#0057B7] hover:bg-[#001E62]"
        >
          Create Template
        </button>
      </div>

      {/* Sync Status */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard label="Total Sensors" value={syncStatus?.totalSensors ?? 0} />
        <MetricCard
          label="In Sync"
          value={syncStatus?.syncedSensors ?? 0}
          className="border-green-200"
        />
        <MetricCard
          label="Out of Sync"
          value={syncStatus?.outOfSyncSensors ?? 0}
          className={syncStatus?.outOfSyncSensors ? 'border-yellow-200' : ''}
        />
        <MetricCard
          label="Sync Errors"
          value={syncStatus?.errorSensors ?? 0}
          className={syncStatus?.errorSensors ? 'border-red-200' : ''}
        />
      </div>

      {/* Sync Progress */}
      {syncStatus && (
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Fleet Sync Status</h3>
            <span className="text-sm text-gray-600">{syncStatus.syncPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200">
            <div
              className="h-3 bg-[#0057B7] transition-all duration-500"
              style={{ width: `${syncStatus.syncPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Templates */}
      <div className="bg-white border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Configuration Templates</h2>
          <div className="flex gap-2">
            {['all', 'production', 'staging', 'dev'].map((env) => (
              <button
                key={env}
                className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 capitalize"
              >
                {env}
              </button>
            ))}
          </div>
        </div>

        {templatesLoading ? (
          <div className="p-12 text-center text-gray-500">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No templates found. Create your first template to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`p-6 hover:bg-gray-50 cursor-pointer ${
                  selectedTemplate === template.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium border ${envColors[template.environment]}`}
                      >
                        {template.environment}
                      </span>
                      {template.isActive && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          Active
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="mt-1 text-sm text-gray-600">{template.description}</p>
                    )}
                    <div className="mt-2 text-xs text-gray-500">
                      Version {template.version} • Updated{' '}
                      {new Date(template.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pushMutation.mutate({ templateId: template.id, sensorIds: [] });
                      }}
                      disabled={pushMutation.isPending}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-[#0057B7] hover:bg-[#001E62] disabled:opacity-50"
                    >
                      {pushMutation.isPending ? 'Pushing...' : 'Push to All'}
                    </button>
                    <button className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Configuration Template</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-[#0057B7]"
                  placeholder="Template name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                <select className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-[#0057B7]">
                  <option value="dev">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-[#0057B7]"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-[#0057B7] hover:bg-[#001E62]">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

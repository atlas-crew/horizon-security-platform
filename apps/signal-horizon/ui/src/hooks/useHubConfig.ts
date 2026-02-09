/**
 * useHubConfig Hook
 *
 * Manages Signal Horizon Hub runtime configuration.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface HubConfig {
  env: string;
  fleetCommands?: {
    enableToggleChaos: boolean;
    enableToggleMtd: boolean;
  };
  server: {
    port: number;
    host: string;
  };
  database: {
    url: string;
  };
  websocket: {
    sensorPath: string;
    dashboardPath: string;
    heartbeatIntervalMs: number;
    maxSensorConnections: number;
    maxDashboardConnections: number;
  };
  aggregator: {
    batchSize: number;
    batchTimeoutMs: number;
  };
  broadcaster: {
    pushDelayMs: number;
    cacheSize: number;
  };
  logging: {
    level: string;
  };
  riskServer: {
    url: string;
  };
  synapseDirect: {
    url?: string;
    enabled: boolean;
  };
  sensorBridge: {
    enabled: boolean;
    sensorId: string;
    sensorName: string;
    heartbeatIntervalMs: number;
  };
}

async function fetchHubConfig(): Promise<HubConfig> {
  return apiFetch<HubConfig>('/management/config');
}

async function updateHubConfig(updates: Partial<HubConfig>): Promise<any> {
  return apiFetch('/management/config', { method: 'PATCH', body: updates });
}

export function useHubConfig() {
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ['hub', 'config'],
    queryFn: fetchHubConfig,
  });

  const updateMutation = useMutation({
    mutationFn: updateHubConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub', 'config'] });
    },
  });

  return {
    config: configQuery.data || null,
    isLoading: configQuery.isLoading,
    error: configQuery.error as Error | null,
    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

export default useHubConfig;

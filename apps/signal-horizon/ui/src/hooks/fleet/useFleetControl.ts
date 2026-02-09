/**
 * useFleetControl Hook
 *
 * Manages fleet-wide operations including batch service control,
 * registration tokens, and global configuration reloads.
 */

import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export type FleetControlCommand = 'reload' | 'restart' | 'shutdown' | 'drain' | 'resume';

interface BatchControlRequest {
  command: FleetControlCommand;
  sensorIds: string[];
  reason?: string;
}

interface BatchControlResult {
  command: FleetControlCommand;
  results: Array<{
    sensorId: string;
    sensorName: string;
    success: boolean;
    message: string;
    state: string;
  }>;
  summary: {
    total: number;
    success: number;
    failure: number;
  };
}

async function executeBatchControl({ command, sensorIds, reason }: BatchControlRequest): Promise<BatchControlResult> {
  return apiFetch<BatchControlResult>(`/fleet-control/batch/control/${command}`, {
    method: 'POST',
    body: { sensorIds, reason },
  });
}

async function revokeAllTokens(): Promise<{ epoch: number }> {
  return apiFetch<{ epoch: number }>('/auth/revoke-all', { method: 'POST' });
}

export function useFleetControl() {
  const batchMutation = useMutation({
    mutationFn: executeBatchControl,
  });

  const revokeAllMutation = useMutation({
    mutationFn: revokeAllTokens,
  });

  return {
    executeBatchControl: batchMutation.mutateAsync,
    isExecutingBatch: batchMutation.isPending,
    batchResult: batchMutation.data || null,
    batchError: batchMutation.error as Error | null,

    revokeAllTokens: revokeAllMutation.mutateAsync,
    isRevokingAll: revokeAllMutation.isPending,
    revokeResult: revokeAllMutation.data || null,
    revokeError: revokeAllMutation.error as Error | null,
  };
}

export default useFleetControl;

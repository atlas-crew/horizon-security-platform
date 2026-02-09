/**
 * usePlaybooks Hook
 *
 * Manages automation playbooks for Signal Horizon.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiFetch } from '../../lib/api';

const EMPTY_PLAYBOOKS: Playbook[] = [];

export interface Playbook {
  id: string;
  name: string;
  description?: string;
  triggerType: 'MANUAL' | 'SIGNAL_SEVERITY' | 'SIGNAL_TYPE';
  triggerValue?: string;
  steps: Array<{
    id: string;
    type: 'manual' | 'command' | 'notification';
    title: string;
    description?: string;
    config?: Record<string, any>;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

async function fetchPlaybooks(): Promise<Playbook[]> {
  const data = await apiFetch<{ playbooks?: Playbook[] }>('/playbooks');
  return data.playbooks ?? EMPTY_PLAYBOOKS;
}

export function usePlaybooks() {
  const queryClient = useQueryClient();

  const playbooksQuery = useQuery({
    queryKey: ['playbooks'],
    queryFn: fetchPlaybooks,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['playbooks'] });
  }, [queryClient]);

  return {
    // Important: keep referential stability when the query is still loading; otherwise
    // downstream useEffects that depend on `playbooks` can loop (max update depth exceeded).
    playbooks: playbooksQuery.data ?? EMPTY_PLAYBOOKS,
    isLoading: playbooksQuery.isLoading,
    error: playbooksQuery.error as Error | null,
    refresh,
  };
}

export default usePlaybooks;

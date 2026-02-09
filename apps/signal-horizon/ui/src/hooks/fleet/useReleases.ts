/**
 * useReleases Hook
 * Manages releases and rollout operations for fleet sensor updates
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDemoMode } from '../../stores/demoModeStore';
import { getDemoData } from '../../lib/demoData';
import { apiFetch } from '../../lib/api';

// ============================================================================
// Types
// ============================================================================

export interface Release {
  id: string;
  version: string;
  changelog: string;
  binaryUrl: string;
  sha256: string;
  size: number;
  createdAt: string;
  createdBy: string;
}

export interface Rollout {
  id: string;
  releaseId: string;
  release: Release;
  strategy: RolloutStrategy;
  status: RolloutStatus;
  targetTags: string[];
  batchSize: number;
  batchDelay: number;
  startedAt?: string;
  completedAt?: string;
  progress: RolloutProgress[];
}

export type RolloutStrategy = 'immediate' | 'canary' | 'rolling';
export type RolloutStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type RolloutProgressStatus = 'pending' | 'downloading' | 'ready' | 'activated' | 'failed';

export interface RolloutProgress {
  sensorId: string;
  sensorName: string;
  status: RolloutProgressStatus;
  updatedAt: string;
  error?: string;
}

export interface CreateReleaseInput {
  version: string;
  changelog: string;
  binaryUrl?: string;
  binaryFile?: File;
  sha256?: string;
}

export interface RolloutConfig {
  strategy: RolloutStrategy;
  targetTags: string[];
  batchSize: number;
  batchDelay: number;
}

export interface UseReleasesOptions {
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Callback when rollout status changes */
  onRolloutStatusChange?: (rollout: Rollout) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export interface UseReleasesResult {
  // Releases
  releases: Release[];
  isLoadingReleases: boolean;
  releasesError: Error | null;
  createRelease: (data: CreateReleaseInput) => Promise<Release>;
  deleteRelease: (id: string) => Promise<void>;
  isCreatingRelease: boolean;
  isDeletingRelease: boolean;

  // Rollouts
  rollouts: Rollout[];
  activeRollout: Rollout | null;
  isLoadingRollouts: boolean;
  rolloutsError: Error | null;
  startRollout: (releaseId: string, config: RolloutConfig) => Promise<Rollout>;
  cancelRollout: (id: string) => Promise<void>;
  isStartingRollout: boolean;
  isCancellingRollout: boolean;

  // Utilities
  refreshReleases: () => void;
  refreshRollouts: () => void;
  clearError: () => void;
  mutationError: Error | null;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchReleases(): Promise<Release[]> {
  const data = await apiFetch<{ releases?: Release[] } | Release[]>('/releases');
  return Array.isArray(data) ? data : (data.releases ?? []);
}

async function createReleaseApi(input: CreateReleaseInput): Promise<Release> {
  if (input.binaryFile) {
    throw new Error('Binary file upload is not supported by the dev hub API (use binaryUrl).');
  }

  return apiFetch<Release>('/releases', {
    method: 'POST',
    body: {
      version: input.version,
      changelog: input.changelog,
      binaryUrl: input.binaryUrl,
      sha256: input.sha256,
      // API requires size; provide a reasonable default if omitted.
      size: (input as any).size ?? 48_102_400,
    },
  });
}

async function deleteReleaseApi(id: string): Promise<void> {
  await apiFetch<void>(`/releases/${id}`, { method: 'DELETE' });
}

async function fetchRollouts(): Promise<Rollout[]> {
  const data = await apiFetch<any>('/releases/rollouts');
  const items: any[] = Array.isArray(data) ? data : (data.rollouts ?? []);

  // API returns a lightweight list; normalize to the UI Rollout contract.
  return items.map((r) => ({
    id: String(r.id),
    releaseId: String(r.releaseId),
    // list endpoint doesn't include expanded release object; keep minimal placeholder
    release: (r.release ??
      ({
        id: String(r.releaseId),
        version: String(r.releaseVersion ?? ''),
        changelog: '',
        binaryUrl: '',
        sha256: '',
        size: 0,
        createdAt: '',
        createdBy: '',
      } as Release)) as any,
    strategy: r.strategy as RolloutStrategy,
    status: r.status as RolloutStatus,
    targetTags: Array.isArray(r.targetTags) ? r.targetTags : [],
    batchSize: Number(r.batchSize ?? 0),
    batchDelay: Number(r.batchDelay ?? 0),
    startedAt: r.startedAt ?? undefined,
    completedAt: r.completedAt ?? undefined,
    progress: Array.isArray(r.progress)
      ? r.progress
      : [], // list endpoint does not include progress
  })) as Rollout[];
}

async function startRolloutApi(releaseId: string, config: RolloutConfig): Promise<Rollout> {
  // Hub API starts a rollout at /releases/:id/rollout
  return apiFetch<Rollout>(`/releases/${releaseId}/rollout`, {
    method: 'POST',
    body: {
      strategy: config.strategy,
      targetTags: config.targetTags,
      batchSize: config.batchSize,
      batchDelay: config.batchDelay,
    },
  });
}

async function cancelRolloutApi(id: string): Promise<void> {
  await apiFetch<void>(`/releases/rollouts/${id}/cancel`, { method: 'POST' });
}

// ============================================================================
// Demo Data Generator
// ============================================================================

function generateDemoReleases(_scenario: string): Release[] {
  const versions = ['2.4.2', '2.4.1', '2.4.0', '2.3.8', '2.3.7', '2.3.6'];
  const changelogs = [
    '### Security Updates\n- Fixed critical vulnerability in rule engine\n- Updated TLS certificates\n\n### Performance\n- Improved memory management\n- Reduced CPU overhead by 15%',
    '### Features\n- Added support for GraphQL introspection blocking\n- New bot detection algorithms\n\n### Bug Fixes\n- Fixed memory leak in connection pool\n- Resolved race condition in config reload',
    '### Improvements\n- Enhanced logging capabilities\n- Better error messages for rule validation\n\n### Bug Fixes\n- Fixed edge case in rate limiting',
    '### Features\n- New API endpoint discovery\n- Enhanced threat intelligence integration\n\n### Performance\n- Optimized regex matching engine',
    '### Bug Fixes\n- Fixed connection timeout issues\n- Resolved certificate validation errors\n\n### Maintenance\n- Updated dependencies',
    '### Initial Release\n- Core WAF functionality\n- Basic rate limiting\n- SQL injection protection',
  ];

  return versions.map((version, index) => {
    const daysAgo = index * 7 + Math.floor(Math.random() * 5);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    return {
      id: `rel-${version.replace(/\./g, '')}`,
      version,
      changelog: changelogs[index] || changelogs[0],
      binaryUrl: `https://releases.atlascrew.io/sensor/${version}/sensor-linux-amd64.tar.gz`,
      sha256: `${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`.substring(0, 64),
      size: Math.floor(Math.random() * 50000000) + 25000000, // 25-75MB
      createdAt: date.toISOString(),
      createdBy: index % 2 === 0 ? 'release-automation' : 'admin@atlascrew.io',
    };
  });
}

function generateDemoRollouts(releases: Release[], sensors: Array<{ id: string; name: string }>, scenario: string): Rollout[] {
  const rollouts: Rollout[] = [];

  // Generate historical rollouts
  for (let i = 1; i < releases.length; i++) {
    const release = releases[i];
    const daysAgo = i * 7 + 3;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2);

    const progress: RolloutProgress[] = sensors.map((sensor) => ({
      sensorId: sensor.id,
      sensorName: sensor.name,
      status: 'activated' as const,
      updatedAt: endDate.toISOString(),
    }));

    rollouts.push({
      id: `roll-${i}`,
      releaseId: release.id,
      release,
      strategy: i % 3 === 0 ? 'immediate' : i % 3 === 1 ? 'canary' : 'rolling',
      status: 'completed',
      targetTags: ['all'],
      batchSize: 10,
      batchDelay: 30,
      startedAt: startDate.toISOString(),
      completedAt: endDate.toISOString(),
      progress,
    });
  }

  // Add an active rollout in high-threat scenario
  if (scenario === 'high-threat' && releases.length > 0) {
    const latestRelease = releases[0];
    const startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - 30);

    const progress: RolloutProgress[] = sensors.map((sensor, index) => {
      let status: RolloutProgressStatus;
      if (index < sensors.length * 0.4) {
        status = 'activated';
      } else if (index < sensors.length * 0.6) {
        status = 'ready';
      } else if (index < sensors.length * 0.75) {
        status = 'downloading';
      } else {
        status = 'pending';
      }

      return {
        sensorId: sensor.id,
        sensorName: sensor.name,
        status,
        updatedAt: new Date().toISOString(),
      };
    });

    rollouts.unshift({
      id: 'roll-active',
      releaseId: latestRelease.id,
      release: latestRelease,
      strategy: 'rolling',
      status: 'in_progress',
      targetTags: ['production'],
      batchSize: 5,
      batchDelay: 60,
      startedAt: startDate.toISOString(),
      progress,
    });
  }

  return rollouts;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useReleases(options: UseReleasesOptions = {}): UseReleasesResult {
  const {
    refreshInterval = 10000,
    onRolloutStatusChange,
    onError,
  } = options;

  const queryClient = useQueryClient();
  const { isEnabled: isDemoMode, scenario } = useDemoMode();

  // Track previous rollout status for change detection
  const previousRolloutStatusRef = useRef<Record<string, RolloutStatus>>({});

  // Mutation error state (for operations beyond query errors)
  const [mutationError, setMutationError] = useState<Error | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setMutationError(null);
  }, []);

  // Generate demo data
  const getDemoReleases = useCallback(() => {
    if (!isDemoMode) return [];
    return generateDemoReleases(scenario);
  }, [isDemoMode, scenario]);

  const getDemoRollouts = useCallback((releases: Release[]) => {
    if (!isDemoMode) return [];
    const demoData = getDemoData(scenario);
    const sensors = demoData.fleet.sensors.map((s) => ({ id: s.id, name: s.name }));
    return generateDemoRollouts(releases, sensors, scenario);
  }, [isDemoMode, scenario]);

  // Fetch releases
  const {
    data: releases = [],
    isLoading: isLoadingReleases,
    error: releasesError,
    refetch: refetchReleases,
  } = useQuery({
    queryKey: ['fleet', 'releases', isDemoMode ? scenario : 'live'],
    queryFn: () => {
      if (isDemoMode) {
        return getDemoReleases();
      }
      return fetchReleases();
    },
    refetchInterval: isDemoMode ? false : refreshInterval,
    staleTime: isDemoMode ? Infinity : refreshInterval - 1000,
  });

  // Fetch rollouts
  const {
    data: rollouts = [],
    isLoading: isLoadingRollouts,
    error: rolloutsError,
    refetch: refetchRollouts,
  } = useQuery({
    queryKey: ['fleet', 'rollouts', isDemoMode ? scenario : 'live', releases.length],
    queryFn: () => {
      if (isDemoMode) {
        return getDemoRollouts(releases);
      }
      return fetchRollouts();
    },
    refetchInterval: isDemoMode ? false : 5000, // Poll more frequently for active rollouts
    staleTime: isDemoMode ? Infinity : 4000,
    enabled: releases.length > 0 || !isDemoMode,
  });

  // Find active rollout
  const activeRollout = rollouts.find((r) => r.status === 'in_progress' || r.status === 'pending') || null;

  // Create release mutation
  const createReleaseMutation = useMutation({
    mutationFn: createReleaseApi,
    onSuccess: (newRelease) => {
      queryClient.setQueryData<Release[]>(['fleet', 'releases', 'live'], (old = []) => [newRelease, ...old]);
      queryClient.invalidateQueries({ queryKey: ['fleet', 'releases'] });
    },
    onError: (err: Error) => {
      setMutationError(err);
      onError?.(err);
    },
  });

  // Delete release mutation
  const deleteReleaseMutation = useMutation({
    mutationFn: deleteReleaseApi,
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<Release[]>(['fleet', 'releases', 'live'], (old = []) =>
        old.filter((r) => r.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ['fleet', 'releases'] });
    },
    onError: (err: Error) => {
      setMutationError(err);
      onError?.(err);
    },
  });

  // Start rollout mutation
  const startRolloutMutation = useMutation({
    mutationFn: ({ releaseId, config }: { releaseId: string; config: RolloutConfig }) =>
      startRolloutApi(releaseId, config),
    onSuccess: (newRollout) => {
      queryClient.setQueryData<Rollout[]>(['fleet', 'rollouts', 'live'], (old = []) => [newRollout, ...old]);
      queryClient.invalidateQueries({ queryKey: ['fleet', 'rollouts'] });
    },
    onError: (err: Error) => {
      setMutationError(err);
      onError?.(err);
    },
  });

  // Cancel rollout mutation
  const cancelRolloutMutation = useMutation({
    mutationFn: cancelRolloutApi,
    onSuccess: (_, cancelledId) => {
      queryClient.setQueryData<Rollout[]>(['fleet', 'rollouts', 'live'], (old = []) =>
        old.map((r) => (r.id === cancelledId ? { ...r, status: 'cancelled' as const } : r))
      );
      queryClient.invalidateQueries({ queryKey: ['fleet', 'rollouts'] });
    },
    onError: (err: Error) => {
      setMutationError(err);
      onError?.(err);
    },
  });

  // Detect rollout status changes
  useEffect(() => {
    for (const rollout of rollouts) {
      const previousStatus = previousRolloutStatusRef.current[rollout.id];
      if (previousStatus && previousStatus !== rollout.status) {
        onRolloutStatusChange?.(rollout);
      }
      previousRolloutStatusRef.current[rollout.id] = rollout.status;
    }
  }, [rollouts, onRolloutStatusChange]);

  // Set errors from queries
  useEffect(() => {
    if (releasesError) {
      setMutationError(releasesError as Error);
      onError?.(releasesError as Error);
    }
  }, [releasesError, onError]);

  useEffect(() => {
    if (rolloutsError) {
      setMutationError(rolloutsError as Error);
      onError?.(rolloutsError as Error);
    }
  }, [rolloutsError, onError]);

  // Public API
  const createRelease = useCallback(
    async (data: CreateReleaseInput): Promise<Release> => {
      if (isDemoMode) {
        // Simulate creation in demo mode
        const newRelease: Release = {
          id: `rel-${Date.now()}`,
          version: data.version,
          changelog: data.changelog,
          binaryUrl: data.binaryUrl || `https://releases.atlascrew.io/sensor/${data.version}/sensor.tar.gz`,
          sha256: data.sha256 || Math.random().toString(16).substring(2, 66),
          size: data.binaryFile?.size || 35000000,
          createdAt: new Date().toISOString(),
          createdBy: 'demo-user@example.com',
        };
        queryClient.setQueryData<Release[]>(['fleet', 'releases', scenario], (old = []) => [newRelease, ...old]);
        return newRelease;
      }
      return createReleaseMutation.mutateAsync(data);
    },
    [isDemoMode, scenario, queryClient, createReleaseMutation]
  );

  const deleteRelease = useCallback(
    async (id: string): Promise<void> => {
      if (isDemoMode) {
        queryClient.setQueryData<Release[]>(['fleet', 'releases', scenario], (old = []) =>
          old.filter((r) => r.id !== id)
        );
        return;
      }
      return deleteReleaseMutation.mutateAsync(id);
    },
    [isDemoMode, scenario, queryClient, deleteReleaseMutation]
  );

  const startRollout = useCallback(
    async (releaseId: string, config: RolloutConfig): Promise<Rollout> => {
      if (isDemoMode) {
        const release = releases.find((r) => r.id === releaseId);
        if (!release) {
          throw new Error('Release not found');
        }
        const demoData = getDemoData(scenario);
        const sensors = demoData.fleet.sensors.map((s) => ({ id: s.id, name: s.name }));

        const newRollout: Rollout = {
          id: `roll-${Date.now()}`,
          releaseId,
          release,
          strategy: config.strategy,
          status: 'in_progress',
          targetTags: config.targetTags,
          batchSize: config.batchSize,
          batchDelay: config.batchDelay,
          startedAt: new Date().toISOString(),
          progress: sensors.map((s) => ({
            sensorId: s.id,
            sensorName: s.name,
            status: 'pending' as const,
            updatedAt: new Date().toISOString(),
          })),
        };
        queryClient.setQueryData<Rollout[]>(['fleet', 'rollouts', scenario, releases.length], (old = []) => [
          newRollout,
          ...old,
        ]);
        return newRollout;
      }
      return startRolloutMutation.mutateAsync({ releaseId, config });
    },
    [isDemoMode, scenario, releases, queryClient, startRolloutMutation]
  );

  const cancelRollout = useCallback(
    async (id: string): Promise<void> => {
      if (isDemoMode) {
        queryClient.setQueryData<Rollout[]>(['fleet', 'rollouts', scenario, releases.length], (old = []) =>
          old.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r))
        );
        return;
      }
      return cancelRolloutMutation.mutateAsync(id);
    },
    [isDemoMode, scenario, releases.length, queryClient, cancelRolloutMutation]
  );

  const refreshReleases = useCallback(() => {
    refetchReleases();
  }, [refetchReleases]);

  const refreshRollouts = useCallback(() => {
    refetchRollouts();
  }, [refetchRollouts]);

  return {
    // Releases
    releases,
    isLoadingReleases,
    releasesError: releasesError as Error | null,
    createRelease,
    deleteRelease,
    isCreatingRelease: createReleaseMutation.isPending,
    isDeletingRelease: deleteReleaseMutation.isPending,

    // Rollouts
    rollouts,
    activeRollout,
    isLoadingRollouts,
    rolloutsError: rolloutsError as Error | null,
    startRollout,
    cancelRollout,
    isStartingRollout: startRolloutMutation.isPending,
    isCancellingRollout: cancelRolloutMutation.isPending,

    // Utilities
    refreshReleases,
    refreshRollouts,
    clearError,
    mutationError,
  };
}

export default useReleases;

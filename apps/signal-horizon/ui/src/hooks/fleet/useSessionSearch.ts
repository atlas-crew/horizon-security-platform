/**
 * useSessionSearch Hook
 *
 * Hook for searching sessions across all sensors in the fleet.
 * Supports search by session ID, actor ID, client IP, JA4 fingerprint, user agent, and more.
 */

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDemoMode } from '../../stores/demoModeStore';
import { getDemoData } from '../../lib/demoData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

// =============================================================================
// Type Definitions
// =============================================================================

export interface TimeRange {
  start: Date;
  end?: Date;
}

export interface SessionSearchQuery {
  sessionId?: string;
  actorId?: string;
  clientIp?: string;
  ja4Fingerprint?: string;
  userAgent?: string;
  timeRange?: TimeRange;
  riskScoreMin?: number;
  blockedOnly?: boolean;
  limitPerSensor?: number;
}

export interface SensorSession {
  id: string;
  actorId: string;
  clientIp: string;
  riskScore: number;
  requestCount: number;
  lastSeen: string;
  isBlocked: boolean;
  ja4Fingerprint?: string;
  userAgent?: string;
  createdAt: string;
  blockReason?: string;
  threatCategories?: string[];
  countryCode?: string;
  asn?: string;
}

export interface SessionSearchResult {
  sensorId: string;
  sensorName: string;
  sessions: SensorSession[];
  searchDurationMs: number;
  error?: string;
  online: boolean;
  totalMatches?: number;
}

export interface GlobalSessionSearchResult {
  results: SessionSearchResult[];
  totalSessions: number;
  totalSensors: number;
  successfulSensors: number;
  failedSensors: number;
  searchDurationMs: number;
  query: SessionSearchQuery;
}

export interface FleetSessionStats {
  totalActiveSessions: number;
  totalBlockedSessions: number;
  uniqueActors: number;
  averageRiskScore: number;
  sessionsByRiskTier: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  topThreatCategories: Array<{
    category: string;
    count: number;
  }>;
  sensorStats: Array<{
    sensorId: string;
    sensorName: string;
    activeSessions: number;
    blockedSessions: number;
    online: boolean;
  }>;
  timestamp: string;
}

export interface GlobalRevokeResult {
  sessionId: string;
  results: Array<{
    sensorId: string;
    success: boolean;
    sessionId: string;
    error?: string;
  }>;
  totalSensors: number;
  successCount: number;
  failureCount: number;
}

export interface GlobalBanResult {
  actorId: string;
  reason: string;
  durationSeconds?: number;
  results: Array<{
    sensorId: string;
    success: boolean;
    actorId: string;
    sessionsTerminated?: number;
    error?: string;
  }>;
  totalSensors: number;
  successCount: number;
  failureCount: number;
  totalSessionsTerminated: number;
}

export interface UseSessionSearchOptions {
  /** Auto-fetch stats on mount */
  autoFetchStats?: boolean;
  /** Refresh interval for stats in ms (0 to disable) */
  statsRefreshInterval?: number;
}

export interface UseSessionSearchReturn {
  /** Current search results */
  searchResults: GlobalSessionSearchResult | null;
  /** Fleet session statistics */
  stats: FleetSessionStats | null;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Whether stats are loading */
  isLoadingStats: boolean;
  /** Search error */
  searchError: Error | null;
  /** Stats error */
  statsError: Error | null;
  /** Execute a search */
  search: (query: SessionSearchQuery) => Promise<GlobalSessionSearchResult>;
  /** Revoke a session globally */
  revokeSession: (sessionId: string, reason?: string, sensorIds?: string[]) => Promise<GlobalRevokeResult>;
  /** Ban an actor globally */
  banActor: (actorId: string, reason: string, durationSeconds?: number, sensorIds?: string[]) => Promise<GlobalBanResult>;
  /** Refresh stats */
  refreshStats: () => void;
  /** Clear search results */
  clearResults: () => void;
}

// =============================================================================
// API Functions
// =============================================================================

async function searchSessions(query: SessionSearchQuery): Promise<GlobalSessionSearchResult> {
  const params = new URLSearchParams();

  if (query.sessionId) params.set('sessionId', query.sessionId);
  if (query.actorId) params.set('actorId', query.actorId);
  if (query.clientIp) params.set('clientIp', query.clientIp);
  if (query.ja4Fingerprint) params.set('ja4Fingerprint', query.ja4Fingerprint);
  if (query.userAgent) params.set('userAgent', query.userAgent);
  if (query.timeRange?.start) params.set('timeRangeStart', query.timeRange.start.toISOString());
  if (query.timeRange?.end) params.set('timeRangeEnd', query.timeRange.end.toISOString());
  if (query.riskScoreMin !== undefined) params.set('riskScoreMin', String(query.riskScoreMin));
  if (query.blockedOnly) params.set('blockedOnly', 'true');
  if (query.limitPerSensor) params.set('limitPerSensor', String(query.limitPerSensor));

  const response = await fetch(`${API_BASE}/api/v1/fleet/sessions/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchSessionStats(): Promise<FleetSessionStats> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/sessions/stats`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function revokeSessionApi(
  sessionId: string,
  reason?: string,
  sensorIds?: string[]
): Promise<GlobalRevokeResult> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/sessions/${encodeURIComponent(sessionId)}/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ reason, sensorIds }),
  });

  if (!response.ok) {
    throw new Error(`Revoke failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function banActorApi(
  actorId: string,
  reason: string,
  durationSeconds?: number,
  sensorIds?: string[]
): Promise<GlobalBanResult> {
  const response = await fetch(`${API_BASE}/api/v1/fleet/actors/${encodeURIComponent(actorId)}/ban`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ reason, durationSeconds, sensorIds }),
  });

  if (!response.ok) {
    throw new Error(`Ban failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// =============================================================================
// Demo Data Generation
// =============================================================================

function generateDemoSearchResults(query: SessionSearchQuery, scenario: string): GlobalSessionSearchResult {
  const demoData = getDemoData(scenario as 'high-threat' | 'normal' | 'quiet');
  const sensors = demoData.fleet.sensors;
  const isHighThreat = scenario === 'high-threat';
  const isQuiet = scenario === 'quiet';

  const results: SessionSearchResult[] = sensors.map((sensor) => {
    const sessionsCount = isHighThreat ? Math.floor(Math.random() * 30) + 10
      : isQuiet ? Math.floor(Math.random() * 5) + 1
      : Math.floor(Math.random() * 15) + 5;

    const sessions: SensorSession[] = Array.from({ length: sessionsCount }, (_, i) => {
      const riskScore = isHighThreat
        ? Math.floor(Math.random() * 60) + 40
        : isQuiet
          ? Math.floor(Math.random() * 30)
          : Math.floor(Math.random() * 50) + 20;

      const isBlocked = riskScore > 75 || Math.random() > 0.85;

      return {
        id: `sess-${sensor.id}-${i}-${Date.now().toString(36)}`,
        actorId: query.actorId || `actor-${Math.random().toString(36).substring(2, 10)}`,
        clientIp: query.clientIp || `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
        riskScore,
        requestCount: Math.floor(Math.random() * 500) + 10,
        lastSeen: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
        isBlocked,
        ja4Fingerprint: query.ja4Fingerprint || `t${Math.floor(Math.random() * 13) + 10}d${Math.floor(Math.random() * 1000)}_${Math.random().toString(36).substring(2, 14)}`,
        userAgent: query.userAgent || ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'curl/7.88.1', 'python-requests/2.28.1'][Math.floor(Math.random() * 4)],
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
        blockReason: isBlocked ? ['SQL Injection Attempt', 'XSS Attack', 'Rate Limit Exceeded', 'Bot Detection'][Math.floor(Math.random() * 4)] : undefined,
        threatCategories: isBlocked ? [['sqli', 'xss', 'rce', 'lfi'][Math.floor(Math.random() * 4)]] : undefined,
        countryCode: ['US', 'CN', 'RU', 'DE', 'FR', 'GB', 'JP'][Math.floor(Math.random() * 7)],
        asn: `AS${Math.floor(Math.random() * 50000)}`,
      };
    });

    // Filter by query parameters
    const filteredSessions = sessions.filter((s) => {
      if (query.riskScoreMin !== undefined && s.riskScore < query.riskScoreMin) return false;
      if (query.blockedOnly && !s.isBlocked) return false;
      return true;
    });

    return {
      sensorId: sensor.id,
      sensorName: sensor.name,
      sessions: filteredSessions.slice(0, query.limitPerSensor || 50),
      searchDurationMs: Math.floor(Math.random() * 500) + 50,
      online: sensor.status !== 'offline',
      totalMatches: filteredSessions.length,
    };
  });

  const totalSessions = results.reduce((sum, r) => sum + r.sessions.length, 0);

  return {
    results,
    totalSessions,
    totalSensors: sensors.length,
    successfulSensors: results.filter((r) => r.online).length,
    failedSensors: results.filter((r) => !r.online).length,
    searchDurationMs: Math.floor(Math.random() * 1000) + 200,
    query,
  };
}

function generateDemoStats(scenario: string): FleetSessionStats {
  const demoData = getDemoData(scenario as 'high-threat' | 'normal' | 'quiet');
  const sensors = demoData.fleet.sensors;
  const isHighThreat = scenario === 'high-threat';
  const isQuiet = scenario === 'quiet';

  const baseActive = isHighThreat ? 5000 : isQuiet ? 200 : 1500;
  const baseBlocked = isHighThreat ? 800 : isQuiet ? 15 : 150;

  return {
    totalActiveSessions: baseActive + Math.floor(Math.random() * 500),
    totalBlockedSessions: baseBlocked + Math.floor(Math.random() * 100),
    uniqueActors: Math.floor((baseActive + baseBlocked) * 0.3),
    averageRiskScore: isHighThreat ? 55 + Math.random() * 15 : isQuiet ? 15 + Math.random() * 10 : 35 + Math.random() * 15,
    sessionsByRiskTier: {
      low: isHighThreat ? 800 : isQuiet ? 150 : 500,
      medium: isHighThreat ? 1500 : isQuiet ? 40 : 600,
      high: isHighThreat ? 2000 : isQuiet ? 8 : 300,
      critical: isHighThreat ? 700 : isQuiet ? 2 : 100,
    },
    topThreatCategories: [
      { category: 'SQL Injection', count: isHighThreat ? 450 : isQuiet ? 5 : 80 },
      { category: 'XSS', count: isHighThreat ? 320 : isQuiet ? 3 : 45 },
      { category: 'Bot Detection', count: isHighThreat ? 280 : isQuiet ? 8 : 60 },
      { category: 'Rate Limiting', count: isHighThreat ? 200 : isQuiet ? 2 : 30 },
      { category: 'Path Traversal', count: isHighThreat ? 150 : isQuiet ? 1 : 20 },
    ],
    sensorStats: sensors.map((sensor) => ({
      sensorId: sensor.id,
      sensorName: sensor.name,
      activeSessions: Math.floor(baseActive / sensors.length) + Math.floor(Math.random() * 100),
      blockedSessions: Math.floor(baseBlocked / sensors.length) + Math.floor(Math.random() * 20),
      online: sensor.status !== 'offline',
    })),
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// Main Hook
// =============================================================================

export function useSessionSearch(options: UseSessionSearchOptions = {}): UseSessionSearchReturn {
  const { autoFetchStats = true, statsRefreshInterval = 30000 } = options;

  const { isEnabled: isDemoMode, scenario } = useDemoMode();
  const queryClient = useQueryClient();

  const [searchResults, setSearchResults] = useState<GlobalSessionSearchResult | null>(null);

  // Stats query
  const statsQuery = useQuery({
    queryKey: ['fleet', 'sessions', 'stats', isDemoMode ? scenario : 'live'],
    queryFn: () => {
      if (isDemoMode) {
        return generateDemoStats(scenario);
      }
      return fetchSessionStats();
    },
    enabled: autoFetchStats,
    refetchInterval: isDemoMode ? false : statsRefreshInterval,
    staleTime: isDemoMode ? Infinity : statsRefreshInterval - 1000,
  });

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (query: SessionSearchQuery) => {
      if (isDemoMode) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));
        return generateDemoSearchResults(query, scenario);
      }
      return searchSessions(query);
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
  });

  // Revoke mutation
  const revokeMutation = useMutation({
    mutationFn: async ({ sessionId, reason, sensorIds }: { sessionId: string; reason?: string; sensorIds?: string[] }) => {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
        return {
          sessionId,
          results: [
            { sensorId: 'sensor-1', success: true, sessionId },
            { sensorId: 'sensor-2', success: true, sessionId },
            { sensorId: 'sensor-3', success: Math.random() > 0.1, sessionId, error: Math.random() > 0.9 ? 'Session not found' : undefined },
          ],
          totalSensors: 3,
          successCount: 2 + (Math.random() > 0.1 ? 1 : 0),
          failureCount: Math.random() > 0.9 ? 1 : 0,
        } as GlobalRevokeResult;
      }
      return revokeSessionApi(sessionId, reason, sensorIds);
    },
    onSuccess: () => {
      // Refresh stats after revocation
      queryClient.invalidateQueries({ queryKey: ['fleet', 'sessions', 'stats'] });
    },
  });

  // Ban mutation
  const banMutation = useMutation({
    mutationFn: async ({ actorId, reason, durationSeconds, sensorIds }: {
      actorId: string;
      reason: string;
      durationSeconds?: number;
      sensorIds?: string[];
    }) => {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 400));
        const sessionsTerminated = Math.floor(Math.random() * 5) + 1;
        return {
          actorId,
          reason,
          durationSeconds,
          results: [
            { sensorId: 'sensor-1', success: true, actorId, sessionsTerminated: Math.floor(sessionsTerminated / 2) },
            { sensorId: 'sensor-2', success: true, actorId, sessionsTerminated: Math.ceil(sessionsTerminated / 2) },
            { sensorId: 'sensor-3', success: Math.random() > 0.05, actorId, sessionsTerminated: 0, error: Math.random() > 0.95 ? 'Actor not found' : undefined },
          ],
          totalSensors: 3,
          successCount: 2 + (Math.random() > 0.05 ? 1 : 0),
          failureCount: Math.random() > 0.95 ? 1 : 0,
          totalSessionsTerminated: sessionsTerminated,
        } as GlobalBanResult;
      }
      return banActorApi(actorId, reason, durationSeconds, sensorIds);
    },
    onSuccess: () => {
      // Refresh stats after ban
      queryClient.invalidateQueries({ queryKey: ['fleet', 'sessions', 'stats'] });
    },
  });

  const search = useCallback(async (query: SessionSearchQuery): Promise<GlobalSessionSearchResult> => {
    return searchMutation.mutateAsync(query);
  }, [searchMutation]);

  const revokeSession = useCallback(async (
    sessionId: string,
    reason?: string,
    sensorIds?: string[]
  ): Promise<GlobalRevokeResult> => {
    return revokeMutation.mutateAsync({ sessionId, reason, sensorIds });
  }, [revokeMutation]);

  const banActor = useCallback(async (
    actorId: string,
    reason: string,
    durationSeconds?: number,
    sensorIds?: string[]
  ): Promise<GlobalBanResult> => {
    return banMutation.mutateAsync({ actorId, reason, durationSeconds, sensorIds });
  }, [banMutation]);

  const refreshStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['fleet', 'sessions', 'stats'] });
  }, [queryClient]);

  const clearResults = useCallback(() => {
    setSearchResults(null);
  }, []);

  return {
    searchResults,
    stats: statsQuery.data ?? null,
    isSearching: searchMutation.isPending,
    isLoadingStats: statsQuery.isLoading,
    searchError: searchMutation.error as Error | null,
    statsError: statsQuery.error as Error | null,
    search,
    revokeSession,
    banActor,
    refreshStats,
    clearResults,
  };
}

export default useSessionSearch;

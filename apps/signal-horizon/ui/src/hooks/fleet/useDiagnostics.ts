/**
 * useDiagnostics Hook
 *
 * Fetches diagnostics data from a sensor via REST API or SSE for live updates.
 * Manages connection state, error handling, and automatic refresh.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDemoMode } from '../../stores/demoModeStore';
import { getDemoData } from '../../lib/demoData';
import { diagnosticsKeys, getQueryMode } from '../../lib/queryKeys';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3100';
const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

// =============================================================================
// Type Definitions
// =============================================================================

export interface DiagnosticsHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
}

export interface DiagnosticsMemory {
  rss: number;
  heap: number;
  actorCache: number;
  sessionCache: number;
  ruleIndex: number;
}

export interface UpstreamPool {
  name: string;
  active: number;
  idle: number;
}

export interface HorizonTunnelStatus {
  connected: boolean;
  uptime?: number;
}

export interface DiagnosticsConnections {
  activeClients: number;
  upstreamPools: UpstreamPool[];
  horizonTunnel: HorizonTunnelStatus;
}

export interface DiagnosticsRules {
  total: number;
  enabled: number;
  lastUpdated: string;
}

export interface DiagnosticsActors {
  tracked: number;
  cacheCapacity: number;
  cacheUsage: number;
  evictions1h: number;
}

export interface DiagnosticsData {
  health: DiagnosticsHealth;
  memory: DiagnosticsMemory;
  connections: DiagnosticsConnections;
  rules: DiagnosticsRules;
  actors: DiagnosticsActors;
}

export interface UseDiagnosticsOptions {
  /** Sensor ID to fetch diagnostics from */
  sensorId: string;
  /** Sections to include (default: all) */
  sections?: Array<'health' | 'memory' | 'connections' | 'rules' | 'actors'>;
  /** Refresh interval in ms (0 to disable auto-refresh, default: 5000) */
  refreshInterval?: number;
  /** Use SSE for live updates instead of polling */
  live?: boolean;
}

export interface UseDiagnosticsResult {
  /** Diagnostics data (null if not loaded) */
  data: DiagnosticsData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Manual refresh function */
  refresh: () => void;
  /** Timestamp of last successful fetch */
  lastUpdated: Date | null;
  /** SSE connection status (if live mode) */
  isConnected: boolean;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchDiagnostics(
  sensorId: string,
  sections?: string[]
): Promise<DiagnosticsData> {
  const params = new URLSearchParams();
  if (sections && sections.length > 0) {
    params.set('sections', sections.join(','));
  }

  const queryString = params.toString();
  const url = `${API_BASE}/api/v1/fleet/sensors/${encodeURIComponent(sensorId)}/diagnostics${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch diagnostics: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// =============================================================================
// Demo Data Generation
// =============================================================================

function generateDemoDiagnostics(sensorId: string, scenario: string): DiagnosticsData {
  // Use fleet data to correlate with existing sensor data
  const demoData = getDemoData(scenario as 'high-threat' | 'normal' | 'quiet');
  const sensor = demoData.fleet.sensors.find((s) => s.id === sensorId);

  // Generate deterministic values based on scenario
  const isHighThreat = scenario === 'high-threat';
  const isQuiet = scenario === 'quiet';

  const baseMemory = isHighThreat ? 1200 : isQuiet ? 400 : 800;
  const baseActors = isHighThreat ? 8500 : isQuiet ? 1200 : 4500;
  const baseEvictions = isHighThreat ? 450 : isQuiet ? 12 : 85;

  // Determine health status based on sensor status or scenario
  let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (sensor?.status === 'offline') {
    healthStatus = 'unhealthy';
  } else if (sensor?.status === 'warning' || isHighThreat) {
    healthStatus = 'degraded';
  }

  // Get uptime from fleet health or generate based on scenario
  const uptimeSeconds = isHighThreat
    ? Math.floor(Math.random() * 86400 * 3) + 86400 // 1-4 days
    : isQuiet
      ? Math.floor(Math.random() * 86400 * 30) + 86400 * 7 // 7-37 days
      : Math.floor(Math.random() * 86400 * 14) + 86400 * 3; // 3-17 days

  const ruleCount = demoData.fleet.rules.rules.length;
  const enabledRules = demoData.fleet.rules.rules.filter((r) => r.enabled).length;

  return {
    health: {
      status: healthStatus,
      uptime: uptimeSeconds,
      version: sensor?.version || '2.4.1',
    },
    memory: {
      rss: baseMemory + Math.floor(Math.random() * 200),
      heap: Math.floor(baseMemory * 0.7) + Math.floor(Math.random() * 100),
      actorCache: Math.floor(baseMemory * 0.15) + Math.floor(Math.random() * 30),
      sessionCache: Math.floor(baseMemory * 0.1) + Math.floor(Math.random() * 20),
      ruleIndex: Math.floor(baseMemory * 0.05) + Math.floor(Math.random() * 10),
    },
    connections: {
      activeClients: isHighThreat
        ? Math.floor(Math.random() * 500) + 200
        : isQuiet
          ? Math.floor(Math.random() * 50) + 10
          : Math.floor(Math.random() * 150) + 50,
      upstreamPools: [
        {
          name: 'api-backend',
          active: Math.floor(Math.random() * 20) + 5,
          idle: Math.floor(Math.random() * 30) + 10,
        },
        {
          name: 'auth-service',
          active: Math.floor(Math.random() * 10) + 2,
          idle: Math.floor(Math.random() * 15) + 5,
        },
        {
          name: 'static-content',
          active: Math.floor(Math.random() * 5) + 1,
          idle: Math.floor(Math.random() * 20) + 8,
        },
      ],
      horizonTunnel: {
        connected: sensor?.status !== 'offline',
        uptime: sensor?.status !== 'offline' ? uptimeSeconds - Math.floor(Math.random() * 3600) : undefined,
      },
    },
    rules: {
      total: ruleCount,
      enabled: enabledRules,
      lastUpdated: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
    },
    actors: {
      tracked: baseActors + Math.floor(Math.random() * 500),
      cacheCapacity: 10000,
      cacheUsage: Math.min(99, Math.floor((baseActors / 10000) * 100) + Math.floor(Math.random() * 10)),
      evictions1h: baseEvictions + Math.floor(Math.random() * 50),
    },
  };
}

// =============================================================================
// Main Hook
// =============================================================================

export function useDiagnostics(options: UseDiagnosticsOptions): UseDiagnosticsResult {
  const { sensorId, sections, refreshInterval = 5000, live = false } = options;

  const { isEnabled: isDemoMode, scenario } = useDemoMode();
  const queryClient = useQueryClient();

  // SSE state for live mode
  const eventSourceRef = useRef<EventSource | null>(null);
  const [liveData, setLiveData] = useState<DiagnosticsData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const mode = getQueryMode(isDemoMode, scenario);

  // React Query for polling mode
  const query = useQuery({
    queryKey: diagnosticsKeys.sensorSections(sensorId, sections?.join(','), mode),
    queryFn: () => {
      if (isDemoMode) {
        return generateDemoDiagnostics(sensorId, scenario);
      }
      return fetchDiagnostics(sensorId, sections);
    },
    refetchInterval: live ? false : (isDemoMode ? false : refreshInterval),
    staleTime: isDemoMode ? Infinity : refreshInterval - 1000,
    enabled: !live, // Disable query when using SSE
  });

  // Update lastUpdated when query succeeds
  useEffect(() => {
    if (query.data && !live) {
      setLastUpdated(new Date());
    }
  }, [query.data, live]);

  // SSE connection for live mode
  useEffect(() => {
    if (!live || isDemoMode) {
      return;
    }

    const sectionsParam = sections ? `&sections=${sections.join(',')}` : '';
    const url = `${API_BASE}/api/v1/fleet/sensors/${encodeURIComponent(sensorId)}/diagnostics/stream?token=${encodeURIComponent(API_KEY)}${sectionsParam}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[useDiagnostics] SSE connected');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as DiagnosticsData;
        setLiveData(data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error('[useDiagnostics] Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[useDiagnostics] SSE error:', error);
      setIsConnected(false);

      // Attempt reconnection after delay
      eventSource.close();
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          // Only reconnect if this is still the current connection
          eventSourceRef.current = null;
        }
      }, 3000);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [live, sensorId, sections, isDemoMode]);

  // Demo mode live simulation
  useEffect(() => {
    if (!live || !isDemoMode) {
      return;
    }

    // Simulate live updates in demo mode
    setIsConnected(true);
    setLiveData(generateDemoDiagnostics(sensorId, scenario));
    setLastUpdated(new Date());

    const interval = setInterval(() => {
      setLiveData(generateDemoDiagnostics(sensorId, scenario));
      setLastUpdated(new Date());
    }, 2000);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [live, isDemoMode, sensorId, scenario]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (live) {
      // For live mode, close and reopen the connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // The useEffect will handle reconnection
    } else {
      // For polling mode, invalidate the query
      queryClient.invalidateQueries({ queryKey: diagnosticsKeys.sensor(sensorId) });
    }
  }, [live, queryClient, sensorId]);

  // Return appropriate data based on mode
  if (live) {
    return {
      data: liveData,
      isLoading: !liveData && isConnected,
      error: null,
      refresh,
      lastUpdated,
      isConnected,
    };
  }

  return {
    data: query.data || null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refresh,
    lastUpdated,
    isConnected: false,
  };
}

export default useDiagnostics;

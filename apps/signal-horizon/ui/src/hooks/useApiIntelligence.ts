
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDemoMode } from '../stores/demoModeStore';

const API_KEY = import.meta.env.VITE_HORIZON_API_KEY || 'dev-dashboard-key';

export interface DiscoveryStats {
  totalEndpoints: number;
  newThisWeek: number;
  newToday: number;
  schemaViolations24h: number;
  schemaViolations7d: number;
  topViolatingEndpoints: Array<{ endpoint: string; method: string; violationCount: number }>;
  endpointsByMethod: Record<string, number>;
  discoveryTrend: Array<{ date: string; count: number }>;
}

export interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  service: string;
  firstSeenAt: string;
  lastSeenAt: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  hasSchema: boolean;
  metadata?: Record<string, unknown>;
}

export interface ApiSignal {
  id: string;
  signalType: string;
  fingerprint: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  metadata: {
    endpoint?: string;
    method?: string;
    violationType?: string;
    violationMessage?: string;
    [key: string]: unknown;
  };
}

export function useApiIntelligence() {
  const { isEnabled, scenario } = useDemoMode();
  
  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [signals, setSignals] = useState<ApiSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (isEnabled) {
      // Demo Mode Data
      setStats({
        totalEndpoints: 487,
        newThisWeek: 12,
        newToday: 3,
        schemaViolations24h: 45,
        schemaViolations7d: 312,
        topViolatingEndpoints: [
          { endpoint: '/api/v1/users', method: 'POST', violationCount: 156 },
          { endpoint: '/api/v1/auth/login', method: 'POST', violationCount: 89 },
          { endpoint: '/api/v1/orders', method: 'GET', violationCount: 45 },
        ],
        endpointsByMethod: { GET: 245, POST: 120, PUT: 45, DELETE: 30, PATCH: 47 },
        discoveryTrend: [
          { date: '2024-01-10', count: 5 },
          { date: '2024-01-11', count: 8 },
          { date: '2024-01-12', count: 3 },
          { date: '2024-01-13', count: 12 },
          { date: '2024-01-14', count: 7 },
          { date: '2024-01-15', count: 4 },
          { date: '2024-01-16', count: 3 },
        ],
      });
      setEndpoints([
        { id: '1', method: 'POST', path: '/api/v1/users', service: 'user-service', firstSeenAt: '2024-01-01T10:00:00Z', lastSeenAt: new Date().toISOString(), riskLevel: 'high', hasSchema: true },
        { id: '2', method: 'GET', path: '/api/v1/products', service: 'catalog-service', firstSeenAt: '2024-01-02T11:00:00Z', lastSeenAt: new Date().toISOString(), riskLevel: 'low', hasSchema: true },
        { id: '3', method: 'POST', path: '/api/v1/auth/login', service: 'auth-service', firstSeenAt: '2024-01-01T09:00:00Z', lastSeenAt: new Date().toISOString(), riskLevel: 'critical', hasSchema: false },
      ]);
      setSignals([
        { id: 's1', signalType: 'SCHEMA_VIOLATION', fingerprint: 'POST:/api/v1/users', severity: 'MEDIUM', createdAt: new Date().toISOString(), metadata: { endpoint: '/api/v1/users', method: 'POST', violationType: 'TYPE_MISMATCH', violationMessage: 'Expected string, got number' } },
        { id: 's2', signalType: 'TEMPLATE_DISCOVERY', fingerprint: '/api/v1/admin/debug', severity: 'LOW', createdAt: new Date(Date.now() - 3600000).toISOString(), metadata: { endpoint: '/api/v1/admin/debug', method: 'GET' } },
      ]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [statsRes, endpointsRes, signalsRes] = await Promise.all([
        fetch('/api/v1/api-intelligence/stats', { headers: { Authorization: `Bearer ${API_KEY}` } }),
        fetch('/api/v1/api-intelligence/endpoints?limit=20', { headers: { Authorization: `Bearer ${API_KEY}` } }),
        fetch('/api/v1/api-intelligence/signals?limit=20', { headers: { Authorization: `Bearer ${API_KEY}` } }),
      ]);

      if (!statsRes.ok || !endpointsRes.ok || !signalsRes.ok) {
        throw new Error('Failed to fetch API intelligence data');
      }

      setStats(await statsRes.json());
      const endpointsData = await endpointsRes.json();
      setEndpoints(endpointsData.endpoints);
      const signalsData = await signalsRes.json();
      setSignals(signalsData.signals);
      setError(null);
    } catch (err) {
      console.error('API Intelligence fetch error:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, endpoints, signals, isLoading, error, refetch: fetchStats };
}

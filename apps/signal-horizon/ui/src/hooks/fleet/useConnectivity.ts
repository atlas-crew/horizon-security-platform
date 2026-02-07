/**
 * useConnectivity Hook
 *
 * Wire-up for Management Connectivity endpoints:
 * - GET /api/v1/management/connectivity
 * - POST /api/v1/management/connectivity/test
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const API_KEY =
  import.meta.env.VITE_API_KEY ||
  import.meta.env.VITE_HORIZON_API_KEY ||
  'dev-dashboard-key';
const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

export type ConnectivityState = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export interface ConnectivitySensor {
  id: string;
  name: string;
  connectionState: ConnectivityState;
  lastHeartbeat: string | null;
}

export interface ConnectivityStatusResponse {
  stats: {
    total: number;
    online: number;
    offline: number;
    reconnecting: number;
    recentlyActive: number;
  };
  sensors: Record<ConnectivityState, ConnectivitySensor[]>;
  timestamp: string;
}

export type ConnectivityTestType = 'ping' | 'dns' | 'tls' | 'traceroute';

export interface ConnectivityTestResult {
  testType: ConnectivityTestType;
  status: 'passed' | 'failed' | 'error';
  target: string;
  latencyMs: number | null;
  details: Record<string, unknown>;
  errorType?: string;
  error?: string;
  timestamp: string;
}

export interface ConnectivityTestResponse {
  result: ConnectivityTestResult;
  request: {
    testType: ConnectivityTestType;
    target: string;
  };
  metadata: {
    timestamp: string;
    requestId?: string;
  };
}

async function fetchConnectivityStatus(): Promise<ConnectivityStatusResponse> {
  const response = await fetch(`${API_BASE}/management/connectivity`, { headers: authHeaders });
  if (!response.ok) throw new Error('Failed to fetch connectivity status');
  return response.json();
}

async function runConnectivityTest(params: {
  testType: ConnectivityTestType;
  target: string;
}): Promise<ConnectivityTestResponse> {
  const response = await fetch(`${API_BASE}/management/connectivity/test`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.detail || body?.message || body?.error || 'Connectivity test failed');
  }
  return response.json();
}

export function useConnectivity() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['management', 'connectivity'],
    queryFn: fetchConnectivityStatus,
    refetchInterval: 30000,
  });

  const testMutation = useMutation({
    mutationFn: runConnectivityTest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['management', 'connectivity'] });
    },
  });

  return {
    status: statusQuery.data || null,
    isLoadingStatus: statusQuery.isLoading,
    statusError: statusQuery.error as Error | null,
    refreshStatus: () => queryClient.invalidateQueries({ queryKey: ['management', 'connectivity'] }),

    runTest: testMutation.mutateAsync,
    isTesting: testMutation.isPending,
    testResult: testMutation.data || null,
    testError: testMutation.error as Error | null,
  };
}

export default useConnectivity;


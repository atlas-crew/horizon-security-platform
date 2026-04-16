
import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { useDemoMode } from '../stores/demoModeStore';
import { apiFetch } from '../lib/api';

// Zod schemas for API response validation
const TopViolatingEndpointSchema = z.object({
  endpoint: z.string(),
  method: z.string(),
  violationCount: z.number(),
});

const DiscoveryTrendSchema = z.object({
  date: z.string(),
  count: z.number(),
});

const DiscoveryStatsSchema = z.object({
  totalEndpoints: z.number(),
  newThisWeek: z.number(),
  newToday: z.number(),
  schemaViolations24h: z.number(),
  schemaViolations7d: z.number(),
  coveragePercent: z.number(),
  topViolatingEndpoints: z.array(TopViolatingEndpointSchema),
  endpointsByMethod: z.record(z.string(), z.number()),
  discoveryTrend: z.array(DiscoveryTrendSchema),
});

const InventoryEndpointSchema = z.object({
  id: z.string(),
  path: z.string(),
  pathTemplate: z.string(),
  method: z.string(),
  service: z.string(),
  sensorId: z.string(),
  requestCount: z.number(),
  riskLevel: z.string(),
  riskScore: z.number(),
  lastSeenAt: z.string(),
});

const InventoryServiceSchema = z.object({
  service: z.string(),
  endpointCount: z.number(),
  totalRequests: z.number(),
  avgRiskScore: z.number(),
  endpoints: z.array(InventoryEndpointSchema),
});

const FleetInventorySchema = z.object({
  totalEndpoints: z.number(),
  totalRequests: z.number(),
  services: z.array(InventoryServiceSchema),
});

const SchemaChangeSchema = z.object({
  id: z.string(),
  endpoint: z.string(),
  method: z.string(),
  service: z.string(),
  changeType: z.string(),
  field: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  riskLevel: z.string(),
  detectedAt: z.string(),
  breaking: z.boolean(),
});

const SchemaChangesResponseSchema = z.object({
  changes: z.array(SchemaChangeSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const EndpointTrendPointSchema = z.object({
  date: z.string(),
  count: z.number(),
});

const EndpointDriftTrendSchema = z.object({
  endpoint: z.string(),
  method: z.string(),
  service: z.string(),
  total: z.number(),
  series: z.array(EndpointTrendPointSchema),
});

const EndpointDriftTrendsResponseSchema = z.object({
  days: z.number(),
  limit: z.number(),
  trends: z.array(EndpointDriftTrendSchema),
});

const ApiEndpointSchema = z.object({
  id: z.string(),
  method: z.string(),
  path: z.string(),
  service: z.string(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  hasSchema: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ApiSignalMetadataSchema = z.object({
  endpoint: z.string().optional(),
  method: z.string().optional(),
  violationType: z.string().optional(),
  violationMessage: z.string().optional(),
}).passthrough();

const ApiSignalSchema = z.object({
  id: z.string(),
  signalType: z.string(),
  fingerprint: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  createdAt: z.string(),
  metadata: ApiSignalMetadataSchema,
});

const EndpointsResponseSchema = z.object({
  endpoints: z.array(ApiEndpointSchema),
  total: z.number().optional(),
});

const SignalsResponseSchema = z.object({
  signals: z.array(ApiSignalSchema),
});

export interface DiscoveryStats {
  totalEndpoints: number;
  newThisWeek: number;
  newToday: number;
  schemaViolations24h: number;
  schemaViolations7d: number;
  coveragePercent: number;
  topViolatingEndpoints: Array<{ endpoint: string; method: string; violationCount: number }>;
  endpointsByMethod: Record<string, number>;
  discoveryTrend: Array<{ date: string; count: number }>;
}

export interface InventoryEndpoint {
  id: string;
  path: string;
  pathTemplate: string;
  method: string;
  service: string;
  sensorId: string;
  requestCount: number;
  riskLevel: string;
  riskScore: number;
  lastSeenAt: string;
}

export interface InventoryService {
  service: string;
  endpointCount: number;
  totalRequests: number;
  avgRiskScore: number;
  endpoints: InventoryEndpoint[];
}

export interface FleetInventory {
  totalEndpoints: number;
  totalRequests: number;
  services: InventoryService[];
}

export interface SchemaChange {
  id: string;
  endpoint: string;
  method: string;
  service: string;
  changeType: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  riskLevel: string;
  detectedAt: string;
  breaking: boolean;
}

export interface EndpointDriftTrend {
  endpoint: string;
  method: string;
  service: string;
  total: number;
  series: Array<{ date: string; count: number }>;
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

/**
 * Generate relative dates for demo discovery trend data.
 *
 * The counts are chosen to produce a chart with visible shape — a clear
 * peak mid-week, a weekend dip, and a rebound. Previous values (3–12
 * range) auto-scaled to a nearly-flat line that looked static. These
 * values (18–71 range, ~4x spread) give the area chart real contour.
 * Total across 7 days (~285) is consistent with `stats.totalEndpoints:
 * 487` — roughly 60% of the fleet was discovered in the last week,
 * which matches a "recently deployed" demo narrative.
 */
function generateDemoDiscoveryTrend(): Array<{ date: string; count: number }> {
  const today = new Date();
  const counts = [38, 52, 28, 71, 45, 33, 18];
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(today.getTime() - (6 - i) * 86400000).toISOString().split('T')[0],
    count: counts[i],
  }));
}

function riskScoreFromLevel(level: string): number {
  const normalized = level.toLowerCase();
  switch (normalized) {
    case 'critical':
      return 90;
    case 'high':
      return 70;
    case 'medium':
      return 45;
    case 'low':
      return 15;
    default:
      return 30;
  }
}

/**
 * Generate relative dates for demo endpoint data.
 *
 * Produces a representative sample of ~28 endpoints across 8 services
 * with a realistic mix of HTTP methods, risk levels, and schema coverage.
 * The `stats.totalEndpoints: 487` claim represents the full fleet
 * across all pages; this function returns what would be "page 1" in a
 * real paginated response.
 *
 * Services are ordered by request volume in the inventory builder, so
 * the services listed first here tend to dominate the treemap.
 */
function generateDemoEndpoints(): ApiEndpoint[] {
  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString();

  // [method, path, service, firstSeenDaysAgo, lastSeenDaysAgo, risk, hasSchema]
  type Row = [string, string, string, number, number, ApiEndpoint['riskLevel'], boolean];
  const rows: Row[] = [
    // auth-service — security-critical, high blast radius
    ['POST', '/api/v1/auth/login',           'auth-service',    30, 0, 'critical', false],
    ['POST', '/api/v1/auth/logout',          'auth-service',    30, 0, 'low',      true],
    ['POST', '/api/v1/auth/refresh',         'auth-service',    28, 0, 'high',     true],
    ['POST', '/api/v1/auth/reset-password',  'auth-service',    22, 1, 'high',     true],
    ['GET',  '/api/v1/auth/session',         'auth-service',    30, 0, 'medium',   true],

    // user-service — PII-heavy, high volume
    ['GET',  '/api/v1/users',                'user-service',    30, 0, 'medium',   true],
    ['POST', '/api/v1/users',                'user-service',    30, 0, 'high',     true],
    ['GET',  '/api/v1/users/:id',            'user-service',    30, 0, 'medium',   true],
    ['PUT',  '/api/v1/users/:id',            'user-service',    28, 0, 'medium',   true],
    ['DELETE','/api/v1/users/:id',           'user-service',    25, 1, 'critical', true],
    ['GET',  '/api/v1/users/:id/profile',    'user-service',    28, 0, 'low',      true],

    // catalog-service — public read-heavy, lower risk
    ['GET',  '/api/v1/products',             'catalog-service', 30, 0, 'low',      true],
    ['GET',  '/api/v1/products/:id',         'catalog-service', 30, 0, 'low',      true],
    ['GET',  '/api/v1/categories',           'catalog-service', 30, 0, 'low',      true],
    ['GET',  '/api/v1/search',               'catalog-service', 14, 0, 'medium',   true],

    // order-service
    ['POST', '/api/v1/orders',               'order-service',   30, 0, 'high',     true],
    ['GET',  '/api/v1/orders/:id',           'order-service',   30, 0, 'medium',   true],
    ['PATCH','/api/v1/orders/:id/status',    'order-service',   12, 0, 'high',     true],

    // payment-service — most sensitive, strictest schema enforcement
    ['POST', '/api/v1/checkout',             'payment-service', 30, 0, 'critical', true],
    ['POST', '/api/v1/payments/charge',      'payment-service', 30, 0, 'critical', true],
    ['POST', '/api/v1/payments/refund',      'payment-service', 20, 2, 'critical', true],

    // notification-service
    ['POST', '/api/v1/notifications',        'notification-service', 18, 0, 'low',      true],
    ['GET',  '/api/v1/notifications',        'notification-service', 18, 0, 'low',      true],

    // analytics-service — often missing schemas (auto-discovered)
    ['POST', '/api/v1/analytics/events',     'analytics-service',     9, 0, 'low',      false],
    ['GET',  '/api/v1/analytics/dashboard',  'analytics-service',     7, 0, 'medium',   false],

    // admin-service — least-discovered, higher risk per endpoint
    ['GET',  '/api/v1/admin/audit-log',      'admin-service',         5, 0, 'high',     true],
    ['POST', '/api/v1/admin/impersonate',    'admin-service',         3, 0, 'critical', false],
    ['GET',  '/api/v1/admin/debug',          'admin-service',         2, 1, 'high',     false],
  ];

  return rows.map((row, i) => ({
    id: String(i + 1),
    method: row[0],
    path: row[1],
    service: row[2],
    firstSeenAt: daysAgo(row[3]),
    lastSeenAt: daysAgo(row[4]),
    riskLevel: row[5],
    hasSchema: row[6],
  }));
}

function buildInventory(endpoints: InventoryEndpoint[]): FleetInventory {
  const serviceMap = new Map<string, { endpoints: InventoryEndpoint[]; totalRequests: number; totalRisk: number }>();

  endpoints.forEach((endpoint) => {
    const entry = serviceMap.get(endpoint.service) ?? { endpoints: [], totalRequests: 0, totalRisk: 0 };
    entry.endpoints.push(endpoint);
    entry.totalRequests += endpoint.requestCount;
    entry.totalRisk += endpoint.riskScore;
    serviceMap.set(endpoint.service, entry);
  });

  const services: InventoryService[] = Array.from(serviceMap.entries()).map(([service, data]) => ({
    service,
    endpointCount: data.endpoints.length,
    totalRequests: data.totalRequests,
    avgRiskScore: data.endpoints.length > 0 ? Math.round(data.totalRisk / data.endpoints.length) : 0,
    endpoints: data.endpoints.sort((a, b) => b.requestCount - a.requestCount),
  }));

  const totalEndpoints = endpoints.length;
  const totalRequests = endpoints.reduce((sum, endpoint) => sum + endpoint.requestCount, 0);

  return {
    totalEndpoints,
    totalRequests,
    services: services.sort((a, b) => b.totalRequests - a.totalRequests),
  };
}

function generateDemoInventory(): FleetInventory {
  const demoEndpoints = generateDemoEndpoints().map((endpoint, index) => ({
    id: endpoint.id,
    path: endpoint.path,
    pathTemplate: endpoint.path,
    method: endpoint.method,
    service: endpoint.service,
    sensorId: `sensor-${(index % 3) + 1}`,
    requestCount: 500 + index * 200,
    riskLevel: endpoint.riskLevel,
    riskScore: riskScoreFromLevel(endpoint.riskLevel),
    lastSeenAt: endpoint.lastSeenAt,
  }));

  return buildInventory(demoEndpoints);
}

function generateDemoSchemaChanges(): SchemaChange[] {
  const now = Date.now();
  return [
    {
      id: 'sch-1',
      endpoint: '/api/v1/checkout',
      method: 'POST',
      service: 'payment-service',
      changeType: 'modified',
      field: 'body.amount',
      oldValue: 'number',
      newValue: 'string',
      riskLevel: 'high',
      detectedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      breaking: true,
    },
    {
      id: 'sch-2',
      endpoint: '/api/v1/users/profile',
      method: 'GET',
      service: 'user-service',
      changeType: 'added',
      field: 'response.social_links',
      oldValue: null,
      newValue: 'array',
      riskLevel: 'low',
      detectedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      breaking: false,
    },
  ];
}

function generateDemoEndpointDriftTrends(): EndpointDriftTrend[] {
  const endpoints = [
    { endpoint: '/api/v1/users', method: 'POST', service: 'user-service' },
    { endpoint: '/api/v1/orders', method: 'GET', service: 'order-service' },
    { endpoint: '/api/v1/auth/login', method: 'POST', service: 'auth-service' },
  ];

  const days = 7;
  const dateKeys = Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  });

  // Deterministic per-endpoint series. Previously used Math.random()
  // which re-rolled every render, making the chart visibly flicker in
  // StrictMode. Using a fixed pseudo-noise curve keeps each reload
  // stable while still looking like real drift activity.
  const seeds = [
    [3, 5, 4, 8, 6, 4, 2],
    [6, 4, 7, 5, 9, 6, 5],
    [2, 6, 5, 11, 7, 4, 3],
  ];

  return endpoints.map((entry, index) => {
    const series = dateKeys.map((date, offset) => ({
      date,
      count: seeds[index]?.[offset] ?? 0,
    }));
    const total = series.reduce((sum, item) => sum + item.count, 0);
    return { ...entry, total, series };
  });
}

export interface PaginationState {
  offset: number;
  limit: number;
}

interface UseApiIntelligenceOptions {
  pollInterval?: number;
}

export function useApiIntelligence(options: UseApiIntelligenceOptions = {}) {
  const { pollInterval = 30000 } = options;
  const { isEnabled } = useDemoMode();
  const abortControllerRef = useRef<AbortController | null>(null);
  // Token-based request coordination:
  // - React StrictMode will mount/unmount effects twice in dev, which can abort in-flight requests.
  // - We increment a token per fetch so stale/aborted requests never clobber state.
  const fetchTokenRef = useRef(0);

  const [stats, setStats] = useState<DiscoveryStats | null>(null);
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [signals, setSignals] = useState<ApiSignal[]>([]);
  const [inventory, setInventory] = useState<FleetInventory | null>(null);
  const [schemaChanges, setSchemaChanges] = useState<SchemaChange[]>([]);
  const [endpointDriftTrends, setEndpointDriftTrends] = useState<EndpointDriftTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({ offset: 0, limit: 20 });
  const [totalEndpoints, setTotalEndpoints] = useState(0);

  const fetchStats = useCallback(async () => {
    const token = ++fetchTokenRef.current;

    // Cancel any in-flight request (best-effort)
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    if (isEnabled) {
      // Demo Mode Data with relative dates - no polling
      const now = new Date();
      const demoEndpoints = generateDemoEndpoints();
      setStats({
        totalEndpoints: 487,
        newThisWeek: 12,
        newToday: 3,
        schemaViolations24h: 45,
        schemaViolations7d: 312,
        coveragePercent: 94,
        topViolatingEndpoints: [
          { endpoint: '/api/v1/users', method: 'POST', violationCount: 156 },
          { endpoint: '/api/v1/auth/login', method: 'POST', violationCount: 89 },
          { endpoint: '/api/v1/orders', method: 'GET', violationCount: 45 },
        ],
        endpointsByMethod: { GET: 245, POST: 120, PUT: 45, DELETE: 30, PATCH: 47 },
        discoveryTrend: generateDemoDiscoveryTrend(),
      });
      setEndpoints(demoEndpoints);
      setTotalEndpoints(demoEndpoints.length);
      setSignals([
        { id: 's1', signalType: 'SCHEMA_VIOLATION', fingerprint: 'POST:/api/v1/users', severity: 'MEDIUM', createdAt: now.toISOString(), metadata: { endpoint: '/api/v1/users', method: 'POST', violationType: 'TYPE_MISMATCH', violationMessage: 'Expected string, got number' } },
        { id: 's2', signalType: 'TEMPLATE_DISCOVERY', fingerprint: '/api/v1/admin/debug', severity: 'LOW', createdAt: new Date(now.getTime() - 3600000).toISOString(), metadata: { endpoint: '/api/v1/admin/debug', method: 'GET' } },
      ]);
      setInventory(generateDemoInventory());
      setSchemaChanges(generateDemoSchemaChanges());
      setEndpointDriftTrends(generateDemoEndpointDriftTrends());
      setIsLoading(false);
      setLastUpdated(new Date());
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      const [
        statsData,
        endpointsData,
        signalsData,
        inventoryData,
        schemaChangesData,
        driftTrendsData,
      ] = await Promise.all([
        apiFetch<unknown>('/api-intelligence/stats', { signal }),
        apiFetch<unknown>(`/api-intelligence/endpoints?limit=${pagination.limit}&offset=${pagination.offset}`, { signal }),
        apiFetch<unknown>('/api-intelligence/signals?limit=20', { signal }),
        apiFetch<unknown>('/api-intelligence/inventory', { signal }),
        apiFetch<unknown>('/api-intelligence/schema-changes?limit=20', { signal }),
        apiFetch<unknown>('/api-intelligence/violations/trends/endpoints?days=7&limit=5', { signal }),
      ]);

      // Ignore stale results (e.g., StrictMode abort/restart)
      if (token !== fetchTokenRef.current) return;

      // Validate responses with Zod
      const statsResult = DiscoveryStatsSchema.safeParse(statsData);
      if (!statsResult.success) {
        console.error('Stats validation error:', statsResult.error);
        throw new Error('Invalid stats response format');
      }
      setStats(statsResult.data);

      const endpointsResult = EndpointsResponseSchema.safeParse(endpointsData);
      if (!endpointsResult.success) {
        console.error('Endpoints validation error:', endpointsResult.error);
        throw new Error('Invalid endpoints response format');
      }
      setEndpoints(endpointsResult.data.endpoints);
      setTotalEndpoints(endpointsResult.data.total ?? endpointsResult.data.endpoints.length);

      const signalsResult = SignalsResponseSchema.safeParse(signalsData);
      if (!signalsResult.success) {
        console.error('Signals validation error:', signalsResult.error);
        throw new Error('Invalid signals response format');
      }
      setSignals(signalsResult.data.signals);

      const inventoryResult = FleetInventorySchema.safeParse(inventoryData);
      if (!inventoryResult.success) {
        console.error('Inventory validation error:', inventoryResult.error);
        throw new Error('Invalid inventory response format');
      }
      setInventory(inventoryResult.data);

      const schemaChangesResult = SchemaChangesResponseSchema.safeParse(schemaChangesData);
      if (!schemaChangesResult.success) {
        console.error('Schema changes validation error:', schemaChangesResult.error);
        throw new Error('Invalid schema changes response format');
      }
      setSchemaChanges(schemaChangesResult.data.changes);

      const driftTrendsResult = EndpointDriftTrendsResponseSchema.safeParse(driftTrendsData);
      if (!driftTrendsResult.success) {
        console.error('Endpoint drift trends validation error:', driftTrendsResult.error);
        throw new Error('Invalid endpoint drift trends response format');
      }
      setEndpointDriftTrends(driftTrendsResult.data.trends);

      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Ignore stale errors
      if (token !== fetchTokenRef.current) return;

      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('API Intelligence fetch error:', err);
      setError(err as Error);
    } finally {
      // Only the latest in-flight request should mutate loading state.
      if (token === fetchTokenRef.current) {
        setIsLoading(false);
      }
    }
  }, [isEnabled, pagination.limit, pagination.offset]);

  const refetch = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  // Initial fetch and polling setup
  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Don't poll in demo mode
    if (isEnabled) {
      setIsPolling(false);
      return;
    }

    // Set up polling
    setIsPolling(true);
    const intervalId = setInterval(fetchStats, pollInterval);

    return () => {
      // Invalidate any in-flight request before aborting so stale handlers become no-ops.
      fetchTokenRef.current += 1;
      clearInterval(intervalId);
      abortControllerRef.current?.abort();
      setIsPolling(false);
    };
  }, [isEnabled, pollInterval, fetchStats]);

  // Compute hasMore
  const hasMore = pagination.offset + endpoints.length < totalEndpoints;

  return {
    stats,
    endpoints,
    signals,
    inventory,
    schemaChanges,
    endpointDriftTrends,
    isLoading,
    error,
    refetch,
    lastUpdated,
    isPolling,
    pagination,
    setPagination,
    totalEndpoints,
    hasMore,
  };
}

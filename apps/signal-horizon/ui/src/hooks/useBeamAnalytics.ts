/**
 * useBeamAnalytics Hook
 * Fetches analytics data from signal-horizon API with automatic polling
 * and demo data fallback when the API is unavailable.
 */

import { useApiPolling } from './useApiPolling';
import { useDemoMode } from '../stores/demoModeStore';
import { getDemoData } from '../lib/demoData';

// ============================================================================
// Types (mirrored from API)
// ============================================================================

export interface TrafficTimelinePoint {
  timestamp: string;
  requests: number;
  blocked: number;
  bytesIn: number;
  bytesOut: number;
}

export interface TrafficOverview {
  totalRequests: number;
  totalBlocked: number;
  totalBandwidthIn: number;
  totalBandwidthOut: number;
  blockRate: number;
  timeline: TrafficTimelinePoint[];
}

export interface BandwidthTimelineBucket {
  timestamp: string;
  bytesIn: number;
  bytesOut: number;
  requestCount: number;
}

export interface EndpointBandwidth {
  template: string;
  method: string;
  requests: number;
  avgRequestSize: number;
  avgResponseSize: number;
  totalBytes: number;
}

export interface BandwidthAnalytics {
  timeline: BandwidthTimelineBucket[];
  topEndpoints: EndpointBandwidth[];
  totalBytesIn: number;
  totalBytesOut: number;
  avgBytesPerRequest: number;
}

export interface ThreatEvent {
  id: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  description: string;
  entityId?: string;
  sourceIp?: string;
  blocked: boolean;
}

export interface ThreatSummary {
  total: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: Record<string, number>;
  recentEvents: ThreatEvent[];
}

export interface SensorMetrics {
  requestsTotal: number;
  blocksTotal: number;
  entitiesTracked: number;
  activeCampaigns: number;
  uptime: number;
  rps: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}

export interface TopEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  path: string;
  requests: number;
  avgLatency: number;
  errorRate: number;
  bandwidthIn: number;
  bandwidthOut: number;
}

export interface ResponseTimeBucket {
  range: string;
  count: number;
  percentage: number;
}

export interface RegionTraffic {
  countryCode: string;
  countryName: string;
  requests: number;
  percentage: number;
  blocked: number;
}

export interface StatusCodeDistribution {
  code2xx: number;
  code3xx: number;
  code4xx: number;
  code5xx: number;
}

export interface BeamAnalyticsData {
  traffic: TrafficOverview;
  bandwidth: BandwidthAnalytics;
  threats: ThreatSummary;
  sensor: SensorMetrics;
  topEndpoints: TopEndpoint[];
  responseTimeDistribution: ResponseTimeBucket[];
  regionTraffic: RegionTraffic[];
  statusCodes: StatusCodeDistribution;
  fetchedAt: string;
  dataSource: 'live' | 'demo' | 'mixed';
}

// ============================================================================
// Hook Configuration
// ============================================================================

export interface UseBeamAnalyticsOptions {
  /** Polling interval in milliseconds (default: 30000 = 30s) */
  pollingInterval?: number;
  /** Whether to start fetching immediately (default: true) */
  autoFetch?: boolean;
}

export interface UseBeamAnalyticsResult {
  data: BeamAnalyticsData;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isDemo: boolean;
  lastUpdated: Date | null;
}

// ============================================================================
// Default/Demo Data
// ============================================================================

function generateDemoData(): BeamAnalyticsData {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const baseRequests = 80000 + Math.random() * 40000;
    const blockedRate = 0.02 + Math.random() * 0.03;
    return {
      timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
      requests: Math.round(baseRequests),
      blocked: Math.round(baseRequests * blockedRate),
      bytesIn: Math.round(baseRequests * 1500),
      bytesOut: Math.round(baseRequests * 4500),
    };
  });

  const totalRequests = hours.reduce((sum, h) => sum + h.requests, 0);
  const totalBlocked = hours.reduce((sum, h) => sum + h.blocked, 0);

  return {
    traffic: {
      totalRequests,
      totalBlocked,
      totalBandwidthIn: hours.reduce((sum, h) => sum + h.bytesIn, 0),
      totalBandwidthOut: hours.reduce((sum, h) => sum + h.bytesOut, 0),
      blockRate: (totalBlocked / totalRequests) * 100,
      timeline: hours,
    },
    bandwidth: {
      timeline: hours.map(h => ({
        timestamp: h.timestamp,
        bytesIn: h.bytesIn,
        bytesOut: h.bytesOut,
        requestCount: h.requests,
      })),
      topEndpoints: [],
      totalBytesIn: hours.reduce((sum, h) => sum + h.bytesIn, 0),
      totalBytesOut: hours.reduce((sum, h) => sum + h.bytesOut, 0),
      avgBytesPerRequest: 6000,
    },
    threats: {
      total: 2847,
      bySeverity: { critical: 127, high: 534, medium: 1089, low: 1097 },
      byType: {
        'SQL_INJECTION': 847,
        'BOT_TRAFFIC': 721,
        'XSS': 534,
        'BRUTE_FORCE': 398,
        'SCRAPING': 267,
      },
      recentEvents: [],
    },
    sensor: {
      requestsTotal: totalRequests,
      blocksTotal: totalBlocked,
      entitiesTracked: 12847,
      activeCampaigns: 3,
      uptime: 99.95,
      rps: 1847,
      latencyP50: 23,
      latencyP95: 67,
      latencyP99: 245,
    },
    topEndpoints: [
      { method: 'GET', path: '/api/v2/users', requests: 342000, avgLatency: 32, errorRate: 0.12, bandwidthIn: 51300000, bandwidthOut: 1539000000 },
      { method: 'POST', path: '/api/v2/auth/login', requests: 187000, avgLatency: 89, errorRate: 0.45, bandwidthIn: 93500000, bandwidthOut: 187000000 },
      { method: 'GET', path: '/api/v2/products', requests: 156000, avgLatency: 45, errorRate: 0.08, bandwidthIn: 23400000, bandwidthOut: 780000000 },
      { method: 'PUT', path: '/api/v2/cart', requests: 98000, avgLatency: 67, errorRate: 0.23, bandwidthIn: 49000000, bandwidthOut: 98000000 },
      { method: 'GET', path: '/api/v2/orders', requests: 76000, avgLatency: 112, errorRate: 0.34, bandwidthIn: 11400000, bandwidthOut: 456000000 },
      { method: 'DELETE', path: '/api/v2/sessions', requests: 54000, avgLatency: 23, errorRate: 0.02, bandwidthIn: 5400000, bandwidthOut: 27000000 },
    ],
    responseTimeDistribution: [
      { range: '<25ms', count: 45230, percentage: 38.2 },
      { range: '25-50ms', count: 32100, percentage: 27.1 },
      { range: '50-100ms', count: 21500, percentage: 18.2 },
      { range: '100-250ms', count: 12300, percentage: 10.4 },
      { range: '250-500ms', count: 5200, percentage: 4.4 },
      { range: '>500ms', count: 2100, percentage: 1.8 },
    ],
    regionTraffic: [
      { countryCode: 'US', countryName: 'United States', requests: 892000, percentage: 37.2, blocked: 18400 },
      { countryCode: 'GB', countryName: 'United Kingdom', requests: 412000, percentage: 17.2, blocked: 8200 },
      { countryCode: 'DE', countryName: 'Germany', requests: 298000, percentage: 12.4, blocked: 5900 },
      { countryCode: 'FR', countryName: 'France', requests: 245000, percentage: 10.2, blocked: 4900 },
      { countryCode: 'JP', countryName: 'Japan', requests: 187000, percentage: 7.8, blocked: 3700 },
      { countryCode: 'CA', countryName: 'Canada', requests: 156000, percentage: 6.5, blocked: 3100 },
      { countryCode: 'AU', countryName: 'Australia', requests: 98000, percentage: 4.1, blocked: 1900 },
      { countryCode: 'NL', countryName: 'Netherlands', requests: 112000, percentage: 4.7, blocked: 2200 },
    ],
    statusCodes: {
      code2xx: 2145000,
      code3xx: 156000,
      code4xx: 89000,
      code5xx: 12000,
    },
    fetchedAt: new Date().toISOString(),
    dataSource: 'demo',
  };
}

// Generate demo data once to use as initial data
const DEMO_DATA = generateDemoData();

// ============================================================================
// Hook Implementation
// ============================================================================

export function useBeamAnalytics(options: UseBeamAnalyticsOptions = {}): UseBeamAnalyticsResult {
  const { pollingInterval = 30000, autoFetch = true } = options;

  const { isEnabled, scenario } = useDemoMode();

  // Early return for demo mode - no API calls, no polling
  if (isEnabled) {
    const demoData = getDemoData(scenario);

    // Map demo data snapshot to BeamAnalyticsData format
    const analyticsData: BeamAnalyticsData = {
      traffic: {
        totalRequests: demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.requests, 0),
        totalBlocked: demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.blocked, 0),
        totalBandwidthIn: demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.requests * 1500, 0),
        totalBandwidthOut: demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.requests * 4500, 0),
        blockRate: (() => {
          const total = demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.requests, 0);
          const blocked = demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.blocked, 0);
          return total > 0 ? (blocked / total) * 100 : 0;
        })(),
        timeline: demoData.analytics.trafficHourly.map(h => ({
          timestamp: h.timestamp,
          requests: h.requests,
          blocked: h.blocked,
          bytesIn: h.requests * 1500,
          bytesOut: h.requests * 4500,
        })),
      },
      bandwidth: {
        timeline: demoData.analytics.trafficHourly.map(h => ({
          timestamp: h.timestamp,
          bytesIn: h.requests * 1500,
          bytesOut: h.requests * 4500,
          requestCount: h.requests,
        })),
        topEndpoints: [],
        totalBytesIn: demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.requests * 1500, 0),
        totalBytesOut: demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.requests * 4500, 0),
        avgBytesPerRequest: 6000,
      },
      threats: {
        total: demoData.threatEvents.length,
        bySeverity: {
          // Map action to severity for demo purposes
          critical: demoData.threatEvents.filter(t => t.action === 'blocked').length,
          high: Math.floor(demoData.threatEvents.filter(t => t.action === 'challenged').length * 0.5),
          medium: Math.floor(demoData.threatEvents.filter(t => t.action === 'challenged').length * 0.5),
          low: demoData.threatEvents.filter(t => t.action === 'throttled').length,
        },
        byType: demoData.threatEvents.reduce((acc, t) => {
          acc[t.type] = (acc[t.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentEvents: demoData.threatEvents.slice(0, 10).map(t => ({
          id: t.id,
          timestamp: t.timestamp,
          severity: (t.action === 'blocked' ? 'CRITICAL' : t.action === 'challenged' ? 'HIGH' : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          type: t.type,
          description: `${t.type} detected from ${t.sourceIp}`,
          entityId: undefined,
          sourceIp: t.sourceIp,
          blocked: t.action === 'blocked',
        })),
      },
      sensor: {
        requestsTotal: demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.requests, 0),
        blocksTotal: demoData.analytics.trafficHourly.reduce((sum, h) => sum + h.blocked, 0),
        entitiesTracked: 12847,
        activeCampaigns: 3,
        uptime: 99.95,
        rps: 1847,
        latencyP50: 23,
        latencyP95: 67,
        latencyP99: 245,
      },
      topEndpoints: demoData.analytics.topEndpoints.slice(0, 6).map((ep, idx) => ({
        method: (['GET', 'POST', 'PUT', 'DELETE', 'GET', 'GET'] as const)[idx % 6],
        path: ep.endpoint.replace(/^(GET|POST|PUT|DELETE|PATCH) /, ''),
        requests: ep.requests,
        avgLatency: 30 + Math.random() * 80,
        errorRate: 0.05 + Math.random() * 0.4,
        bandwidthIn: ep.requests * 1500,
        bandwidthOut: ep.requests * 4500,
      })),
      responseTimeDistribution: [
        { range: '<25ms', count: 45230, percentage: 38.2 },
        { range: '25-50ms', count: 32100, percentage: 27.1 },
        { range: '50-100ms', count: 21500, percentage: 18.2 },
        { range: '100-250ms', count: 12300, percentage: 10.4 },
        { range: '250-500ms', count: 5200, percentage: 4.4 },
        { range: '>500ms', count: 2100, percentage: 1.8 },
      ],
      regionTraffic: [
        { countryCode: 'US', countryName: 'United States', requests: 892000, percentage: 37.2, blocked: 18400 },
        { countryCode: 'GB', countryName: 'United Kingdom', requests: 412000, percentage: 17.2, blocked: 8200 },
        { countryCode: 'DE', countryName: 'Germany', requests: 298000, percentage: 12.4, blocked: 5900 },
        { countryCode: 'FR', countryName: 'France', requests: 245000, percentage: 10.2, blocked: 4900 },
        { countryCode: 'JP', countryName: 'Japan', requests: 187000, percentage: 7.8, blocked: 3700 },
        { countryCode: 'CA', countryName: 'Canada', requests: 156000, percentage: 6.5, blocked: 3100 },
        { countryCode: 'AU', countryName: 'Australia', requests: 98000, percentage: 4.1, blocked: 1900 },
        { countryCode: 'NL', countryName: 'Netherlands', requests: 112000, percentage: 4.7, blocked: 2200 },
      ],
      statusCodes: {
        code2xx: 2145000,
        code3xx: 156000,
        code4xx: 89000,
        code5xx: 12000,
      },
      fetchedAt: demoData.generatedAt,
      dataSource: 'demo',
    };

    return {
      data: analyticsData,
      isLoading: false,
      error: null,
      refetch: async () => {},
      isDemo: true,
      lastUpdated: new Date(demoData.generatedAt),
    };
  }

  const result = useApiPolling<BeamAnalyticsData>({
    endpoint: '/beam/analytics',
    initialData: DEMO_DATA,
    pollInterval: pollingInterval,
    enabled: autoFetch,
    transform: (data) => data as BeamAnalyticsData,
  });

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    isDemo: result.isDemo,
    lastUpdated: result.lastUpdated,
  };
}

export default useBeamAnalytics;

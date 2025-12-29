/**
 * useBeamThreats Hook
 * Fetches blocked requests and threat activity from Signal Horizon API
 * with pagination, filtering, and real-time polling.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import type { BlockedRequest, AttackPattern, ThreatEvent } from '../types/beam';

// ============================================================================
// API Response Types
// ============================================================================

interface ThreatsApiResponse {
  blocks: ApiBlockDecision[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ApiBlockDecision {
  id: string;
  action: string;
  severity: string;
  threatType: string;
  sourceIp: string;
  path: string;
  method: string;
  ruleId?: string;
  riskScore: number;
  decidedAt: string;
  sensor?: { id: string; name: string };
}

interface BlockDetailResponse {
  block: ApiBlockDecision & {
    sensor?: { id: string; name: string; version: string };
  };
}

// ============================================================================
// Hook Configuration
// ============================================================================

export type ThreatTimeRange = '1h' | '6h' | '24h' | '7d' | '30d';
export type ThreatSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ThreatStatus = 'blocked' | 'challenged' | 'throttled' | 'logged';

export interface ThreatQueryParams {
  severity?: ThreatSeverity;
  status?: ThreatStatus;
  timeRange?: ThreatTimeRange;
  limit?: number;
  offset?: number;
}

export interface UseBeamThreatsOptions {
  /** Polling interval in milliseconds (default: 15000 = 15s for real-time feel) */
  pollingInterval?: number;
  /** Whether to start fetching immediately (default: true) */
  autoFetch?: boolean;
  /** Query parameters for filtering */
  queryParams?: ThreatQueryParams;
}

export interface UseBeamThreatsResult {
  blocks: BlockedRequest[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  attackPatterns: AttackPattern[];
  recentEvents: ThreatEvent[];
  isLoading: boolean;
  error: string | null;
  isDemo: boolean;
  /** @deprecated Use `!isDemo` instead */
  isConnected: boolean;
  refetch: () => Promise<void>;
  fetchBlockById: (id: string) => Promise<BlockedRequest | null>;
  loadMore: () => Promise<void>;
  lastUpdated: Date | null;
  stats: {
    total: number;
    blocked: number;
    challenged: number;
    criticalCount: number;
    highCount: number;
  };
}

// ============================================================================
// Demo Data Generator
// ============================================================================

function generateDemoBlocks(): BlockedRequest[] {
  const actions = ['blocked', 'challenged', 'throttled', 'logged'] as const;
  const threatTypes = ['SQL_INJECTION', 'XSS', 'BOT_TRAFFIC', 'BRUTE_FORCE', 'SCRAPING', 'CREDENTIAL_STUFFING'];
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const endpoints = [
    '/api/v2/users',
    '/api/v2/auth/login',
    '/api/v2/products',
    '/api/v2/cart',
    '/api/v2/orders',
    '/api/v2/payments',
  ];

  return Array.from({ length: 100 }, (_, i) => ({
    id: `block-${i + 1}`,
    timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    action: actions[Math.floor(Math.random() * actions.length)],
    threatType: threatTypes[Math.floor(Math.random() * threatTypes.length)],
    sourceIp: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
    method: methods[Math.floor(Math.random() * methods.length)],
    ruleId: `rule-${Math.floor(Math.random() * 5) + 1}`,
    ruleName: `Protection Rule ${Math.floor(Math.random() * 5) + 1}`,
    riskScore: Math.floor(Math.random() * 100),
  }));
}

function generateDemoPatterns(): AttackPattern[] {
  return [
    { type: 'SQL_INJECTION', count: 847, percentage: 29.7, trend: 12.5 },
    { type: 'BOT_TRAFFIC', count: 721, percentage: 25.3, trend: -5.2 },
    { type: 'XSS', count: 534, percentage: 18.8, trend: 8.7 },
    { type: 'BRUTE_FORCE', count: 398, percentage: 14.0, trend: 15.3 },
    { type: 'SCRAPING', count: 347, percentage: 12.2, trend: -2.1 },
  ];
}

// Generate demo data once
const DEMO_BLOCKS = generateDemoBlocks();
const DEMO_PATTERNS = generateDemoPatterns();

// ============================================================================
// Hook Implementation
// ============================================================================

export function useBeamThreats(options: UseBeamThreatsOptions = {}): UseBeamThreatsResult {
  const {
    pollingInterval = 15000,
    autoFetch = true,
    queryParams = {},
  } = options;

  const [blocks, setBlocks] = useState<BlockedRequest[]>(DEMO_BLOCKS);
  const [pagination, setPagination] = useState({
    total: DEMO_BLOCKS.length,
    limit: queryParams.limit || 50,
    offset: queryParams.offset || 0,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const intervalRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);

  // Transform API block to UI BlockedRequest
  const transformBlock = useCallback((apiBlock: ApiBlockDecision): BlockedRequest => ({
    id: apiBlock.id,
    timestamp: apiBlock.decidedAt,
    action: apiBlock.action as BlockedRequest['action'],
    threatType: apiBlock.threatType,
    sourceIp: apiBlock.sourceIp,
    endpoint: apiBlock.path,
    method: apiBlock.method,
    ruleId: apiBlock.ruleId,
    riskScore: apiBlock.riskScore,
  }), []);

  const fetchData = useCallback(async (append = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (queryParams.severity) params.set('severity', queryParams.severity);
      if (queryParams.status) params.set('status', queryParams.status);
      if (queryParams.timeRange) params.set('timeRange', queryParams.timeRange);
      params.set('limit', (queryParams.limit || 50).toString());
      params.set('offset', (append ? pagination.offset + pagination.limit : queryParams.offset || 0).toString());

      const data = await apiFetch<ThreatsApiResponse>(`/beam/threats?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      const transformedBlocks = data.blocks.map(transformBlock);

      if (append) {
        setBlocks(prev => [...prev, ...transformedBlocks]);
      } else {
        setBlocks(transformedBlocks);
      }

      setPagination(data.pagination);
      setIsDemo(false);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[useBeamThreats] API failed, using demo data:', errorMessage);
      setError(errorMessage);
      setIsDemo(true);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [queryParams, transformBlock, pagination.offset, pagination.limit]);

  const loadMore = useCallback(async () => {
    if (pagination.hasMore && !isLoading) {
      await fetchData(true);
    }
  }, [pagination.hasMore, isLoading, fetchData]);

  const fetchBlockById = useCallback(async (id: string): Promise<BlockedRequest | null> => {
    try {
      const data = await apiFetch<BlockDetailResponse>(`/beam/threats/${id}`);
      return transformBlock(data.block);
    } catch (err) {
      console.warn('[useBeamThreats] Failed to fetch block details:', err);
      return null;
    }
  }, [transformBlock]);

  // Derive recent events from blocks
  const recentEvents = useMemo<ThreatEvent[]>(() =>
    blocks.slice(0, 10).map(block => ({
      id: block.id,
      timestamp: block.timestamp,
      type: block.threatType,
      sourceIp: block.sourceIp,
      action: block.action,
      rule: block.ruleName,
    })),
  [blocks]);

  // Computed stats
  const stats = useMemo(() => ({
    total: pagination.total,
    blocked: blocks.filter(b => b.action === 'blocked').length,
    challenged: blocks.filter(b => b.action === 'challenged').length,
    criticalCount: blocks.filter(b => b.riskScore >= 80).length,
    highCount: blocks.filter(b => b.riskScore >= 60 && b.riskScore < 80).length,
  }), [blocks, pagination.total]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) fetchData();
    return () => { abortControllerRef.current?.abort(); };
  }, [autoFetch]);

  // Refetch when query params change
  useEffect(() => {
    if (autoFetch) fetchData();
  }, [queryParams.severity, queryParams.status, queryParams.timeRange]);

  // Polling
  useEffect(() => {
    if (pollingInterval > 0) {
      intervalRef.current = window.setInterval(() => fetchData(false), pollingInterval);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pollingInterval]);

  return {
    blocks,
    pagination,
    attackPatterns: DEMO_PATTERNS,
    recentEvents,
    isLoading,
    error,
    isDemo,
    isConnected: !isDemo,
    refetch: () => fetchData(false),
    fetchBlockById,
    loadMore,
    lastUpdated,
    stats,
  };
}

export default useBeamThreats;

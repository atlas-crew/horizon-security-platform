import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBeamThreats } from './useBeamThreats';

// Mock fetch globally
const mockFetch = vi.fn();

function mockJsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function mockErrorResponse(status: number, statusText: string, data: unknown = {}) {
  return {
    ok: false,
    status,
    statusText,
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

describe('useBeamThreats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Mock API response format (matches ThreatsApiResponse interface)
  const mockThreatsData = {
    blocks: [
      {
        id: 'clx333ccc',
        action: 'blocked',
        severity: 'HIGH',
        threatType: 'BRUTE_FORCE',
        sourceIp: '192.168.1.100',
        path: '/api/v2/users/login',
        method: 'POST',
        ruleId: 'clx777xxx',
        riskScore: 85,
        decidedAt: '2025-12-22T20:35:00Z',
        sensor: { id: 'clx789ghi', name: 'prod-sensor-01' }
      }
    ],
    pagination: {
      total: 156,
      limit: 50,
      offset: 0,
      hasMore: true
    }
  };

  describe('initial state', () => {
    it('should start with demo data when autoFetch is disabled', () => {
      const { result } = renderHook(() => useBeamThreats({ autoFetch: false }));

      // Hook now initializes with demo data for better UX
      expect(result.current.blocks.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
      expect(result.current.isDemo).toBe(true);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('successful data fetching', () => {
    it('should fetch threats data successfully', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(mockThreatsData));

      const { result } = renderHook(() => useBeamThreats({ pollingInterval: 0 }));

      // Wait for API fetch to complete (isDemo becomes false)
      await waitFor(() => {
        expect(result.current.isDemo).toBe(false);
      }, { timeout: 3000 });

      expect(result.current.blocks[0].sourceIp).toBe('192.168.1.100');
      expect(result.current.error).toBeNull();
      expect(result.current.isConnected).toBe(true);
    });

    it('should call the correct API endpoint', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(mockThreatsData));

      renderHook(() => useBeamThreats({ pollingInterval: 0 }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/beam/threats'),
        expect.any(Object)
      );
    });

    it('should pass queryParams to API call', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(mockThreatsData));

      renderHook(() =>
        useBeamThreats({ queryParams: { limit: 20, severity: 'CRITICAL' }, pollingInterval: 0 })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('severity=CRITICAL'),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should keep demo data on network error and set error state', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useBeamThreats({ pollingInterval: 0 }));

      // Wait for error state to be set after fetch fails
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      }, { timeout: 3000 });

      // Falls back to demo data
      expect(result.current.blocks.length).toBeGreaterThan(0);
      expect(result.current.isDemo).toBe(true);
      expect(result.current.isConnected).toBe(false);
    });

    it('should handle HTTP 401 errors', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(401, 'Unauthorized', { error: 'Unauthorized' }));

      const { result } = renderHook(() => useBeamThreats({ pollingInterval: 0 }));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      }, { timeout: 3000 });

      expect(result.current.isDemo).toBe(true);
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('return interface', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useBeamThreats({ autoFetch: false }));

      expect(result.current).toHaveProperty('blocks');
      expect(result.current).toHaveProperty('pagination');
      expect(result.current).toHaveProperty('attackPatterns');
      expect(result.current).toHaveProperty('recentEvents');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
      expect(result.current).toHaveProperty('fetchBlockById');
      expect(result.current).toHaveProperty('loadMore');
      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('lastUpdated');
      expect(result.current).toHaveProperty('stats');
      expect(typeof result.current.refetch).toBe('function');
      expect(typeof result.current.loadMore).toBe('function');
      expect(typeof result.current.fetchBlockById).toBe('function');
    });
  });

  describe('computed stats', () => {
    it('should compute threat statistics from blocks', async () => {
      const dataWithMultipleBlocks = {
        blocks: [
          { ...mockThreatsData.blocks[0], riskScore: 90, action: 'blocked' },
          { ...mockThreatsData.blocks[0], id: 'block2', riskScore: 70, action: 'blocked' },
          { ...mockThreatsData.blocks[0], id: 'block3', riskScore: 50, action: 'challenged' }
        ],
        pagination: { total: 3, limit: 50, offset: 0, hasMore: false }
      };

      mockFetch.mockResolvedValue(mockJsonResponse(dataWithMultipleBlocks));

      const { result } = renderHook(() => useBeamThreats({ pollingInterval: 0 }));

      await waitFor(() => {
        expect(result.current.blocks.length).toBe(3);
      }, { timeout: 3000 });

      expect(result.current.stats.total).toBe(3);
      expect(result.current.stats.blocked).toBe(2);
      expect(result.current.stats.challenged).toBe(1);
    });
  });

  describe('data transformation', () => {
    it('should transform API blocks to BlockedRequest format', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(mockThreatsData));

      const { result } = renderHook(() => useBeamThreats({ pollingInterval: 0 }));

      await waitFor(() => {
        expect(result.current.blocks.length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      const block = result.current.blocks[0];
      expect(block).toHaveProperty('id');
      expect(block).toHaveProperty('timestamp');
      expect(block).toHaveProperty('action');
      expect(block).toHaveProperty('threatType');
      expect(block).toHaveProperty('sourceIp');
      expect(block).toHaveProperty('endpoint');
      expect(block).toHaveProperty('method');
      expect(block).toHaveProperty('riskScore');
    });
  });

  describe('recentEvents derivation', () => {
    it('should derive recentEvents from blocks', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(mockThreatsData));

      const { result } = renderHook(() => useBeamThreats({ pollingInterval: 0 }));

      await waitFor(() => {
        expect(result.current.blocks.length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      expect(result.current.recentEvents).toBeDefined();
      expect(Array.isArray(result.current.recentEvents)).toBe(true);
    });
  });

  describe('pagination', () => {
    it('should maintain pagination state', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(mockThreatsData));

      const { result } = renderHook(() => useBeamThreats({ pollingInterval: 0 }));

      await waitFor(() => {
        expect(result.current.pagination.total).toBe(156);
      }, { timeout: 3000 });

      expect(result.current.pagination.hasMore).toBe(true);
      expect(result.current.pagination.limit).toBe(50);
      expect(result.current.pagination.offset).toBe(0);
    });
  });
});

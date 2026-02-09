import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHunt } from '../useHunt';
import { apiFetch } from '../../lib/api';

// Mock apiFetch
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

describe('useHunt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryTimeline', () => {
    it('executes a hunt query and returns results', async () => {
      const mockResult = {
        success: true,
        data: [
          {
            id: 'sig-1',
            timestamp: new Date().toISOString(),
            tenantId: 't1',
            sensorId: 's1',
            signalType: 'SQLI',
            sourceIp: '1.1.1.1',
            anonFingerprint: 'f1',
            severity: 'HIGH',
            confidence: 0.9,
            eventCount: 5,
          }
        ],
        meta: {
          total: 1,
          source: 'clickhouse',
          queryTimeMs: 150,
        }
      };

	      vi.mocked(apiFetch).mockResolvedValue(mockResult);

	      const { result } = renderHook(() => useHunt());
	      
	      let huntRes: any;
	      await act(async () => {
	        huntRes = await result.current.queryTimeline({
	          startTime: '2021-01-01T00:00:00Z',
	          endTime: '2021-01-01T01:00:00Z',
	        });
	      });

      expect(apiFetch).toHaveBeenCalledWith('/hunt/query', expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          startTime: '2021-01-01T00:00:00Z'
        })
      }));

	      expect(huntRes).toBeTruthy();
	      expect(huntRes.signals).toHaveLength(1);
	      expect(huntRes.total).toBe(1);
	      expect(result.current.isLoading).toBe(false);
	    });

    it('sets error state when query fails', async () => {
      vi.mocked(apiFetch).mockRejectedValue(new Error('Database timeout'));

      const { result } = renderHook(() => useHunt());
      
      await act(async () => {
        try {
          await result.current.queryTimeline({
            startTime: 'now-1h',
            endTime: 'now',
          });
        } catch (e) {
          // ignore
        }
      });

      expect(result.current.error).toBe('Database timeout');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('getStatus and Zod integrity', () => {
    it('successfully fetches status', async () => {
      const mockStatus = {
        historical: true,
        isFleetAdmin: true,
        routingThreshold: '7d',
        description: 'Historical data available'
      };

      vi.mocked(apiFetch).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useHunt());
      
      let status;
      await act(async () => {
        status = await result.current.getStatus();
      });

      expect(status).toEqual(mockStatus);
      expect(result.current.status).toEqual(mockStatus);
    });

    it('handles malformed status response (Zod failure)', async () => {
      // Missing required 'historical' field
      vi.mocked(apiFetch).mockResolvedValue({
        routingThreshold: '7d',
        description: 'broken'
      });

      const { result } = renderHook(() => useHunt());
      
      await act(async () => {
        try {
          await result.current.getStatus();
        } catch (e) {
          // ignore
        }
      });

      expect(result.current.error).toBe('Invalid status response');
    });
  });

  describe('Dev Auth Bootstrap Retry', () => {
    it('retries request once after bootstrapping on 401', async () => {
      const mockResult = {
        success: true,
        data: [],
        meta: { total: 0, source: 'postgres', queryTimeMs: 10 }
      };

      // 1. First call fails with 401
      // 2. Bootstrap call succeeds
      // 3. Second call (retry) succeeds
      vi.mocked(apiFetch)
        .mockRejectedValueOnce(new Error('401 Unauthorized'))
        .mockResolvedValueOnce({ success: true }) // Bootstrap
        .mockResolvedValueOnce(mockResult); // Retry

      const { result } = renderHook(() => useHunt());
      
      await act(async () => {
        await result.current.queryTimeline({
          startTime: 'now-1h',
          endTime: 'now',
        });
      });

      // Verify sequence
      expect(apiFetch).toHaveBeenCalledTimes(3);
      expect(apiFetch).toHaveBeenNthCalledWith(1, '/hunt/query', expect.any(Object));
      expect(apiFetch).toHaveBeenNthCalledWith(2, '/auth/dev/bootstrap', expect.any(Object));
      expect(apiFetch).toHaveBeenNthCalledWith(3, '/hunt/query', expect.any(Object));
    });

    it('does not retry infinitely if second call also fails with 401', async () => {
      vi.mocked(apiFetch)
        .mockRejectedValueOnce(new Error('401 Unauthorized'))
        .mockResolvedValueOnce({ success: true }) // Bootstrap
        .mockRejectedValueOnce(new Error('401 Unauthorized')); // Second failure

      const { result } = renderHook(() => useHunt());
      
      await act(async () => {
        try {
          await result.current.queryTimeline({
            startTime: 'now-1h',
            endTime: 'now',
          });
        } catch (e) {
          // ignore
        }
      });

      // Should stop after 3 calls total (initial, bootstrap, retry)
      expect(apiFetch).toHaveBeenCalledTimes(3);
    });
  });
});

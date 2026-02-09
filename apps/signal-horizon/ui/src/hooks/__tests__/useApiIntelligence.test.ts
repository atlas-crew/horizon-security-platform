import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApiIntelligence } from '../useApiIntelligence';
import { useDemoMode } from '../../stores/demoModeStore';
import { apiFetch } from '../../lib/api';

// Mock dependencies
vi.mock('../../stores/demoModeStore', () => ({
  useDemoMode: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
}));

const mockStats = {
  totalEndpoints: 100,
  newThisWeek: 5,
  newToday: 1,
  schemaViolations24h: 10,
  schemaViolations7d: 50,
  coveragePercent: 80,
  topViolatingEndpoints: [],
  endpointsByMethod: { GET: 50, POST: 50 },
  discoveryTrend: [],
};

const mockEndpoints = {
  endpoints: [
    {
      id: '1',
      method: 'GET',
      path: '/test',
      service: 'test-service',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      riskLevel: 'low',
      hasSchema: true,
    },
  ],
  total: 1,
};

const mockSignals = { signals: [] };
const mockInventory = { totalEndpoints: 1, totalRequests: 100, services: [] };
const mockSchemaChanges = { changes: [], total: 0, limit: 20, offset: 0 };
const mockDriftTrends = { days: 7, limit: 5, trends: [] };

const setupApiMocks = () => {
  vi.mocked(apiFetch).mockImplementation((url) => {
    if (url.includes('/api-intelligence/stats')) return Promise.resolve(mockStats);
    if (url.includes('/api-intelligence/endpoints')) return Promise.resolve(mockEndpoints);
    if (url.includes('/api-intelligence/signals')) return Promise.resolve(mockSignals);
    if (url.includes('/api-intelligence/inventory')) return Promise.resolve(mockInventory);
    if (url.includes('/api-intelligence/schema-changes')) return Promise.resolve(mockSchemaChanges);
    if (url.includes('/api-intelligence/violations/trends/endpoints')) return Promise.resolve(mockDriftTrends);
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
};

describe('useApiIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns demo data when demo mode is enabled', async () => {
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: true } as any);

    const { result } = renderHook(() => useApiIntelligence());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).not.toBeNull();
    expect(result.current.stats?.totalEndpoints).toBe(487);
    expect(result.current.endpoints.length).toBeGreaterThan(0);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('fetches data from API when demo mode is disabled', async () => {
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: false } as any);
    setupApiMocks();

    const { result } = renderHook(() => useApiIntelligence());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats?.totalEndpoints).toBe(100);
    expect(result.current.endpoints[0].path).toBe('/test');
    expect(apiFetch).toHaveBeenCalledTimes(6);
  });

  it('updates pagination and fetches new data', async () => {
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: false } as any);
    setupApiMocks();

    const { result } = renderHook(() => useApiIntelligence());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.setPagination({ offset: 20, limit: 20 });
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20'),
        expect.any(Object)
      );
    });
  });

  it('triggers a manual refetch', async () => {
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: false } as any);
    setupApiMocks();

    const { result } = renderHook(() => useApiIntelligence());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    vi.clearAllMocks();
    setupApiMocks();
    
    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalled();
    });
  });

  it('handles API errors', async () => {
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: false } as any);
    vi.mocked(apiFetch).mockRejectedValue(new Error('API Failure'));

    const { result } = renderHook(() => useApiIntelligence());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('API Failure');
  });

  it('handles Zod validation failures gracefully', async () => {
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: false } as any);
    // Return malformed stats (missing required fields)
    vi.mocked(apiFetch).mockResolvedValue({ totalEndpoints: 'not-a-number' } as any);

    const { result } = renderHook(() => useApiIntelligence());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('stats response format');
  });

  it('cancels in-flight requests on refetch', async () => {
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: false } as any);
    setupApiMocks();

    const { result } = renderHook(() => useApiIntelligence());
    
    // Trigger multiple refetches rapidly
    await act(async () => {
      result.current.refetch();
      result.current.refetch();
    });

    // apiFetch is called with an AbortSignal
    expect(apiFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      signal: expect.any(AbortSignal)
    }));
  });

  it('polls for data at the specified interval', async () => {
    vi.useFakeTimers();
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: false } as any);
    setupApiMocks();

    renderHook(() => useApiIntelligence({ pollInterval: 1000 }));

    // Initial call
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    
    vi.clearAllMocks();
    setupApiMocks();

    // Advance time
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Verify polling call
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    
    vi.useRealTimers();
  });

  it('correctly computes hasMore based on totalEndpoints', async () => {
    vi.mocked(useDemoMode).mockReturnValue({ isEnabled: false } as any);
    
    // total = 5, limit = 2, offset = 0 -> hasMore: true
    vi.mocked(apiFetch).mockImplementation((url) => {
       if (url.includes('/endpoints')) {
         return Promise.resolve({ 
           endpoints: [
             { id: '1', method: 'GET', path: '/1', service: 's1', firstSeenAt: '2021-01-01', lastSeenAt: '2021-01-01', riskLevel: 'low', hasSchema: true },
             { id: '2', method: 'GET', path: '/2', service: 's2', firstSeenAt: '2021-01-01', lastSeenAt: '2021-01-01', riskLevel: 'low', hasSchema: true }
           ], 
           total: 5 
         });
       }
       if (url.includes('/api-intelligence/stats')) return Promise.resolve(mockStats);
       if (url.includes('/api-intelligence/signals')) return Promise.resolve(mockSignals);
       if (url.includes('/api-intelligence/inventory')) return Promise.resolve(mockInventory);
       if (url.includes('/api-intelligence/schema-changes')) return Promise.resolve(mockSchemaChanges);
       if (url.includes('/api-intelligence/violations/trends/endpoints')) return Promise.resolve(mockDriftTrends);
       return Promise.resolve({});
    });

    const { result } = renderHook(() => useApiIntelligence({ pollInterval: 0 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.hasMore).toBe(true);

    // Update pagination to last page
    await act(async () => {
      result.current.setPagination({ offset: 4, limit: 2 });
    });

    await waitFor(() => {
       // total 5, offset 4, 1 endpoint returned -> hasMore: false
       expect(result.current.hasMore).toBe(false);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockFetch = vi.fn();

describe('useHunt.getRequestTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls /hunt/request/:requestId and returns parsed events', async () => {
    const body = {
      success: true,
      data: [
        {
          kind: 'http_transaction',
          timestamp: '2026-02-06T17:00:00.000Z',
          tenantId: 'tenant-1',
          sensorId: 'sensor-1',
          requestId: 'req_123',
          site: 'example.com',
          method: 'GET',
          path: '/health',
          statusCode: 200,
          latencyMs: 12,
          wafAction: null,
        },
        {
          kind: 'actor_event',
          timestamp: '2026-02-06T17:00:01.000Z',
          sensorId: 'sensor-1',
          actorId: 'actor-1',
          requestId: 'req_123',
          eventType: 'risk_increase',
          riskScore: 42,
          riskDelta: 5,
          ruleId: '941100',
          ruleCategory: 'waf',
          ip: '203.0.113.10',
        },
        {
          kind: 'session_event',
          timestamp: '2026-02-06T17:00:02.000Z',
          sensorId: 'sensor-1',
          sessionId: 'sess-1',
          actorId: 'actor-1',
          requestId: 'req_123',
          eventType: 'actor_bound',
          requestCount: 3,
        },
      ],
      meta: {
        requestId: 'req_123',
        tenantId: 'tenant-1',
        count: 3,
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
    });

    const { useHunt } = await import('./useHunt');
    const { result } = renderHook(() => useHunt());

    let res: Awaited<ReturnType<typeof result.current.getRequestTimeline>> | undefined;
    await act(async () => {
      res = await result.current.getRequestTimeline('req_123', { limit: 25 });
    });

    expect(mockFetch).toHaveBeenCalled();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toContain('/api/v1/hunt/request/req_123?limit=25');
    expect(options?.credentials).toBe('include');
    expect((options?.headers as Record<string, string> | undefined)?.['X-API-Key']).toBeUndefined();

    expect(res?.meta).toMatchObject({ requestId: 'req_123', count: 3 });
    expect(res?.events[0]).toMatchObject({ kind: 'http_transaction', requestId: 'req_123' });
    expect(res?.events[1]).toMatchObject({ kind: 'actor_event', requestId: 'req_123' });
    expect(res?.events[2]).toMatchObject({ kind: 'session_event', requestId: 'req_123' });
  });
});

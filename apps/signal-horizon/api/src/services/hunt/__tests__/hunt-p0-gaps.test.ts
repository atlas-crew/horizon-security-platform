/**
 * Hunt Service P0 Gap Tests
 * Addresses identified gaps in getRecentRequests, getRequestTimeline, and ClickHouse query construction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HuntService, type HuntQuery } from '../index.js';
import type { PrismaClient, Signal, SignalType } from '@prisma/client';
import type { Logger } from 'pino';
import type { ClickHouseService } from '../../../storage/clickhouse/index.js';

// =============================================================================
// Mock Factories
// =============================================================================

const mockPrisma = {
  signal: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
} as unknown as PrismaClient;

const mockLogger = {
  child: vi.fn().mockReturnThis(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

const mockClickHouse = {
  isEnabled: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  queryWithParams: vi.fn(),
  queryOneWithParams: vi.fn(),
  ping: vi.fn(),
} as unknown as ClickHouseService;

function createHuntQuery(overrides: Partial<HuntQuery> = {}): HuntQuery {
  return {
    startTime: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    endTime: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('HuntService P0 Gaps', () => {
  let huntServiceWithClickHouse: HuntService;

  beforeEach(() => {
    vi.clearAllMocks();
    huntServiceWithClickHouse = new HuntService(mockPrisma, mockLogger, mockClickHouse);
    vi.mocked(mockClickHouse.isEnabled).mockReturnValue(true);
  });

  // ===========================================================================
  // P0 Gap: getRecentRequests
  // ===========================================================================

  describe('getRecentRequests', () => {
    it('should return empty list when ClickHouse disabled', async () => {
      vi.mocked(mockClickHouse.isEnabled).mockReturnValue(false);
      const result = await huntServiceWithClickHouse.getRecentRequests('tenant-1');
      expect(result).toEqual([]);
    });

    it('should query http_transactions and map results', async () => {
      const mockRows = [
        {
          request_id: 'req-1',
          last_seen: '2024-06-15T10:00:00Z',
          sensor_id: 'sensor-1',
          path: '/api/v1/login',
          status_code: 200,
          waf_action: 'allow'
        }
      ];
      vi.mocked(mockClickHouse.queryWithParams).mockResolvedValue(mockRows);

      const result = await huntServiceWithClickHouse.getRecentRequests('tenant-1', 10);

      expect(mockClickHouse.queryWithParams).toHaveBeenCalledWith(
        expect.stringContaining('FROM http_transactions'),
        expect.objectContaining({ tenantId: 'tenant-1', limit: 10 })
      );
      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe('req-1');
    });

    it('should validate inputs', async () => {
      await expect(huntServiceWithClickHouse.getRecentRequests('invalid; IP', 10)).rejects.toThrow();
      await expect(huntServiceWithClickHouse.getRecentRequests('tenant-1', 0)).rejects.toThrow();
      await expect(huntServiceWithClickHouse.getRecentRequests('tenant-1', 1000)).rejects.toThrow();
    });
  });

  // ===========================================================================
  // P0 Gap: getRequestTimeline Security Guards
  // ===========================================================================

  describe('getRequestTimeline security guards', () => {
    it('should skip actor/session queries when no HTTP rows found', async () => {
      vi.mocked(mockClickHouse.queryWithParams)
        .mockResolvedValueOnce([]) // http_transactions
        .mockResolvedValueOnce([]) // signal_events
        .mockResolvedValueOnce([]); // sensor_logs
      
      const events = await huntServiceWithClickHouse.getRequestTimeline('tenant-1', 'req-123');
      
      // Should only have called 3 times (http, signal, log), skipping actor and session
      expect(mockClickHouse.queryWithParams).toHaveBeenCalledTimes(3);
      expect(events).toHaveLength(0);
    });

    it('should deduplicate sensorIds for SOC table scoping', async () => {
      vi.mocked(mockClickHouse.queryWithParams)
        .mockResolvedValueOnce([
          { sensor_id: 'sensor-1', request_id: 'req-1', timestamp: '2024-06-15T10:00:00Z' },
          { sensor_id: 'sensor-1', request_id: 'req-1', timestamp: '2024-06-15T10:00:01Z' },
          { sensor_id: 'sensor-2', request_id: 'req-1', timestamp: '2024-06-15T10:00:02Z' },
        ]) // http_transactions returns 3 rows, 2 unique sensors
        .mockResolvedValueOnce([]) // signal_events
        .mockResolvedValueOnce([]) // sensor_logs
        .mockResolvedValueOnce([]) // actor_events
        .mockResolvedValueOnce([]); // session_events

      await huntServiceWithClickHouse.getRequestTimeline('tenant-1', 'req-123');

      // Check actor_events query (4th call)
      const actorCall = vi.mocked(mockClickHouse.queryWithParams).mock.calls[3];
      const params = actorCall[1] as any;
      expect(params.sensorIds).toHaveLength(2);
      expect(params.sensorIds).toContain('sensor-1');
      expect(params.sensorIds).toContain('sensor-2');
    });
  });

  // ===========================================================================
  // P0 Gap: validateRequestId edge cases
  // ===========================================================================

  describe('validateRequestId edge cases', () => {
    it('should reject empty requestId', async () => {
      await expect(huntServiceWithClickHouse.getRequestTimeline('tenant-1', '')).rejects.toThrow(/Invalid requestId/);
    });
  });

  // ===========================================================================
  // P0 Gap: ClickHouse prefix filter construction
  // ===========================================================================

  describe('queryTimeline ClickHouse prefix filters', () => {
    it('should use startsWith for IP prefixes in ClickHouse', async () => {
      vi.mocked(mockClickHouse.queryWithParams).mockResolvedValue([]);
      vi.mocked(mockClickHouse.queryOneWithParams).mockResolvedValue({ count: '0' });

      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);

      const query = createHuntQuery({
        startTime: fortyEightHoursAgo,
        endTime: thirtyHoursAgo,
        sourceIps: ['185.228.'],
      });

      await huntServiceWithClickHouse.queryTimeline(query);

      const [sql, params] = vi.mocked(mockClickHouse.queryWithParams).mock.calls[0] as [string, any];
      expect(sql).toContain('startsWith(IPv4NumToString(source_ip), {sourceIpPrefix:String})');
      expect(params.sourceIpPrefix).toBe('185.228.');
    });

    it('should produce OR clause for mixed exact and prefix IPs in ClickHouse', async () => {
      vi.mocked(mockClickHouse.queryWithParams).mockResolvedValue([]);
      vi.mocked(mockClickHouse.queryOneWithParams).mockResolvedValue({ count: '0' });

      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);

      const query = createHuntQuery({
        startTime: fortyEightHoursAgo,
        endTime: thirtyHoursAgo,
        sourceIps: ['1.1.1.1', '185.228.'],
      });

      await huntServiceWithClickHouse.queryTimeline(query);

      const [sql] = vi.mocked(mockClickHouse.queryWithParams).mock.calls[0] as [string, any];
      expect(sql).toContain('(source_ip IN {sourceIps:Array(IPv4)} OR startsWith(IPv4NumToString(source_ip), {sourceIpPrefix:String}))');
    });
  });
});

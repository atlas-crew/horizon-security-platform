import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { ClickHouseService } from '../storage/clickhouse/index.js';
import { DataRetentionService } from './data-retention.js';

const createLogger = (): Logger => {
  const logger = {
    child: vi.fn(() => logger),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;
  return logger;
};

describe('DataRetentionService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-05T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses parameterized ClickHouse deletes for retention', async () => {
    const prisma = {
      signal: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      blocklistEntry: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      threat: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      auditLog: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    } as unknown as PrismaClient;

    const clickhouse = {
      isEnabled: vi.fn().mockReturnValue(true),
      queryWithParams: vi.fn().mockResolvedValue([]),
    } as unknown as ClickHouseService;

    const service = new DataRetentionService(prisma, createLogger(), {}, undefined, clickhouse);
    const result = await service.runPurge();

    expect(result.clickhouseTables).toBe(5);
    expect(clickhouse.queryWithParams).toHaveBeenCalledTimes(5);

    for (const [sql, params] of vi.mocked(clickhouse.queryWithParams).mock.calls) {
      const query = sql as string;
      const queryParams = params as Record<string, unknown>;

      expect(query).toContain('INTERVAL {days:UInt32} DAY');
      expect(typeof queryParams.days).toBe('number');
      expect(query).not.toContain(String(queryParams.days));
    }
  });
});

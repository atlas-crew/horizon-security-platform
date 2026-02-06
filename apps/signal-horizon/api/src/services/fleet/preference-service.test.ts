import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { PreferenceService } from './preference-service.js';

const createMockPrisma = () => {
  const mockPrisma = {
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    signal: {
      updateMany: vi.fn(),
    },
    blocklistEntry: {
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma)),
  } as unknown as PrismaClient;

  return mockPrisma;
};

const createLogger = (): Logger => ({
  info: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger);

describe('PreferenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scrubs data on downgrade within the preference transaction', async () => {
    const mockPrisma = createMockPrisma();
    vi.mocked(mockPrisma.tenant.update).mockResolvedValue({ id: 'tenant-1' } as never);
    vi.mocked(mockPrisma.signal.updateMany).mockResolvedValue({ count: 3 } as never);
    vi.mocked(mockPrisma.blocklistEntry.updateMany).mockResolvedValue({ count: 2 } as never);

    const service = new PreferenceService(mockPrisma, createLogger());
    service.on('preference-change-requested', () => Promise.resolve());

    const committed = vi.fn();
    const aborted = vi.fn();
    service.on('preference-change-committed', committed);
    service.on('preference-change-aborted', aborted);

    const result = await service.updatePreference('tenant-1', 'RECEIVE_ONLY', 'user-1', {
      currentPreference: 'CONTRIBUTE_ONLY',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    expect(result.withdrawal?.performed).toBe(true);
    expect(result.withdrawal?.signalsScrubbed).toBe(3);
    expect(result.withdrawal?.blocksWithdrawn).toBe(2);
    expect(committed).toHaveBeenCalled();
    expect(aborted).not.toHaveBeenCalled();
  });

  it('aborts the transition when withdrawal fails', async () => {
    const mockPrisma = createMockPrisma();
    vi.mocked(mockPrisma.tenant.update).mockResolvedValue({ id: 'tenant-1' } as never);
    vi.mocked(mockPrisma.signal.updateMany).mockRejectedValue(new Error('fail'));

    const service = new PreferenceService(mockPrisma, createLogger());
    service.on('preference-change-requested', () => Promise.resolve());

    const committed = vi.fn();
    const aborted = vi.fn();
    service.on('preference-change-committed', committed);
    service.on('preference-change-aborted', aborted);

    const result = await service.updatePreference('tenant-1', 'RECEIVE_ONLY', 'user-1', {
      currentPreference: 'CONTRIBUTE_AND_RECEIVE',
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    expect(committed).not.toHaveBeenCalled();
    expect(aborted).toHaveBeenCalled();
  });
});

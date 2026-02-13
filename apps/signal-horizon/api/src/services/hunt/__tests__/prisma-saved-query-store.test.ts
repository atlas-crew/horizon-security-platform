/**
 * PrismaSavedQueryStore Tests
 * Tests CRUD operations and tenant isolation logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaSavedQueryStore } from '../saved-query-store.js';
import { PrismaClient, Prisma } from '@prisma/client';
import type { SavedQuery } from '../index.js';

// =============================================================================
// Mock Factories
// =============================================================================

const mockPrisma = {
  savedHunt: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
} as unknown as PrismaClient;

function createSavedHunt(overrides: any = {}) {
  return {
    id: 'hunt-123',
    tenantId: 'tenant-1',
    name: 'Test Hunt',
    description: 'Test description',
    query: {
      startTime: '2024-06-15T12:00:00.000Z',
      endTime: '2024-06-15T13:00:00.000Z',
      signalTypes: ['IP_THREAT'],
    },
    createdBy: 'user-1',
    createdAt: new Date('2024-06-15T12:00:00.000Z'),
    lastRunAt: null,
    updatedAt: new Date('2024-06-15T12:00:00.000Z'),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('PrismaSavedQueryStore', () => {
  let store: PrismaSavedQueryStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new PrismaSavedQueryStore(mockPrisma);
  });

  describe('get', () => {
    it('should retrieve and map a saved hunt', async () => {
      const mockHunt = createSavedHunt();
      vi.mocked(mockPrisma.savedHunt.findUnique).mockResolvedValue(mockHunt);

      const result = await store.get('hunt-123');

      expect(mockPrisma.savedHunt.findUnique).toHaveBeenCalledWith({
        where: { id: 'hunt-123' },
      });
      expect(result).toMatchObject({
        id: 'hunt-123',
        name: 'Test Hunt',
        query: {
          startTime: new Date('2024-06-15T12:00:00.000Z'),
          endTime: new Date('2024-06-15T13:00:00.000Z'),
        },
      });
    });

    it('should return null if hunt not found', async () => {
      vi.mocked(mockPrisma.savedHunt.findUnique).mockResolvedValue(null);
      const result = await store.get('missing');
      expect(result).toBeNull();
    });

    it('should use database tenantId as source of truth', async () => {
      const mockHunt = createSavedHunt({
        tenantId: 'actual-tenant',
        query: { tenantId: 'wrong-tenant' },
      });
      vi.mocked(mockPrisma.savedHunt.findUnique).mockResolvedValue(mockHunt);

      const result = await store.get('hunt-123');
      expect(result?.query.tenantId).toBe('actual-tenant');
    });

    it('should handle missing dates in JSON gracefully', async () => {
      const mockHunt = createSavedHunt({
        query: {}, // No dates
      });
      vi.mocked(mockPrisma.savedHunt.findUnique).mockResolvedValue(mockHunt);

      const result = await store.get('hunt-123');
      expect(result?.query.startTime).toBeInstanceOf(Date);
      expect(result?.query.endTime).toBeInstanceOf(Date);
    });
  });

  describe('set', () => {
    it('should upsert a saved hunt', async () => {
      const query: SavedQuery = {
        id: 'hunt-123',
        name: 'Updated Hunt',
        query: {
          startTime: new Date('2024-06-15T12:00:00.000Z'),
          endTime: new Date('2024-06-15T13:00:00.000Z'),
          tenantId: 'tenant-1',
        },
        createdBy: 'user-1',
        createdAt: new Date(),
      };

      await store.set(query);

      expect(mockPrisma.savedHunt.upsert).toHaveBeenCalledWith({
        where: { id: 'hunt-123' },
        create: expect.objectContaining({
          id: 'hunt-123',
          tenantId: 'tenant-1',
          name: 'Updated Hunt',
        }),
        update: expect.objectContaining({
          name: 'Updated Hunt',
        }),
      });
    });
  });

  describe('delete', () => {
    it('should return true on successful deletion', async () => {
      vi.mocked(mockPrisma.savedHunt.delete).mockResolvedValue({} as any);
      const result = await store.delete('hunt-123');
      expect(result).toBe(true);
    });

    it('should return false if record not found (P2025)', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'test',
      });
      vi.mocked(mockPrisma.savedHunt.delete).mockRejectedValue(error);

      const result = await store.delete('missing');
      expect(result).toBe(false);
    });

    it('should re-throw other errors', async () => {
      const error = new Error('Connection failed');
      vi.mocked(mockPrisma.savedHunt.delete).mockRejectedValue(error);

      await expect(store.delete('hunt-123')).rejects.toThrow('Connection failed');
    });
  });

  describe('list', () => {
    it('should filter by tenantId and createdBy', async () => {
      vi.mocked(mockPrisma.savedHunt.findMany).mockResolvedValue([createSavedHunt()]);

      await store.list('user-1', 'tenant-1');

      expect(mockPrisma.savedHunt.findMany).toHaveBeenCalledWith({
        where: {
          createdBy: 'user-1',
          tenantId: 'tenant-1',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should allow empty filters', async () => {
      vi.mocked(mockPrisma.savedHunt.findMany).mockResolvedValue([]);
      await store.list();
      expect(mockPrisma.savedHunt.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

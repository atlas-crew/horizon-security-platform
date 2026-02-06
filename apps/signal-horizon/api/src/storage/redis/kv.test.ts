import { describe, expect, it, vi } from 'vitest';

import { createIoredisKv, createNodeRedisKv } from './kv.js';

describe('createIoredisKv', () => {
  it('maps ttlSeconds + ifNotExists to SET EX NX', async () => {
    const client = {
      get: vi.fn(async () => null),
      del: vi.fn(async () => 0),
      set: vi.fn(async () => 'OK' as const),
    };

    const kv = createIoredisKv(client);
    await expect(kv.set('k', 'v', { ttlSeconds: 60, ifNotExists: true })).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 60, 'NX');
  });

  it('returns false when NX prevents set', async () => {
    const client = {
      get: vi.fn(async () => null),
      del: vi.fn(async () => 0),
      set: vi.fn(async () => null),
    };

    const kv = createIoredisKv(client);
    await expect(kv.set('k', 'v', { ttlSeconds: 60, ifNotExists: true })).resolves.toBe(false);
  });
});

describe('createNodeRedisKv', () => {
  it('maps ttlSeconds + ifNotExists to SET {EX, NX}', async () => {
    const client = {
      get: vi.fn(async () => null),
      del: vi.fn(async () => 0),
      set: vi.fn(async () => 'OK' as const),
    };

    const kv = createNodeRedisKv(client);
    await expect(kv.set('k', 'v', { ttlSeconds: 60, ifNotExists: true })).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith('k', 'v', { EX: 60, NX: true });
  });
});


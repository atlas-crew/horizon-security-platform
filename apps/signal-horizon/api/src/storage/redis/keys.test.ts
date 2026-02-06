import { describe, expect, it } from 'vitest';

import { buildRedisKey } from './keys.js';

describe('buildRedisKey', () => {
  it('builds stable, versioned keys', () => {
    expect(
      buildRedisKey({
        namespace: 'synapse',
        version: 1,
        tenantId: 'tenant-abc',
        dataType: 'session',
        id: 'user-123',
      })
    ).toBe('synapse:v1:tenant-abc:session:user-123');
  });

  it('throws on missing namespace', () => {
    expect(() =>
      buildRedisKey({
        namespace: '',
        version: 1,
        tenantId: 'tenant-abc',
        dataType: 'session',
        id: 'user-123',
      })
    ).toThrow(/namespace/i);
  });

  it('throws on non-positive version', () => {
    expect(() =>
      buildRedisKey({
        namespace: 'synapse',
        version: 0,
        tenantId: 'tenant-abc',
        dataType: 'session',
        id: 'user-123',
      })
    ).toThrow(/version/i);
  });
});

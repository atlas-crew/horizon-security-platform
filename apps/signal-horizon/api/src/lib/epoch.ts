/**
 * Epoch-based Token Revocation (labs-wqy1)
 *
 * Provides tenant-scoped epoch management for bulk token invalidation.
 * When a tenant's epoch is incremented, all JWTs issued with a lower epoch
 * are considered expired, enabling "revoke all tokens" functionality.
 *
 * Uses the RedisKv abstraction for storage. Falls back gracefully when
 * Redis is unavailable (consistent with the fail-open pattern in jwt.ts).
 */

import { type RedisKv } from '../storage/redis/kv.js';
import { buildRedisKey } from '../storage/redis/keys.js';

const EPOCH_NAMESPACE = 'horizon';
const EPOCH_VERSION = 1;
const EPOCH_DATA_TYPE = 'auth-epoch';
const EPOCH_ID = 'current';

function epochKey(tenantId: string): string {
  return buildRedisKey({
    namespace: EPOCH_NAMESPACE,
    version: EPOCH_VERSION,
    tenantId,
    dataType: EPOCH_DATA_TYPE,
    id: EPOCH_ID,
  });
}

/**
 * Get the current epoch for a tenant.
 * Returns 0 if not set or if Redis is unavailable (fail-open).
 */
export async function getEpochForTenant(
  tenantId: string,
  kv: RedisKv
): Promise<number> {
  try {
    const raw = await kv.get(epochKey(tenantId));
    if (raw === null) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Fail-open: treat Redis errors as epoch 0 (no tokens rejected).
    // This is consistent with the isTokenRevoked fail-open pattern (jwt.ts line 66-76).
    return 0;
  }
}

/**
 * Increment the epoch for a tenant and return the new value.
 * This effectively invalidates all tokens issued before this epoch.
 */
export async function incrementEpochForTenant(
  tenantId: string,
  kv: RedisKv
): Promise<number> {
  const current = await getEpochForTenant(tenantId, kv);
  const next = current + 1;
  await kv.set(epochKey(tenantId), String(next));
  return next;
}

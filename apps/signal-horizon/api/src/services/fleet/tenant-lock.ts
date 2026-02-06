/**
 * Tenant-scoped locking helpers.
 */

import type { Prisma } from '@prisma/client';
import type { Logger } from 'pino';

export async function lockTenantPreference(
  tx: Prisma.TransactionClient,
  tenantId: string,
  logger?: Logger
): Promise<void> {
  try {
    // Postgres advisory lock scoped to current transaction.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
  } catch (error) {
    logger?.warn({ error, tenantId }, 'Failed to acquire tenant preference lock');
    throw error;
  }
}

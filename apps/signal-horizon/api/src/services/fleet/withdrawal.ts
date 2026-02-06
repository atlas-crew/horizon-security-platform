/**
 * Shared withdrawal helpers for preference downgrades and GDPR erasure.
 */

import type { Prisma } from '@prisma/client';
import type { ClickHouseService } from '../../storage/clickhouse/index.js';
import type { Logger } from 'pino';

export interface ScrubOptions {
  /** Only scrub contributed data (anonFingerprint, blocks), keep internal stats */
  contributionOnly?: boolean;
  /** Start date for scrubbing (for retroactive withdrawal) */
  since?: Date;
  /** ClickHouse service for historical data scrubbing */
  clickhouse?: ClickHouseService | null;
  /** Logger for monitoring progress */
  logger?: Logger;
}

export interface ScrubResult {
  signalsScrubbed: number;
  blocksWithdrawn: number;
  intelDeleted: number;
  snapshotsDeleted: number;
  clickhouseMutations?: number;
}

/**
 * Scrub tenant data from all paths. (labs-iobz)
 * 
 * Used for:
 * 1. Preference Downgrade (contributionOnly: true) - Withdraws shared data.
 * 2. GDPR Erasure (contributionOnly: false) - Deletes all tenant-specific data.
 */
export async function scrubTenantData(
  tx: Prisma.TransactionClient,
  tenantId: string,
  options: ScrubOptions = {}
): Promise<ScrubResult> {
  const { contributionOnly = false, since, clickhouse, logger } = options;
  const where: any = { tenantId };
  if (since) {
    where.createdAt = { gte: since };
  }

  // 1. Scrub Signals (anonFingerprint is the shared/contributed data)
  const signalUpdate = await tx.signal.updateMany({
    where,
    data: { anonFingerprint: null },
  });

  // 2. Withdraw Blocklist Entries
  const blockUpdate = await tx.blocklistEntry.updateMany({
    where,
    data: {
      propagationStatus: 'WITHDRAWN',
      withdrawnAt: new Date(),
    },
  });

  let intelDeleted = 0;
  let snapshotsDeleted = 0;

  // 3. GDPR-only paths (Full erasure)
  if (!contributionOnly) {
    // Delete Sensor Intelligence (Actor/Session/Campaign/Profile snapshots)
    const [actorDel, sessionDel, campaignDel, profileDel] = await Promise.all([
      tx.sensorIntelActor.deleteMany({ where: { tenantId } }),
      tx.sensorIntelSession.deleteMany({ where: { tenantId } }),
      tx.sensorIntelCampaign.deleteMany({ where: { tenantId } }),
      tx.sensorIntelProfile.deleteMany({ where: { tenantId } }),
    ]);
    intelDeleted = actorDel.count + sessionDel.count + campaignDel.count + profileDel.count;

    // Delete Payload Snapshots
    const snapshotDel = await tx.sensorPayloadSnapshot.deleteMany({
      where: { 
        tenantId,
        ...(since && { capturedAt: { gte: since } })
      },
    });
    snapshotsDeleted = snapshotDel.count;
  }

  const result: ScrubResult = {
    signalsScrubbed: signalUpdate.count,
    blocksWithdrawn: blockUpdate.count,
    intelDeleted,
    snapshotsDeleted,
  };

  // 4. ClickHouse historical data scrubbing (Full erasure only)
  if (!contributionOnly && clickhouse?.isEnabled()) {
    result.clickhouseMutations = await purgeClickHouseTenantData(clickhouse, tenantId, since, logger);
  }

  return result;
}

/**
 * Issue ClickHouse mutations to purge tenant data from all tables.
 */
async function purgeClickHouseTenantData(
  clickhouse: ClickHouseService,
  tenantId: string,
  since?: Date,
  logger?: Logger
): Promise<number> {
  const tables = [
    'signal_events',
    'campaign_history',
    'blocklist_history',
    'http_transactions',
    'sensor_logs',
  ];

  let mutations = 0;
  for (const table of tables) {
    const sql = `
      ALTER TABLE ${table}
      DELETE WHERE tenant_id = {tenantId:String}
      ${since ? ' AND timestamp >= {since:DateTime}' : ''}
    `;

    try {
      await clickhouse.queryWithParams(sql, { 
        tenantId,
        ...(since && { since: since.toISOString().replace('T', ' ').split('.')[0] })
      });
      mutations++;
    } catch (error) {
      logger?.error({ error, table, tenantId }, 'Failed to issue ClickHouse deletion mutation');
    }
  }

  return mutations;
}

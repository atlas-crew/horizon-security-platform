/**
 * Data Retention Job
 *
 * Implements storage limitation policy for threat data (GDPR Art 5).
 * Purges expired signals, blocklist entries, and threats from PostgreSQL. (labs-ohgy)
 */

import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { SecurityAuditService } from '../services/audit/security-audit.js';
import type { ClickHouseService } from '../storage/clickhouse/index.js';

const CLICKHOUSE_RETENTION_TABLES = [
  { table: 'signal_events', days: 90 },
  { table: 'campaign_history', days: 180 },
  { table: 'blocklist_history', days: 365 },
  { table: 'http_transactions', days: 30 },
  { table: 'sensor_logs', days: 30 },
] as const;

export interface RetentionConfig {
  /** Retention for signals (default: 30 days) */
  signalsDays?: number;
  /** Retention for blocklist entries (default: 90 days) */
  blocklistDays?: number;
  /** Retention for threats (default: 180 days) */
  threatsDays?: number;
  /** Retention for audit logs (default: 365 days) */
  auditLogsDays?: number;
}

export class DataRetentionService {
  private prisma: PrismaClient;
  private logger: Logger;
  private auditService?: SecurityAuditService;
  private clickhouse?: ClickHouseService | null;
  private config: Required<RetentionConfig>;
  private inProgress = false;

  constructor(
    prisma: PrismaClient, 
    logger: Logger, 
    config: RetentionConfig = {},
    auditService?: SecurityAuditService,
    clickhouse?: ClickHouseService | null
  ) {
    this.prisma = prisma;
    this.logger = logger.child({ service: 'data-retention' });
    this.auditService = auditService;
    this.clickhouse = clickhouse ?? null;
    this.config = {
      signalsDays: config.signalsDays ?? 30,
      blocklistDays: config.blocklistDays ?? 90,
      threatsDays: config.threatsDays ?? 180,
      auditLogsDays: config.auditLogsDays ?? 365,
    };
  }

  /**
   * Run the purge job for all models. (labs-ohgy)
   */
  async runPurge(): Promise<Record<string, number>> {
    if (this.inProgress) {
      this.logger.warn('Data retention purge already running; skipping');
      return { skipped: 1 };
    }

    this.inProgress = true;
    this.logger.info('Starting data retention purge job');
    const results: Record<string, number> = {};

    try {
      // 1. Purge Signals
      const signalsCutoff = new Date(Date.now() - this.config.signalsDays * 86400000);
      const signalsDeleted = await this.prisma.signal.deleteMany({
        where: { createdAt: { lt: signalsCutoff } },
      });
      results.signals = signalsDeleted.count;

      // 2. Purge Blocklist Entries (only those that are expired or old)
      const blocksCutoff = new Date(Date.now() - this.config.blocklistDays * 86400000);
      const blocksDeleted = await this.prisma.blocklistEntry.deleteMany({
        where: { 
          OR: [
            { expiresAt: { lt: new Date() } },
            { createdAt: { lt: blocksCutoff }, propagationStatus: 'WITHDRAWN' }
          ]
        },
      });
      results.blocklist = blocksDeleted.count;

      // 3. Purge Threats
      const threatsCutoff = new Date(Date.now() - this.config.threatsDays * 86400000);
      const threatsDeleted = await this.prisma.threat.deleteMany({
        where: { lastSeenAt: { lt: threatsCutoff } },
      });
      results.threats = threatsDeleted.count;

      // 4. Purge Audit Logs
      const auditCutoff = new Date(Date.now() - this.config.auditLogsDays * 86400000);
      const auditDeleted = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: auditCutoff } },
      });
      results.auditLogs = auditDeleted.count;

      // 5. Purge ClickHouse historical tables (if enabled)
      results.clickhouseTables = await this.purgeClickHouse();

      this.logger.info({ results }, 'Data retention purge job completed');

      // Record in security audit log
      if (this.auditService) {
        await this.auditService.logEvent(
          {
            ipAddress: null,
            userAgent: null,
            userId: 'system',
            tenantId: 'fleet',
            requestId: null,
          },
          {
            action: 'DATA_RETENTION_PURGE',
            result: 'SUCCESS',
            resourceId: 'retention-service',
            details: { ...results, config: this.config },
          }
        );
      }

      return results;
    } catch (error) {
      this.logger.error({ error }, 'Data retention purge job failed');
      throw error;
    } finally {
      this.inProgress = false;
    }
  }

  private async purgeClickHouse(): Promise<number> {
    if (!this.clickhouse?.isEnabled()) {
      return 0;
    }

    let mutations = 0;
    for (const entry of CLICKHOUSE_RETENTION_TABLES) {
      const sql = `
        ALTER TABLE ${entry.table}
        DELETE WHERE timestamp < now() - INTERVAL {days:UInt32} DAY
      `;

      try {
        await this.clickhouse.queryWithParams(sql, { days: entry.days });
        mutations += 1;
      } catch (error) {
        this.logger.error({ error, table: entry.table }, 'ClickHouse retention purge failed');
      }
    }

    return mutations;
  }
}

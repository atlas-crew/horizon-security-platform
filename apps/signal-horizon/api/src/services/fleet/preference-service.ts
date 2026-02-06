/**
 * Preference Service
 *
 * Manages tenant sharing preference transitions with consensus across services.
 * Implements a two-phase commit pattern to ensure all services (Aggregator, 
 * SensorGateway, Broadcaster) are synchronized during preference changes. (labs-9yin)
 */

import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { SharingPreference } from '../../types/protocol.js';
import type { ClickHouseService } from '../../storage/clickhouse/index.js';
import { EventEmitter } from 'node:events';
import { scrubTenantData, type ScrubOptions, type ScrubResult } from './withdrawal.js';
import { lockTenantPreference } from './tenant-lock.js';

export interface PreferenceServiceEvents {
  /** Emitted when a preference change is requested (Phase 1) */
  'preference-change-requested': (tenantId: string, preference: SharingPreference, token: string) => Promise<void>[];
  /** Emitted when a preference change is committed (Phase 3) */
  'preference-change-committed': (tenantId: string, preference: SharingPreference, token: string) => void;
  /** Emitted when a preference change is rolled back */
  'preference-change-aborted': (tenantId: string, token: string) => void;
}

export interface PreferenceUpdateOptions {
  currentPreference?: SharingPreference | null;
}

export interface PreferenceUpdateResult {
  success: boolean;
  withdrawal?: {
    performed: boolean;
    signalsScrubbed: number;
    blocksWithdrawn: number;
  };
}

export class PreferenceService extends EventEmitter {
  private prisma: PrismaClient;
  private logger: Logger;
  private clickhouse: ClickHouseService | null;
  private activeTransitions: Map<string, { tenantId: string, preference: SharingPreference }> = new Map();

  constructor(prisma: PrismaClient, logger: Logger, clickhouse?: ClickHouseService | null) {
    super();
    this.prisma = prisma;
    this.logger = logger.child({ service: 'preference-service' });
    this.clickhouse = clickhouse ?? null;
  }

  /**
   * Orchestrate an atomic preference transition with consensus. (labs-9yin)
   */
  async updatePreference(
    tenantId: string,
    newPreference: SharingPreference,
    userId: string,
    options: PreferenceUpdateOptions = {}
  ): Promise<PreferenceUpdateResult> {
    const transitionToken = `ac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.logger.info({ tenantId, newPreference, transitionToken }, 'Initiating preference transition');
    let withdrawalResult: PreferenceUpdateResult['withdrawal'];

    try {
      // Phase 1: Prepare & Notify
      this.activeTransitions.set(transitionToken, { tenantId, preference: newPreference });
      
      // Collect promises from all listeners who need to acknowledge
      const listeners = this.listeners('preference-change-requested') as Array<(tId: string, pref: SharingPreference, tok: string) => Promise<void>>;
      
      const acknowledgments = listeners.map(listener => {
        try {
          return listener(tenantId, newPreference, transitionToken);
        } catch (error) {
          this.logger.error({ error, tenantId, transitionToken }, 'Listener failed to initiate acknowledgment');
          throw error;
        }
      });

      // Wait for all services to acknowledge they've seen the change
      await Promise.all(acknowledgments);
      this.logger.info({ tenantId, transitionToken }, 'Consensus reached for preference change');

      // Phase 2: Persist to Database
      await this.prisma.$transaction(async (tx) => {
        await lockTenantPreference(tx, tenantId, this.logger);

        let previousPreference = options.currentPreference;
        if (!previousPreference) {
          const existing = await tx.tenant.findUnique({
            where: { id: tenantId },
            select: { sharingPreference: true },
          });
          if (!existing) {
            throw new Error('Tenant not found');
          }
          previousPreference = existing.sharingPreference;
        }

        await tx.tenant.update({
          where: { id: tenantId },
          data: {
            sharingPreference: newPreference,
            preferenceChangedBy: userId,
            preferenceChangedAt: new Date(),
          },
        });

        const wasContributing = isContributingPreference(previousPreference);
        const isContributing = isContributingPreference(newPreference);

        if (wasContributing && !isContributing) {
          const { signalsScrubbed, blocksWithdrawn } = await scrubTenantData(tx, tenantId, {
            contributionOnly: true,
            logger: this.logger
          });
          withdrawalResult = {
            performed: true,
            signalsScrubbed,
            blocksWithdrawn,
          };
        }
      });

      // Phase 3: Commit
      this.emit('preference-change-committed', tenantId, newPreference, transitionToken);
      this.activeTransitions.delete(transitionToken);
      
      this.logger.info({ tenantId, newPreference }, 'Preference transition committed successfully');
      return { success: true, withdrawal: withdrawalResult };

    } catch (error) {
      this.logger.error({ error, tenantId, transitionToken }, 'Preference transition failed - aborting');
      
      // Phase 4: Abort/Rollback
      this.emit('preference-change-aborted', tenantId, transitionToken);
      this.activeTransitions.delete(transitionToken);
      
      return { success: false };
    }
  }

  /**
   * Comprehensive tenant data scrubbing (GDPR erasure or contribution withdrawal). (labs-4ltv)
   */
  async scrubTenantData(tenantId: string, options: ScrubOptions = {}): Promise<ScrubResult> {
    return this.prisma.$transaction(async (tx) => {
      return scrubTenantData(tx, tenantId, {
        ...options,
        clickhouse: options.clickhouse ?? this.clickhouse,
        logger: options.logger ?? this.logger,
      });
    });
  }

  /**
   * Type-safe event registration
   */
  on<K extends keyof PreferenceServiceEvents>(
    event: K,
    listener: PreferenceServiceEvents[K]
  ): this {
    return super.on(event, listener);
  }
}

const isContributingPreference = (preference?: SharingPreference | null): boolean =>
  preference === 'CONTRIBUTE_AND_RECEIVE' || preference === 'CONTRIBUTE_ONLY';

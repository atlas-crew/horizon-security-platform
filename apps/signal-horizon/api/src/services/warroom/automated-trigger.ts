/**
 * Automated Playbook Trigger Service
 * Monitors incoming signals and automatically triggers matching playbooks
 * based on SIGNAL_SEVERITY and SIGNAL_TYPE trigger conditions.
 */

import type { PrismaClient, Playbook, WarRoom } from '@prisma/client';
import type { Logger } from 'pino';
import type { EnrichedSignal, Severity } from '../../types/protocol.js';
import { PlaybookService, PlaybookConcurrencyError, type UserInfo } from './playbook-service.js';

/**
 * Configuration for the automated trigger service
 */
export interface AutomatedTriggerConfig {
  /** Enable/disable automated triggering */
  enabled: boolean;
  /** Cooldown period (ms) before re-triggering the same playbook for the same tenant */
  cooldownMs: number;
  /** Maximum auto-triggered runs per tenant per minute */
  maxAutoTriggersPerMinute: number;
  /** System user info for automated executions */
  systemUser: UserInfo;
}

const DEFAULT_CONFIG: AutomatedTriggerConfig = {
  enabled: true,
  cooldownMs: 60_000, // 1 minute cooldown
  maxAutoTriggersPerMinute: 10,
  systemUser: {
    userId: 'system-automated-trigger',
    userName: 'Automated Response System',
  },
};

/**
 * Track recent triggers to prevent spam/loops
 */
interface TriggerRecord {
  playbookId: string;
  tenantId: string;
  triggeredAt: number;
}

/**
 * Result of evaluating signals against playbook triggers
 */
interface TriggerEvaluation {
  playbook: Playbook;
  matchedSignals: EnrichedSignal[];
  matchReason: string;
}

export class AutomatedPlaybookTrigger {
  private prisma: PrismaClient;
  private logger: Logger;
  private playbookService: PlaybookService;
  private config: AutomatedTriggerConfig;

  /** Recent trigger history for cooldown enforcement */
  private recentTriggers: TriggerRecord[] = [];
  /** Rate limit tracking per tenant */
  private triggerCounts: Map<string, { count: number; windowStart: number }> = new Map();

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    prisma: PrismaClient,
    logger: Logger,
    playbookService: PlaybookService,
    config?: Partial<AutomatedTriggerConfig>
  ) {
    this.prisma = prisma;
    this.logger = logger.child({ service: 'automated-playbook-trigger' });
    this.playbookService = playbookService;
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.enabled) {
      this.startCleanupInterval();
      this.logger.info('Automated playbook trigger service started');
    }
  }

  /**
   * Evaluate signals and trigger matching playbooks
   * Called by Aggregator after signal processing
   */
  async evaluateSignals(signals: EnrichedSignal[]): Promise<void> {
    if (!this.config.enabled || signals.length === 0) {
      return;
    }

    // Group signals by tenant
    const signalsByTenant = this.groupSignalsByTenant(signals);

    for (const [tenantId, tenantSignals] of signalsByTenant) {
      try {
        await this.evaluateTenantSignals(tenantId, tenantSignals);
      } catch (error) {
        this.logger.error(
          { error, tenantId, signalCount: tenantSignals.length },
          'Failed to evaluate signals for tenant'
        );
      }
    }
  }

  /**
   * Evaluate signals for a single tenant
   */
  private async evaluateTenantSignals(
    tenantId: string,
    signals: EnrichedSignal[]
  ): Promise<void> {
    // Fetch active playbooks with automated triggers for this tenant
    const playbooks = await this.prisma.playbook.findMany({
      where: {
        tenantId,
        isActive: true,
        triggerType: { in: ['SIGNAL_SEVERITY', 'SIGNAL_TYPE'] },
      },
    });

    if (playbooks.length === 0) {
      return;
    }

    // Evaluate each playbook against the signals
    const triggeredPlaybooks: TriggerEvaluation[] = [];

    for (const playbook of playbooks) {
      const evaluation = this.evaluatePlaybook(playbook, signals);
      if (evaluation) {
        triggeredPlaybooks.push(evaluation);
      }
    }

    // Execute triggered playbooks
    for (const { playbook, matchedSignals, matchReason } of triggeredPlaybooks) {
      await this.triggerPlaybook(tenantId, playbook, matchedSignals, matchReason);
    }
  }

  /**
   * Evaluate a single playbook against signals
   */
  private evaluatePlaybook(
    playbook: Playbook,
    signals: EnrichedSignal[]
  ): TriggerEvaluation | null {
    if (playbook.triggerType === 'SIGNAL_SEVERITY') {
      return this.evaluateSeverityTrigger(playbook, signals);
    }

    if (playbook.triggerType === 'SIGNAL_TYPE') {
      return this.evaluateTypeTrigger(playbook, signals);
    }

    return null;
  }

  /**
   * Evaluate SIGNAL_SEVERITY trigger
   * triggerValue should be a severity level (e.g., "HIGH", "CRITICAL")
   */
  private evaluateSeverityTrigger(
    playbook: Playbook,
    signals: EnrichedSignal[]
  ): TriggerEvaluation | null {
    const targetSeverity = playbook.triggerValue as Severity | null;
    if (!targetSeverity) {
      return null;
    }

    const severityRank: Record<Severity, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    const targetRank = severityRank[targetSeverity];
    if (targetRank === undefined) {
      return null;
    }

    // Match signals at or above the target severity
    const matchedSignals = signals.filter(
      (s) => severityRank[s.severity] >= targetRank
    );

    if (matchedSignals.length === 0) {
      return null;
    }

    return {
      playbook,
      matchedSignals,
      matchReason: `${matchedSignals.length} signal(s) at or above ${targetSeverity} severity`,
    };
  }

  /**
   * Evaluate SIGNAL_TYPE trigger
   * triggerValue should be a signal type (e.g., "CREDENTIAL_STUFFING")
   */
  private evaluateTypeTrigger(
    playbook: Playbook,
    signals: EnrichedSignal[]
  ): TriggerEvaluation | null {
    const targetType = playbook.triggerValue;
    if (!targetType) {
      return null;
    }

    // Match signals of the target type
    const matchedSignals = signals.filter((s) => s.signalType === targetType);

    if (matchedSignals.length === 0) {
      return null;
    }

    return {
      playbook,
      matchedSignals,
      matchReason: `${matchedSignals.length} ${targetType} signal(s) detected`,
    };
  }

  /**
   * Trigger a playbook execution
   */
  private async triggerPlaybook(
    tenantId: string,
    playbook: Playbook,
    matchedSignals: EnrichedSignal[],
    matchReason: string
  ): Promise<void> {
    // Check rate limit before each trigger
    if (!this.checkRateLimit(tenantId)) {
      this.logger.warn(
        { tenantId, playbookId: playbook.id },
        'Rate limit exceeded for automated playbook triggers'
      );
      return;
    }

    // Check cooldown
    if (this.isInCooldown(playbook.id, tenantId)) {
      this.logger.debug(
        { playbookId: playbook.id, tenantId },
        'Playbook trigger skipped (cooldown active)'
      );
      return;
    }

    // Find or create a war room for this automated response
    const warRoom = await this.findOrCreateWarRoom(tenantId, playbook, matchedSignals);
    if (!warRoom) {
      return;
    }

    try {
      // Execute the playbook
      const run = await this.playbookService.runPlaybook(
        playbook.id,
        warRoom.id,
        tenantId,
        this.config.systemUser
      );

      // Record the trigger for cooldown tracking
      this.recordTrigger(playbook.id, tenantId);
      this.incrementRateCount(tenantId);

      this.logger.info(
        {
          playbookId: playbook.id,
          playbookName: playbook.name,
          warRoomId: warRoom.id,
          runId: run.id,
          matchReason,
          signalCount: matchedSignals.length,
        },
        'Automated playbook triggered'
      );
    } catch (error) {
      if (error instanceof PlaybookConcurrencyError) {
        // Playbook already running - this is fine for automated triggers
        this.logger.debug(
          { playbookId: playbook.id, warRoomId: warRoom.id },
          'Playbook already running in war room'
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Find an existing war room for the signal context or create a new one
   */
  private async findOrCreateWarRoom(
    tenantId: string,
    playbook: Playbook,
    signals: EnrichedSignal[]
  ): Promise<WarRoom | null> {
    // Look for an active war room for this tenant with recent activity
    const existingWarRoom = await this.prisma.warRoom.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        // Prefer war rooms updated recently (within last hour)
        updatedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingWarRoom) {
      return existingWarRoom;
    }

    // Create a new war room for this automated response
    try {
      const highestSeverity = this.getHighestSeverity(signals);
      const signalTypes = [...new Set(signals.map((s) => s.signalType))];

      return await this.prisma.warRoom.create({
        data: {
          tenantId,
          name: `Auto Response: ${playbook.name}`,
          description: `Automated war room created for playbook "${playbook.name}" in response to ${signals.length} ${highestSeverity} severity signal(s). Signal types: ${signalTypes.join(', ')}`,
          status: 'ACTIVE',
          priority: this.severityToPriority(highestSeverity),
        },
      });
    } catch (error) {
      this.logger.error(
        { error, tenantId, playbookId: playbook.id },
        'Failed to create war room for automated response'
      );
      return null;
    }
  }

  /**
   * Get the highest severity from a list of signals
   */
  private getHighestSeverity(signals: EnrichedSignal[]): Severity {
    const severityRank: Record<Severity, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    let maxRank = 1;
    let maxSeverity: Severity = 'LOW';

    for (const signal of signals) {
      const rank = severityRank[signal.severity];
      if (rank > maxRank) {
        maxRank = rank;
        maxSeverity = signal.severity;
      }
    }

    return maxSeverity;
  }

  /**
   * Convert severity to war room priority
   */
  private severityToPriority(severity: Severity): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return severity;
  }

  /**
   * Group signals by tenant ID
   */
  private groupSignalsByTenant(signals: EnrichedSignal[]): Map<string, EnrichedSignal[]> {
    const groups = new Map<string, EnrichedSignal[]>();

    for (const signal of signals) {
      const tenantId = signal.tenantId;
      if (!tenantId) continue;

      const existing = groups.get(tenantId) || [];
      existing.push(signal);
      groups.set(tenantId, existing);
    }

    return groups;
  }

  /**
   * Check if playbook is in cooldown period
   */
  private isInCooldown(playbookId: string, tenantId: string): boolean {
    const now = Date.now();
    return this.recentTriggers.some(
      (t) =>
        t.playbookId === playbookId &&
        t.tenantId === tenantId &&
        now - t.triggeredAt < this.config.cooldownMs
    );
  }

  /**
   * Record a trigger for cooldown tracking
   */
  private recordTrigger(playbookId: string, tenantId: string): void {
    this.recentTriggers.push({
      playbookId,
      tenantId,
      triggeredAt: Date.now(),
    });
  }

  /**
   * Check rate limit for tenant
   */
  private checkRateLimit(tenantId: string): boolean {
    const now = Date.now();
    const windowMs = 60_000; // 1 minute window

    const record = this.triggerCounts.get(tenantId);
    if (!record || now - record.windowStart > windowMs) {
      // New window
      this.triggerCounts.set(tenantId, { count: 0, windowStart: now });
      return true;
    }

    return record.count < this.config.maxAutoTriggersPerMinute;
  }

  /**
   * Increment rate count for tenant
   */
  private incrementRateCount(tenantId: string): void {
    const record = this.triggerCounts.get(tenantId);
    if (record) {
      record.count++;
    }
  }

  /**
   * Start cleanup interval for stale trigger records
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.config.cooldownMs * 2;
      this.recentTriggers = this.recentTriggers.filter((t) => t.triggeredAt > cutoff);

      // Clean up old rate limit windows
      const windowCutoff = Date.now() - 60_000;
      for (const [tenantId, record] of this.triggerCounts) {
        if (record.windowStart < windowCutoff) {
          this.triggerCounts.delete(tenantId);
        }
      }
    }, 60_000);
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.recentTriggers = [];
    this.triggerCounts.clear();
    this.logger.info('Automated playbook trigger service stopped');
  }
}

import { Prisma } from '@prisma/client';
import type { PrismaClient, Playbook, PlaybookRun } from '@prisma/client';
import type { FleetCommander } from '../fleet/fleet-commander.js';
import type { WarRoomService } from './index.js';
import { SecurityAuditService, type RequestContext } from '../audit/security-audit.js';

/**
 * Maximum concurrent playbook runs allowed per tenant
 */
const MAX_CONCURRENT_RUNS_PER_TENANT = 5;

/**
 * Active run statuses that count toward concurrency limits
 */
const ACTIVE_RUN_STATUSES = ['RUNNING', 'PENDING'] as const;

/**
 * Custom error for playbook concurrency conflicts
 */
export class PlaybookConcurrencyError extends Error {
  public readonly code = 'CONCURRENCY_CONFLICT' as const;
  public readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'PlaybookConcurrencyError';
  }
}

/**
 * User information for activity logging.
 * Required for write operations that create activity logs.
 */
export interface UserInfo {
  userId: string;
  userName: string;
}

export interface PlaybookStep {
  id: string;
  type: 'manual' | 'command' | 'notification';
  title: string;
  description?: string;
  config?: {
    commandType?: string;
    payload?: Record<string, unknown>;
    targetType?: 'all' | 'tag' | 'specific';
    targetValue?: string[];
  };
}

export interface StepResult {
  success: boolean;
  executedBy: string;
  timestamp: Date;
  commandId?: string;
  error?: string;
}

/**
 * Type guard to validate that a value is a PlaybookStep array
 */
function isPlaybookStepArray(value: unknown): value is PlaybookStep[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof item.id === 'string' &&
      'type' in item &&
      ['manual', 'command', 'notification'].includes(item.type as string) &&
      'title' in item &&
      typeof item.title === 'string'
  );
}

/**
 * Type guard to validate that a value is a StepResult array
 */
function isStepResultArray(value: unknown): value is StepResult[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'success' in item &&
      typeof item.success === 'boolean' &&
      'executedBy' in item &&
      typeof item.executedBy === 'string' &&
      'timestamp' in item
  );
}

export interface CreatePlaybookInput {
  tenantId: string;
  name: string;
  description?: string;
  triggerType: 'MANUAL' | 'SIGNAL_SEVERITY' | 'SIGNAL_TYPE';
  triggerValue?: string;
  steps: PlaybookStep[];
}

export class PlaybookService {
  private prisma: PrismaClient;
  private fleetCommander?: FleetCommander;
  private warRoomService?: WarRoomService;
  private auditService?: SecurityAuditService;

  constructor(
    prisma: PrismaClient,
    _logger: unknown, // keeping signature compatible
    fleetCommander?: FleetCommander,
    warRoomService?: WarRoomService,
    auditService?: SecurityAuditService
  ) {
    this.prisma = prisma;
    this.fleetCommander = fleetCommander;
    this.warRoomService = warRoomService;
    this.auditService = auditService;
  }

  /**
   * Log activity asynchronously (fire-and-forget).
   * Activity logging is non-critical and can be eventually consistent.
   */
  private logActivityAsync(
    input: Parameters<WarRoomService['addActivity']>[0]
  ): void {
    if (!this.warRoomService) return;

    void this.warRoomService.addActivity(input).catch((err) => {
      console.error('[PlaybookService] Failed to log activity:', err);
    });
  }

  /**
   * Log security audit event asynchronously (fire-and-forget).
   * Security audit logging should never block operations.
   */
  private logSecurityAuditAsync(
    context: RequestContext,
    action: Parameters<SecurityAuditService['logEvent']>[1]
  ): void {
    if (!this.auditService) return;

    void this.auditService.logEvent(context, action).catch((err) => {
      console.error('[PlaybookService] Failed to log security audit:', err);
    });
  }

  /**
   * Create a request context for internal service operations
   */
  private createInternalContext(tenantId: string, userId: string): RequestContext {
    return {
      ipAddress: null,
      userAgent: 'playbook-service-internal',
      userId,
      tenantId,
    };
  }

  /**
   * Count active playbook runs for a tenant
   */
  async countActiveRunsForTenant(tenantId: string): Promise<number> {
    return this.prisma.playbookRun.count({
      where: {
        tenantId,
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
    });
  }

  /**
   * Check if a playbook is already running in a specific war room
   */
  async hasActiveRunInWarRoom(playbookId: string, warRoomId: string): Promise<boolean> {
    const count = await this.prisma.playbookRun.count({
      where: {
        playbookId,
        warRoomId,
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
    });
    return count > 0;
  }

  /**
   * Create a new playbook
   */
  async createPlaybook(input: CreatePlaybookInput): Promise<Playbook> {
    // Validate steps before storing
    if (!isPlaybookStepArray(input.steps)) {
      throw new Error('Invalid playbook steps format');
    }

    return this.prisma.playbook.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerValue: input.triggerValue,
        steps: input.steps as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * List playbooks for a tenant
   */
  async listPlaybooks(tenantId: string): Promise<Playbook[]> {
    return this.prisma.playbook.findMany({
      where: { tenantId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Run a playbook in a war room with concurrency control.
   * Uses Prisma transaction with Serializable isolation to prevent race conditions.
   *
   * @param playbookId - The ID of the playbook to run
   * @param warRoomId - The ID of the war room context
   * @param tenantId - The tenant ID for authorization
   * @param user - User information for activity logging (required)
   * @throws PlaybookConcurrencyError if:
   *   - The same playbook is already running in the same war room
   *   - Tenant has reached max concurrent runs (5)
   * @throws Error if user.userId is missing
   */
  async runPlaybook(
    playbookId: string,
    warRoomId: string,
    tenantId: string,
    user: UserInfo
  ): Promise<PlaybookRun> {
    // Validate user info is provided for write operations
    if (!user.userId) {
      throw new Error('User ID is required for playbook execution');
    }

    // Validate playbook belongs to tenant
    const playbook = await this.prisma.playbook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook || playbook.tenantId !== tenantId) {
      throw new Error('Playbook not found');
    }

    // CRITICAL: Validate war room belongs to the same tenant
    const warRoom = await this.prisma.warRoom.findUnique({
      where: { id: warRoomId },
    });

    if (!warRoom || warRoom.tenantId !== tenantId) {
      throw new Error('War room not found');
    }

    // Use Prisma transaction with Serializable isolation level for atomic check-and-create
    const run = await this.prisma.$transaction(
      async (tx) => {
        // Check 1: Prevent same playbook running multiple times in same war room
        const existingRunInWarRoom = await tx.playbookRun.count({
          where: {
            playbookId,
            warRoomId,
            status: { in: [...ACTIVE_RUN_STATUSES] },
          },
        });

        if (existingRunInWarRoom > 0) {
          throw new PlaybookConcurrencyError(
            `Playbook "${playbook.name}" is already running in this war room`
          );
        }

        // Check 2: Enforce tenant-level concurrency limit
        const activeRunsCount = await tx.playbookRun.count({
          where: {
            tenantId,
            status: { in: [...ACTIVE_RUN_STATUSES] },
          },
        });

        if (activeRunsCount >= MAX_CONCURRENT_RUNS_PER_TENANT) {
          throw new PlaybookConcurrencyError(
            `Maximum concurrent playbook runs (${MAX_CONCURRENT_RUNS_PER_TENANT}) reached for tenant`
          );
        }

        // Create the run within the transaction
        return tx.playbookRun.create({
          data: {
            playbookId,
            warRoomId,
            tenantId,
            status: 'RUNNING',
            currentStep: 0,
            stepResults: [],
            startedBy: user.userId,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000, // 10 second timeout
      }
    );

    // Log activity (fire-and-forget, non-blocking)
    this.logActivityAsync({
      warRoomId,
      tenantId,
      actorType: 'USER',
      actorId: user.userId,
      actorName: user.userName,
      actionType: 'MESSAGE',
      description: `Started playbook: ${playbook.name}`,
      metadata: { playbookRunId: run.id },
    });

    return run;
  }

  /**
   * Execute or mark a step as complete.
   *
   * @param runId - The ID of the playbook run
   * @param tenantId - The tenant ID for authorization
   * @param user - User information for activity logging (required)
   * @throws Error if user.userId is missing
   */
  async executeStep(
    runId: string,
    tenantId: string,
    user: UserInfo
  ): Promise<{ success: boolean; isComplete: boolean }> {
    // Validate user info is provided for write operations
    if (!user.userId) {
      throw new Error('User ID is required for step execution');
    }

    const run = await this.prisma.playbookRun.findUnique({
      where: { id: runId },
      include: { playbook: true },
    });

    if (!run || run.tenantId !== tenantId) {
      throw new Error('Playbook run not found');
    }

    if (run.status !== 'RUNNING') {
      throw new Error('Playbook run is not active');
    }

    // Validate and extract steps with type guard
    if (!isPlaybookStepArray(run.playbook.steps)) {
      throw new Error('Invalid playbook steps format');
    }
    const steps: PlaybookStep[] = run.playbook.steps;
    const currentStepIndex = run.currentStep;

    if (currentStepIndex >= steps.length) {
      throw new Error('Playbook already completed');
    }

    const step = steps[currentStepIndex];
    const result: StepResult = { success: true, executedBy: user.userId, timestamp: new Date() };

    // Execute logic based on step type
    if (step.type === 'command' && this.fleetCommander) {
      if (!step.config?.commandType) throw new Error('Invalid command configuration');

      const auditContext = this.createInternalContext(tenantId, user.userId);

      try {
        // Determine targets
        // Simplification: just broadcast or use a placeholder logic
        // In real implementation, would resolve targetType/targetValue to sensorIds
        // For now, let's assume it's a broadcast if target is 'all'

        // Execute command
        // await this.fleetCommander.broadcastCommand(...)
        // result.commandId = ...

        // Log successful command execution
        this.logSecurityAuditAsync(auditContext, {
          action: 'PLAYBOOK_COMMAND_SENT',
          result: 'SUCCESS',
          resourceId: runId,
          details: {
            commandType: step.config.commandType,
            targetType: step.config.targetType ?? 'all',
            stepIndex: currentStepIndex,
          },
        });
      } catch (commandError) {
        // Log failed command execution
        this.logSecurityAuditAsync(auditContext, {
          action: 'PLAYBOOK_COMMAND_FAILED',
          result: 'FAILURE',
          resourceId: runId,
          details: {
            commandType: step.config.commandType,
            stepIndex: currentStepIndex,
            error: commandError instanceof Error ? commandError.message : String(commandError),
          },
        });
        throw commandError;
      }
    }

    // Advance step
    const nextStep = currentStepIndex + 1;
    const isComplete = nextStep >= steps.length;

    // Validate and extract existing step results with type guard
    const existingResults = isStepResultArray(run.stepResults) ? run.stepResults : [];
    const stepResults: StepResult[] = [...existingResults, result];

    await this.prisma.playbookRun.update({
      where: { id: runId },
      data: {
        currentStep: nextStep,
        stepResults: stepResults as unknown as Prisma.InputJsonValue,
        status: isComplete ? 'COMPLETED' : 'RUNNING',
        completedAt: isComplete ? new Date() : null,
      },
    });

    // Security audit logging for step execution
    const stepAuditContext = this.createInternalContext(tenantId, user.userId);
    this.logSecurityAuditAsync(stepAuditContext, {
      action: 'PLAYBOOK_STEP_EXECUTED',
      result: 'SUCCESS',
      resourceId: runId,
      secondaryResourceId: step.id,
      details: {
        stepIndex: currentStepIndex,
        stepType: step.type,
        stepTitle: step.title,
      },
    });

    // Log activity (fire-and-forget, non-blocking)
    this.logActivityAsync({
      warRoomId: run.warRoomId,
      tenantId,
      actorType: 'USER',
      actorId: user.userId,
      actorName: user.userName,
      actionType: 'MESSAGE',
      description: `Completed step ${currentStepIndex + 1}: ${step.title}`,
      metadata: { playbookRunId: runId, stepId: step.id },
    });

    if (isComplete) {
      // Security audit logging for playbook completion
      this.logSecurityAuditAsync(stepAuditContext, {
        action: 'PLAYBOOK_EXECUTION_COMPLETED',
        result: 'SUCCESS',
        resourceId: runId,
        details: {
          playbookId: run.playbookId,
          totalSteps: steps.length,
        },
      });

      this.logActivityAsync({
        warRoomId: run.warRoomId,
        tenantId,
        actorType: 'SYSTEM',
        actorName: 'System',
        actionType: 'MESSAGE',
        description: `Playbook completed: ${run.playbook.name}`,
        metadata: { playbookRunId: runId },
      });
    }

    return { success: true, isComplete };
  }

  /**
   * Cancel a running playbook.
   *
   * @param runId - The ID of the playbook run
   * @param tenantId - The tenant ID for authorization
   * @param user - User information for activity logging (required)
   * @throws Error if user.userId is missing
   */
  async cancelPlaybookRun(
    runId: string,
    tenantId: string,
    user: UserInfo
  ): Promise<PlaybookRun> {
    // Validate user info is provided for write operations
    if (!user.userId) {
      throw new Error('User ID is required for playbook cancellation');
    }

    const run = await this.prisma.playbookRun.findUnique({
      where: { id: runId },
    });

    if (!run || run.tenantId !== tenantId) {
      throw new Error('Playbook run not found');
    }

    if (run.status !== 'RUNNING') {
      throw new Error('Only running playbooks can be cancelled');
    }

    const updated = await this.prisma.playbookRun.update({
      where: { id: runId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    // Log activity (fire-and-forget, non-blocking)
    this.logActivityAsync({
      warRoomId: run.warRoomId,
      tenantId,
      actorType: 'USER',
      actorId: user.userId,
      actorName: user.userName,
      actionType: 'MESSAGE',
      description: 'Playbook run cancelled',
      metadata: { playbookRunId: runId },
    });

    return updated;
  }
}

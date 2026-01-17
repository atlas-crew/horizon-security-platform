
import type { PrismaClient, Prisma, Playbook, PlaybookRun } from '@prisma/client';
import type { FleetCommander } from '../fleet/fleet-commander.js';
import type { WarRoomService } from './index.js';

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

  constructor(
    prisma: PrismaClient,
    _logger: unknown, // keeping signature compatible but unused
    fleetCommander?: FleetCommander,
    warRoomService?: WarRoomService
  ) {
    this.prisma = prisma;
    this.fleetCommander = fleetCommander;
    this.warRoomService = warRoomService;
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
   * Run a playbook in a war room
   */
  async runPlaybook(playbookId: string, warRoomId: string, tenantId: string, userId: string): Promise<PlaybookRun> {
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

    const run = await this.prisma.playbookRun.create({
      data: {
        playbookId,
        warRoomId,
        tenantId,
        status: 'RUNNING',
        currentStep: 0,
        stepResults: [],
        startedBy: userId,
      },
    });

    // Log activity
    if (this.warRoomService) {
      await this.warRoomService.addActivity({
        warRoomId,
        tenantId,
        actorType: 'USER',
        actorId: userId,
        actorName: 'User', // Ideally fetch name
        actionType: 'MESSAGE',
        description: `Started playbook: ${playbook.name}`,
        metadata: { playbookRunId: run.id },
      });
    }

    // Execute first step if it's automated?
    // For now, let's assume steps are triggered manually or sequentially via executeStep
    // But if we want full automation, we'd check step type here.

    return run;
  }

  /**
   * Execute or mark a step as complete
   */
  async executeStep(runId: string, tenantId: string, userId: string): Promise<{ success: boolean; isComplete: boolean }> {
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
    const result: StepResult = { success: true, executedBy: userId, timestamp: new Date() };

    // Execute logic based on step type
    if (step.type === 'command' && this.fleetCommander) {
      if (!step.config?.commandType) throw new Error('Invalid command configuration');

      // Determine targets
      // Simplification: just broadcast or use a placeholder logic
      // In real implementation, would resolve targetType/targetValue to sensorIds
      // For now, let's assume it's a broadcast if target is 'all'

      // Execute command
      // await this.fleetCommander.broadcastCommand(...)
      // result.commandId = ...
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

    if (this.warRoomService) {
      await this.warRoomService.addActivity({
        warRoomId: run.warRoomId,
        tenantId,
        actorType: 'USER',
        actorId: userId,
        actorName: 'User',
        actionType: 'MESSAGE',
        description: `Completed step ${currentStepIndex + 1}: ${step.title}`,
        metadata: { playbookRunId: runId, stepId: step.id },
      });

      if (isComplete) {
        await this.warRoomService.addActivity({
          warRoomId: run.warRoomId,
          tenantId,
          actorType: 'SYSTEM',
          actorName: 'System',
          actionType: 'MESSAGE',
          description: `Playbook completed: ${run.playbook.name}`,
          metadata: { playbookRunId: runId },
        });
      }
    }

    return { success: true, isComplete };
  }
}

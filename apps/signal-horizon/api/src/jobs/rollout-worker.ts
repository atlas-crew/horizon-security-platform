/**
 * Rollout Worker
 *
 * BullMQ worker that processes firmware rollout jobs in the background.
 * Survives server restarts and handles retries automatically.
 */

import type { Job, Worker } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { createWorker, closeWorker, QUEUE_NAMES, type RolloutJobData } from './queue.js';
import { RolloutOrchestrator } from '../services/fleet/rollout-orchestrator.js';
import type { FleetCommander } from '../services/fleet/fleet-commander.js';

export interface RolloutWorkerConfig {
  concurrency?: number;
}

/**
 * Creates and starts the rollout worker
 */
export function createRolloutWorker(
  prisma: PrismaClient,
  logger: Logger,
  fleetCommander?: FleetCommander,
  config: RolloutWorkerConfig = {}
): Worker<RolloutJobData, void> {
  const workerLogger = logger.child({ service: 'rollout-worker' });
  const orchestrator = new RolloutOrchestrator(prisma, logger, fleetCommander);

  const processor = async (job: Job<RolloutJobData>): Promise<void> => {
    const { tenantId, rolloutId, release, sensors, options } = job.data;

    workerLogger.info(
      {
        jobId: job.id,
        rolloutId,
        releaseVersion: release.version,
        sensorCount: sensors.length,
        strategy: options.strategy,
      },
      'Processing rollout job'
    );

    // Update job progress for monitoring
    await job.updateProgress(0);

    try {
      // Execute the rollout using the orchestrator
      await orchestrator.executeRollout(tenantId, rolloutId, release, sensors, options);

      await job.updateProgress(100);

      workerLogger.info(
        { jobId: job.id, rolloutId },
        'Rollout job completed successfully'
      );
    } catch (error) {
      workerLogger.error(
        { jobId: job.id, rolloutId, error },
        'Rollout job failed'
      );

      // Mark the rollout as failed in the database
      try {
        await prisma.rollout.update({
          where: { id: rolloutId },
          data: {
            status: 'failed',
            completedAt: new Date(),
          },
        });
      } catch (updateError) {
        workerLogger.error(
          { rolloutId, updateError },
          'Failed to update rollout status to failed'
        );
      }

      // Re-throw to trigger BullMQ retry mechanism
      throw error;
    }
  };

  const worker = createWorker<RolloutJobData, void>(
    QUEUE_NAMES.ROLLOUT,
    processor,
    workerLogger,
    {
      concurrency: config.concurrency ?? 1,
      // Long lock duration since rollouts can take 10+ minutes
      lockDuration: 20 * 60 * 1000, // 20 minutes
      lockRenewTime: 10 * 60 * 1000, // Renew every 10 minutes
    }
  );

  // Handle stalled jobs (e.g., server restart mid-rollout)
  worker.on('stalled', async (jobId: string) => {
    workerLogger.warn({ jobId }, 'Rollout job stalled - will be retried');

    // Try to mark the rollout as needing retry
    // The job data is not available here, so we'd need to track this separately
    // For now, BullMQ will automatically retry the job
  });

  workerLogger.info('Rollout worker started');

  return worker;
}

/**
 * Gracefully stops the rollout worker
 */
export async function stopRolloutWorker(
  worker: Worker<RolloutJobData, void>,
  logger: Logger
): Promise<void> {
  await closeWorker(worker, logger);
}

/**
 * Resume in-progress rollouts after server restart
 *
 * This checks for rollouts marked as 'in_progress' that don't have
 * corresponding active jobs and either re-queues them or marks them as failed.
 */
export async function recoverStalledRollouts(
  prisma: PrismaClient,
  logger: Logger
): Promise<void> {
  const workerLogger = logger.child({ service: 'rollout-recovery' });

  try {
    // Find rollouts that were in progress but may have been interrupted
    const stalledRollouts = await prisma.rollout.findMany({
      where: {
        status: 'in_progress',
        // Rollout started more than 30 minutes ago might be stalled
        startedAt: {
          lt: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
      include: {
        release: true,
        progress: {
          where: {
            status: { in: ['pending', 'downloading'] },
          },
        },
      },
    });

    if (stalledRollouts.length === 0) {
      workerLogger.info('No stalled rollouts found');
      return;
    }

    workerLogger.warn(
      { count: stalledRollouts.length },
      'Found potentially stalled rollouts'
    );

    // For now, mark them as failed since we can't easily recover mid-batch
    // A more sophisticated implementation could re-queue only the pending sensors
    for (const rollout of stalledRollouts) {
      await prisma.rollout.update({
        where: { id: rollout.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      });

      // Mark pending progress entries as failed
      await prisma.rolloutProgress.updateMany({
        where: {
          rolloutId: rollout.id,
          status: { in: ['pending', 'downloading'] },
        },
        data: {
          status: 'failed',
          error: 'Rollout interrupted by server restart',
        },
      });

      workerLogger.info(
        { rolloutId: rollout.id, releaseVersion: rollout.release.version },
        'Marked stalled rollout as failed'
      );
    }
  } catch (error) {
    workerLogger.error({ error }, 'Failed to recover stalled rollouts');
  }
}

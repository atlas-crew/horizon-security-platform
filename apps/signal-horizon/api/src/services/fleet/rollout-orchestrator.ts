
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { Queue } from 'bullmq';
import type { FleetCommander } from './fleet-commander.js';
import { getErrorMessage } from '../../utils/errors.js';
import { createQueue, QUEUE_NAMES, type RolloutJobData } from '../../jobs/queue.js';

interface SensorInfo {
  id: string;
  name: string;
  version: string | null;
}

interface ReleaseInfo {
  id: string;
  version: string;
  binaryUrl: string;
  sha256: string;
  size: number;
  changelog: string;
}

interface BatchResult {
  success: boolean;
  failedSensors: string[];
}

/**
 * Orchestrates firmware rollouts with health-aware batch processing
 */
export class RolloutOrchestrator {
  private prisma: PrismaClient;
  private logger: Logger;
  private fleetCommander?: FleetCommander;
  private rolloutQueue: Queue<RolloutJobData> | null = null;

  constructor(prisma: PrismaClient, logger: Logger, fleetCommander?: FleetCommander) {
    this.prisma = prisma;
    this.logger = logger.child({ service: 'rollout-orchestrator' });
    this.fleetCommander = fleetCommander;
  }

  /**
   * Initialize the job queue for background rollout processing
   * Call this during server startup to enable queue-based execution
   */
  initQueue(): Queue<RolloutJobData> {
    if (!this.rolloutQueue) {
      this.rolloutQueue = createQueue<RolloutJobData>(
        QUEUE_NAMES.ROLLOUT,
        this.logger
      );
    }
    return this.rolloutQueue;
  }

  /**
   * Get the rollout queue (creates if not exists)
   */
  getQueue(): Queue<RolloutJobData> {
    return this.initQueue();
  }

  /**
   * Close the queue connection gracefully
   */
  async closeQueue(): Promise<void> {
    if (this.rolloutQueue) {
      await this.rolloutQueue.close();
      this.rolloutQueue = null;
      this.logger.info('Rollout queue closed');
    }
  }

  /**
   * Enqueue a rollout for background execution
   * This is the preferred method - it adds the job to a queue instead of executing inline
   *
   * @returns The job ID for tracking
   */
  async enqueueRollout(
    tenantId: string,
    rolloutId: string,
    release: ReleaseInfo,
    sensors: SensorInfo[],
    options: {
      strategy: string;
      batchSize: number;
      batchDelay: number;
    }
  ): Promise<{ jobId: string }> {
    const queue = this.getQueue();

    const job = await queue.add(
      `rollout-${rolloutId}`,
      {
        tenantId,
        rolloutId,
        release: {
          id: release.id,
          version: release.version,
          binaryUrl: release.binaryUrl,
          sha256: release.sha256,
          size: release.size,
          changelog: release.changelog,
        },
        sensors: sensors.map((s) => ({
          id: s.id,
          name: s.name,
          version: s.version,
        })),
        options,
      },
      {
        jobId: rolloutId, // Use rolloutId as job ID for easy lookup
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10 seconds initial delay on retry
        },
      }
    );

    this.logger.info(
      {
        jobId: job.id,
        rolloutId,
        releaseVersion: release.version,
        sensorCount: sensors.length,
        strategy: options.strategy,
      },
      'Rollout job enqueued'
    );

    return { jobId: job.id! };
  }

  /**
   * Get the status of a rollout job
   */
  async getJobStatus(rolloutId: string): Promise<{
    state: string;
    progress: number;
    failedReason?: string;
  } | null> {
    const queue = this.getQueue();
    const job = await queue.getJob(rolloutId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = typeof job.progress === 'number' ? job.progress : 0;

    return {
      state,
      progress,
      failedReason: job.failedReason,
    };
  }

  /**
   * Execute a rollout asynchronously
   * @param tenantId - The tenant making the request (required for authorization)
   */
  async executeRollout(
    tenantId: string,
    rolloutId: string,
    release: ReleaseInfo,
    sensors: SensorInfo[],
    options: {
      strategy: string;
      batchSize: number;
      batchDelay: number;
    }
  ): Promise<void> {
    const { strategy, batchSize, batchDelay } = options;

    // Mark rollout as in progress
    await this.prisma.rollout.update({
      where: { id: rolloutId },
      data: {
        status: 'in_progress',
        startedAt: new Date(),
      },
    });

    try {
      const batches = this.createBatches(sensors, strategy, batchSize);

      this.logger.info(
        {
          rolloutId,
          strategy,
          totalSensors: sensors.length,
          batchCount: batches.length,
        },
        'Starting rollout execution'
      );

      let totalFailures = 0;
      const MAX_TOTAL_FAILURES = Math.max(1, Math.floor(sensors.length * 0.2)); // Abort if 20% fail

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        // Check cancellation
        if (await this.isCancelled(rolloutId)) {
          this.logger.info({ rolloutId }, 'Rollout cancelled, stopping');
          return;
        }

        this.logger.info(
          {
            rolloutId,
            batchIndex: batchIndex + 1,
            batchSize: batch.length,
          },
          'Processing batch'
        );

        // Process batch: Send commands and wait for health check
        const result = await this.processBatch(tenantId, rolloutId, release, batch, batchDelay);
        
        totalFailures += result.failedSensors.length;

        if (totalFailures >= MAX_TOTAL_FAILURES) {
           this.logger.error(
             { rolloutId, totalFailures, maxFailures: MAX_TOTAL_FAILURES },
             'Rollout aborted: Failure threshold exceeded'
           );
           // We don't throw, just break to finish cleanly as "failed"
           break;
        }
      }

      await this.finalizeRollout(rolloutId);

    } catch (error) {
      this.logger.error({ error, rolloutId }, 'Rollout execution failed');
      await this.failRollout(rolloutId);
    }
  }

  private createBatches(sensors: SensorInfo[], strategy: string, batchSize: number): SensorInfo[][] {
    const batches: SensorInfo[][] = [];
    const MAX_BATCH_SIZE = 100; // Cap to prevent connection pool exhaustion

    switch (strategy) {
      case 'immediate':
        // Even for immediate, chunk into manageable batches
        for (let i = 0; i < sensors.length; i += MAX_BATCH_SIZE) {
          batches.push(sensors.slice(i, i + MAX_BATCH_SIZE));
        }
        break;

      case 'canary':
        const canarySize = Math.max(1, Math.floor(sensors.length * 0.1));
        batches.push(sensors.slice(0, canarySize));
        if (sensors.length > canarySize) {
          // Chunk remaining sensors into max batch size
          const remaining = sensors.slice(canarySize);
          for (let i = 0; i < remaining.length; i += MAX_BATCH_SIZE) {
            batches.push(remaining.slice(i, i + MAX_BATCH_SIZE));
          }
        }
        break;

      case 'rolling':
        const effectiveBatchSize = Math.min(batchSize, MAX_BATCH_SIZE);
        for (let i = 0; i < sensors.length; i += effectiveBatchSize) {
          batches.push(sensors.slice(i, i + effectiveBatchSize));
        }
        break;

      default:
        // Default to chunked batches
        for (let i = 0; i < sensors.length; i += MAX_BATCH_SIZE) {
          batches.push(sensors.slice(i, i + MAX_BATCH_SIZE));
        }
    }
    return batches;
  }

  private async isCancelled(rolloutId: string): Promise<boolean> {
    const rollout = await this.prisma.rollout.findUnique({
      where: { id: rolloutId },
      select: { status: true },
    });
    return rollout?.status === 'cancelled';
  }

  private async processBatch(
    tenantId: string,
    rolloutId: string,
    release: ReleaseInfo,
    batch: SensorInfo[],
    batchDelaySeconds: number
  ): Promise<BatchResult> {
    const CONCURRENCY = 50; // Limit concurrent operations to avoid connection pool exhaustion

    // 1. Send update commands with controlled concurrency
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (sensor) => {
          try {
            await this.prisma.rolloutProgress.updateMany({
              where: { rolloutId, sensorId: sensor.id },
              data: { status: 'downloading' },
            });

            if (this.fleetCommander) {
              await this.fleetCommander.sendCommand(tenantId, sensor.id, {
                type: 'update',
                payload: {
                  version: release.version,
                  changelog: release.changelog,
                  binary_url: release.binaryUrl,
                  sha256: release.sha256,
                  size: release.size,
                  released_at: new Date().toISOString(),
                },
              });
            } else {
              // Testing mode
              await this.prisma.rolloutProgress.updateMany({
                where: { rolloutId, sensorId: sensor.id },
                data: { status: 'activated' }, // Instant success for tests
              });
            }
          } catch (error) {
            this.logger.error({ error, sensorId: sensor.id }, 'Failed to send update');
            await this.markSensorFailed(rolloutId, sensor.id, getErrorMessage(error));
          }
        })
      );
    }

    // If no commander, we assume test mode and return success immediately
    if (!this.fleetCommander) {
      return { success: true, failedSensors: [] };
    }

    // 2. Monitor health
    // We wait for batchDelaySeconds + extra buffer for installation/restart
    const INSTALL_TIMEOUT_BUFFER = 60; // 60 seconds for install + reboot
    const waitTimeSeconds = Math.max(batchDelaySeconds, INSTALL_TIMEOUT_BUFFER);
    
    this.logger.info(
      { rolloutId, waitTimeSeconds, sensorCount: batch.length },
      'Monitoring batch health'
    );

    return await this.monitorBatchHealth(rolloutId, batch, release.version, waitTimeSeconds);
  }

  private async monitorBatchHealth(
    rolloutId: string,
    sensors: SensorInfo[],
    targetVersion: string,
    timeoutSeconds: number
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const endTime = startTime + timeoutSeconds * 1000;
    const pendingSensors = new Set(sensors.map(s => s.id));
    const failedSensors: string[] = [];

    // Poll until timeout or all sensors processed
    while (Date.now() < endTime && pendingSensors.size > 0) {
      // Check cancellation
      if (await this.isCancelled(rolloutId)) {
        return { success: false, failedSensors: Array.from(pendingSensors) };
      }

      // Batch query all pending sensors at once (fixes N+1 query pattern)
      const sensorIds = Array.from(pendingSensors);
      const sensorResults = await this.prisma.sensor.findMany({
        where: { id: { in: sensorIds } },
        select: { id: true, version: true, connectionState: true, lastHeartbeat: true }
      });

      // Create lookup map for O(1) access
      const sensorMap = new Map(sensorResults.map(s => [s.id, s]));

      // Track sensors to mark as activated in bulk
      const activatedSensorIds: string[] = [];

      for (const sensorId of sensorIds) {
        const sensor = sensorMap.get(sensorId);

        if (!sensor) {
          pendingSensors.delete(sensorId);
          failedSensors.push(sensorId);
          await this.markSensorFailed(rolloutId, sensorId, 'Sensor deleted during rollout');
          continue;
        }

        // Success condition: Version matches AND connected AND recent heartbeat
        const isVersionMatch = sensor.version === targetVersion;
        const isConnected = sensor.connectionState === 'CONNECTED';
        const isFresh = sensor.lastHeartbeat && (Date.now() - sensor.lastHeartbeat.getTime() < 60000);

        if (isVersionMatch && isConnected && isFresh) {
          pendingSensors.delete(sensorId);
          activatedSensorIds.push(sensorId);
        }
      }

      // Batch update activated sensors
      if (activatedSensorIds.length > 0) {
        await this.prisma.rolloutProgress.updateMany({
          where: { rolloutId, sensorId: { in: activatedSensorIds } },
          data: { status: 'activated' }
        });
      }

      if (pendingSensors.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      }
    }

    // Mark all remaining as failed (timeout) in a single batch operation
    const remainingSensorIds = Array.from(pendingSensors);
    if (remainingSensorIds.length > 0) {
      failedSensors.push(...remainingSensorIds);
      await this.prisma.rolloutProgress.updateMany({
        where: { rolloutId, sensorId: { in: remainingSensorIds } },
        data: { status: 'failed', error: 'Update timeout - sensor did not report new version' }
      });
    }

    const success = failedSensors.length === 0;
    return { success, failedSensors };
  }

  private async markSensorFailed(rolloutId: string, sensorId: string, error: string) {
    await this.prisma.rolloutProgress.updateMany({
      where: { rolloutId, sensorId },
      data: { status: 'failed', error }
    });
  }

  private async finalizeRollout(rolloutId: string) {
    const progress = await this.prisma.rolloutProgress.findMany({
      where: { rolloutId },
      select: { status: true }
    });

    const failedCount = progress.filter(p => p.status === 'failed').length;
    // Consider failed if ANY failed? Or if ALL failed? 
    // Usually "completed" means finished running, "failed" means catastrophic.
    // Let's stick to existing logic: only 'failed' if ALL failed, otherwise 'completed' (even with errors)
    // But logically, if we aborted, it might be 'failed'.
    // Let's check if there are any 'pending' or 'downloading' left (aborted)
    const incompleteCount = progress.filter(p => ['pending', 'downloading'].includes(p.status)).length;
    
    let status = 'completed';
    if (failedCount === progress.length) status = 'failed';
    if (incompleteCount > 0) status = 'failed'; // Aborted mid-way

    await this.prisma.rollout.update({
      where: { id: rolloutId },
      data: { status, completedAt: new Date() }
    });
  }

  private async failRollout(rolloutId: string) {
    await this.prisma.rollout.update({
      where: { id: rolloutId },
      data: { status: 'failed', completedAt: new Date() }
    });
  }
}

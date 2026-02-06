/**
 * Data Retention Queue
 *
 * Schedules retention purges via BullMQ to avoid multi-instance overlap.
 */

import type { Logger } from 'pino';
import type { Job, Queue, Worker } from 'bullmq';
import type { DataRetentionService } from './data-retention.js';
import { createQueue, createWorker, QUEUE_NAMES } from './queue.js';

export interface RetentionJobData {
  trigger: 'startup' | 'schedule';
}

export function createRetentionQueue(logger: Logger): Queue<RetentionJobData> {
  return createQueue<RetentionJobData>(QUEUE_NAMES.RETENTION, logger, {
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        count: 25,
        age: 24 * 60 * 60,
      },
      removeOnFail: {
        count: 50,
        age: 7 * 24 * 60 * 60,
      },
    },
  });
}

export function createRetentionWorker(
  service: DataRetentionService,
  logger: Logger
): Worker<RetentionJobData, Record<string, number>> {
  return createWorker<RetentionJobData, Record<string, number>>(
    QUEUE_NAMES.RETENTION,
    async (job: Job<RetentionJobData>) => {
      logger.info({ jobId: job.id, trigger: job.data.trigger }, 'Running data retention purge');
      return service.runPurge();
    },
    logger,
    {
      concurrency: 1,
      lockDuration: 30 * 60 * 1000,
      lockRenewTime: 10 * 60 * 1000,
    }
  );
}

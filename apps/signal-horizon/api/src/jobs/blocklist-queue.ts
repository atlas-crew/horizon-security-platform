/**
 * Blocklist Queue
 *
 * Decouples threat detection from network broadcasting. (labs-aoyv)
 */

import { Queue, Worker, type Job } from 'bullmq';
import type { BlocklistUpdate } from '../types/protocol.js';
import type { SensorGateway } from '../websocket/sensor-gateway.js';
import type { Logger } from 'pino';
import { getRedisConfig } from './queue.js';

export const BLOCKLIST_QUEUE_NAME = 'blocklist-push';
export const BLOCKLIST_DLQ_NAME = 'blocklist-dlq';

export interface BlocklistJobData {
  updates: BlocklistUpdate[];
  tenantId?: string;
  isFleetEvent?: boolean;
}

/**
 * Creates the blocklist push queue.
 */
export function createBlocklistQueue(logger?: Logger) {
  const queue = new Queue<BlocklistJobData>(BLOCKLIST_QUEUE_NAME, {
    connection: getRedisConfig(),
    defaultJobOptions: {
      attempts: 5, // Increased retries for network resilience (labs-24ul)
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: 5000, // Keep more failed jobs for debugging
    },
  });

  if (logger) {
    queue.on('error', (error) => {
      logger.error({ error, queue: BLOCKLIST_QUEUE_NAME }, 'Blocklist queue error');
    });
  }

  return queue;
}

/**
 * Creates the blocklist push worker.
 */
export function createBlocklistWorker(
  sensorGateway: SensorGateway,
  logger: Logger
) {
  const log = logger.child({ worker: 'blocklist-push' });
  const redisConfig = getRedisConfig();

  // Create DLQ for permanently failed jobs (labs-24ul)
  const dlq = new Queue<BlocklistJobData>(BLOCKLIST_DLQ_NAME, {
    connection: redisConfig,
  });

  const worker = new Worker<BlocklistJobData>(
    BLOCKLIST_QUEUE_NAME,
    async (job: Job<BlocklistJobData>) => {
      const { updates, tenantId, isFleetEvent } = job.data;
      
      log.debug({ jobId: job.id, attempt: job.attemptsMade + 1, updateCount: updates.length }, 'Processing blocklist push job');

      try {
        if (isFleetEvent) {
          sensorGateway.broadcastBlocklistPush(updates);
        } else if (tenantId) {
          sensorGateway.broadcastBlocklistPush(updates);
        }
      } catch (error) {
        log.error({ error, jobId: job.id, attempt: job.attemptsMade + 1 }, 'Failed to broadcast blocklist update');
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: 5,
    }
  );

  // Monitor permanently failed jobs (labs-24ul)
  worker.on('failed', async (job, error) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
      log.error(
        { jobId: job.id, error: error.message, data: job.data },
        'Blocklist job permanently failed - moving to DLQ'
      );

      try {
        await dlq.add('failed-broadcast', job.data, {
          jobId: `dlq-${job.id}-${Date.now()}`,
          removeOnComplete: false,
        });
      } catch (dlqError) {
        log.error({ error: dlqError, originalJobId: job.id }, 'Failed to move job to DLQ');
      }
    }
  });

  worker.on('error', (error) => {
    log.error({ error }, 'Blocklist worker global error');
  });

  return worker;
}

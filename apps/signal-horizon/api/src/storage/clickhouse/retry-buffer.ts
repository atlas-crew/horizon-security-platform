/**
 * ClickHouse Retry Buffer
 *
 * Provides reliable ingestion with automatic retries and exponential backoff.
 * Buffers failed writes and retries them in the background.
 */

import type { Logger } from 'pino';
import type {
  ClickHouseService,
  SignalEventRow,
  CampaignHistoryRow,
  BlocklistHistoryRow,
  HttpTransactionRow,
} from './client.js';

/** Configuration for the retry buffer */
export interface RetryBufferConfig {
  /** Maximum items to buffer (default: 10000) */
  maxBufferSize: number;
  /** Maximum retry attempts per item (default: 5) */
  maxRetries: number;
  /** Initial retry delay in ms (default: 1000) */
  initialDelayMs: number;
  /** Maximum retry delay in ms (default: 60000) */
  maxDelayMs: number;
  /** Retry interval check in ms (default: 5000) */
  retryIntervalMs: number;
  /** Batch size for retry writes (default: 100) */
  retryBatchSize: number;
}

export const DEFAULT_RETRY_CONFIG: RetryBufferConfig = {
  maxBufferSize: 10000,
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  retryIntervalMs: 5000,
  retryBatchSize: 100,
};

/** Types of buffered items */
type BufferItemType = 'signal' | 'campaign' | 'blocklist' | 'transaction';

/** Buffered item with retry metadata */
interface BufferedItem<T> {
  type: BufferItemType;
  data: T;
  attempts: number;
  nextRetryAt: number;
  addedAt: number;
}

/** Statistics for the retry buffer */
export interface RetryBufferStats {
  bufferedCount: number;
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  droppedItems: number;
  oldestItemAge: number | null;
  isProcessing: boolean;
  bufferUtilization: number;
}

/**
 * Reliable ClickHouse ingestion with automatic retries.
 *
 * Wraps ClickHouseService to provide:
 * - Automatic buffering of failed writes
 * - Exponential backoff retry logic
 * - Memory-bounded queue with drop-oldest eviction
 * - Statistics for monitoring
 */
export class ClickHouseRetryBuffer {
  private clickhouse: ClickHouseService;
  private logger: Logger;
  private config: RetryBufferConfig;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buffer: BufferedItem<any>[] = [];
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  // Statistics
  private totalAttempts = 0;
  private successfulRetries = 0;
  private failedRetries = 0;
  private droppedItems = 0;

  constructor(
    clickhouse: ClickHouseService,
    logger: Logger,
    config: Partial<RetryBufferConfig> = {}
  ) {
    this.clickhouse = clickhouse;
    this.logger = logger.child({ component: 'clickhouse-retry-buffer' });
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Start the background retry processor
   */
  start(): void {
    if (this.retryTimer) return;

    this.retryTimer = setInterval(() => {
      void this.processRetries();
    }, this.config.retryIntervalMs);

    this.logger.info(
      { config: this.config },
      'ClickHouse retry buffer started'
    );
  }

  /**
   * Stop the background retry processor
   */
  stop(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Insert signal events with automatic retry on failure.
   * Returns true if the write succeeded immediately, false if buffered for retry.
   */
  async insertSignalEvents(signals: SignalEventRow[]): Promise<boolean> {
    if (signals.length === 0) return true;

    try {
      await this.clickhouse.insertSignalEvents(signals);
      return true;
    } catch (error) {
      this.logger.warn(
        { error, count: signals.length },
        'Signal events write failed, buffering for retry'
      );
      this.bufferForRetry('signal', signals);
      return false;
    }
  }

  /**
   * Insert campaign event with automatic retry on failure.
   */
  async insertCampaignEvent(event: CampaignHistoryRow): Promise<boolean> {
    try {
      await this.clickhouse.insertCampaignEvent(event);
      return true;
    } catch (error) {
      this.logger.warn(
        { error, campaignId: event.campaign_id },
        'Campaign event write failed, buffering for retry'
      );
      this.bufferForRetry('campaign', event);
      return false;
    }
  }

  /**
   * Insert blocklist events with automatic retry on failure.
   */
  async insertBlocklistEvents(events: BlocklistHistoryRow[]): Promise<boolean> {
    if (events.length === 0) return true;

    try {
      await this.clickhouse.insertBlocklistEvents(events);
      return true;
    } catch (error) {
      this.logger.warn(
        { error, count: events.length },
        'Blocklist events write failed, buffering for retry'
      );
      this.bufferForRetry('blocklist', events);
      return false;
    }
  }

  /**
   * Insert HTTP transaction events with automatic retry on failure.
   */
  async insertHttpTransactions(events: HttpTransactionRow[]): Promise<boolean> {
    if (events.length === 0) return true;

    try {
      await this.clickhouse.insertHttpTransactions(events);
      return true;
    } catch (error) {
      this.logger.warn(
        { error, count: events.length },
        'HTTP transaction write failed, buffering for retry'
      );
      this.bufferForRetry('transaction', events);
      return false;
    }
  }

  /**
   * Buffer an item for retry
   */
  private bufferForRetry<T>(type: BufferItemType, data: T): void {
    const now = Date.now();

    // Check buffer capacity
    if (this.buffer.length >= this.config.maxBufferSize) {
      // Evict oldest item
      const evicted = this.buffer.shift();
      if (evicted) {
        this.droppedItems++;
        this.logger.warn(
          { type: evicted.type, attempts: evicted.attempts },
          'Buffer full, dropping oldest item'
        );
      }
    }

    this.buffer.push({
      type,
      data,
      attempts: 1, // Already tried once
      nextRetryAt: now + this.config.initialDelayMs,
      addedAt: now,
    });
  }

  /**
   * Process items that are ready for retry
   */
  private async processRetries(): Promise<void> {
    if (this.isProcessing || this.buffer.length === 0) return;

    this.isProcessing = true;
    const now = Date.now();

    try {
      // Find items ready for retry (sorted by next retry time)
      const readyItems = this.buffer
        .filter(item => item.nextRetryAt <= now)
        .slice(0, this.config.retryBatchSize);

      if (readyItems.length === 0) return;

      this.logger.debug(
        { count: readyItems.length, bufferSize: this.buffer.length },
        'Processing retry batch'
      );

      for (const item of readyItems) {
        this.totalAttempts++;

        try {
          await this.retryItem(item);
          // Success - remove from buffer
          const index = this.buffer.indexOf(item);
          if (index > -1) {
            this.buffer.splice(index, 1);
          }
          this.successfulRetries++;
        } catch {
          item.attempts++;
          this.failedRetries++;

          if (item.attempts >= this.config.maxRetries) {
            // Max retries exceeded - drop the item
            const index = this.buffer.indexOf(item);
            if (index > -1) {
              this.buffer.splice(index, 1);
            }
            this.droppedItems++;
            this.logger.error(
              { type: item.type, attempts: item.attempts },
              'Max retries exceeded, dropping item'
            );
          } else {
            // Schedule next retry with exponential backoff
            const delay = Math.min(
              this.config.initialDelayMs * Math.pow(2, item.attempts - 1),
              this.config.maxDelayMs
            );
            item.nextRetryAt = now + delay;
            this.logger.debug(
              { type: item.type, attempts: item.attempts, nextDelayMs: delay },
              'Scheduled retry with backoff'
            );
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a single buffered item
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async retryItem(item: BufferedItem<any>): Promise<void> {
    switch (item.type) {
      case 'signal':
        await this.clickhouse.insertSignalEvents(item.data as SignalEventRow[]);
        break;
      case 'campaign':
        await this.clickhouse.insertCampaignEvent(item.data as CampaignHistoryRow);
        break;
      case 'blocklist':
        await this.clickhouse.insertBlocklistEvents(item.data as BlocklistHistoryRow[]);
        break;
      case 'transaction':
        await this.clickhouse.insertHttpTransactions(item.data as HttpTransactionRow[]);
        break;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): RetryBufferStats {
    const now = Date.now();
    const oldestItem = this.buffer.length > 0
      ? this.buffer.reduce((min, item) => item.addedAt < min.addedAt ? item : min)
      : null;

    return {
      bufferedCount: this.buffer.length,
      totalAttempts: this.totalAttempts,
      successfulRetries: this.successfulRetries,
      failedRetries: this.failedRetries,
      droppedItems: this.droppedItems,
      oldestItemAge: oldestItem ? now - oldestItem.addedAt : null,
      isProcessing: this.isProcessing,
      bufferUtilization: this.buffer.length / this.config.maxBufferSize,
    };
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Check if ClickHouse is enabled (delegates to underlying service)
   */
  isEnabled(): boolean {
    return this.clickhouse.isEnabled();
  }

  /**
   * Flush all pending retries (best-effort, for graceful shutdown)
   */
  async flush(): Promise<{ succeeded: number; failed: number }> {
    this.stop(); // Stop background processing

    let succeeded = 0;
    let failed = 0;

    for (const item of [...this.buffer]) {
      try {
        await this.retryItem(item);
        succeeded++;
      } catch {
        failed++;
      }
    }

    this.buffer = [];
    this.logger.info({ succeeded, failed }, 'Flushed retry buffer');

    return { succeeded, failed };
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats(): void {
    this.totalAttempts = 0;
    this.successfulRetries = 0;
    this.failedRetries = 0;
    this.droppedItems = 0;
  }

  /**
   * Clear the buffer (for testing)
   */
  clear(): void {
    this.buffer = [];
  }
}

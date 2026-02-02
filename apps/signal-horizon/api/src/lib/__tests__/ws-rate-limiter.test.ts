/**
 * Tests for WebSocket Rate Limiter
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  WebSocketRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
  defaultWsRateLimiter,
} from '../ws-rate-limiter.js';

describe('ws-rate-limiter', () => {
  describe('WebSocketRateLimiter', () => {
    let limiter: WebSocketRateLimiter;

    beforeEach(() => {
      limiter = new WebSocketRateLimiter({
        maxMessagesPerSecond: 10,
        burstLimit: 15,
        disconnectOnExceed: true,
        cleanupIntervalMs: 60000,
      });
    });

    afterEach(() => {
      limiter.destroy();
    });

    describe('checkLimit', () => {
      test('allows first message from new connection', () => {
        const result = limiter.checkLimit('conn-1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(14);
        expect(result.shouldDisconnect).toBe(false);
        expect(result.retryAfterMs).toBe(0);
      });

      test('decrements tokens on each message', () => {
        limiter.checkLimit('conn-1');
        const result = limiter.checkLimit('conn-1');
        expect(result.remaining).toBe(13);
      });

      test('allows burst up to burst limit', () => {
        for (let i = 0; i < 15; i++) {
          const result = limiter.checkLimit('conn-1');
          expect(result.allowed).toBe(true);
        }
      });

      test('blocks when burst limit exceeded', () => {
        // Use all 15 tokens
        for (let i = 0; i < 15; i++) {
          limiter.checkLimit('conn-1');
        }

        // 16th message should be blocked
        const result = limiter.checkLimit('conn-1');
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.shouldDisconnect).toBe(true);
      });

      test('provides retry-after time when blocked', () => {
        // Use all tokens
        for (let i = 0; i < 15; i++) {
          limiter.checkLimit('conn-1');
        }

        const result = limiter.checkLimit('conn-1');
        expect(result.retryAfterMs).toBeGreaterThan(0);
        // At 10 messages/sec, retry should be ~100ms
        expect(result.retryAfterMs).toBe(100);
      });

      test('tracks connections independently', () => {
        // Use all tokens for conn-1
        for (let i = 0; i < 15; i++) {
          limiter.checkLimit('conn-1');
        }

        // conn-2 should still have full bucket
        const result = limiter.checkLimit('conn-2');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(14);
      });

      test('refills tokens over time', async () => {
        // Use 10 tokens
        for (let i = 0; i < 10; i++) {
          limiter.checkLimit('conn-1');
        }

        // Wait for refill (at 10/sec, 500ms = 5 tokens)
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Should have ~5 more tokens (5 left + 5 refilled = 10)
        const result = limiter.checkLimit('conn-1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThanOrEqual(4);
      });

      test('does not exceed burst limit on refill', async () => {
        limiter.checkLimit('conn-1'); // 14 remaining

        // Wait longer than needed to "overfill"
        await new Promise((resolve) => setTimeout(resolve, 200));

        const result = limiter.checkLimit('conn-1');
        // Should be capped at 15 (burst limit) - 1 = 14
        expect(result.remaining).toBeLessThanOrEqual(14);
      });
    });

    describe('peekLimit', () => {
      test('does not consume tokens', () => {
        const peek1 = limiter.peekLimit('conn-1');
        const peek2 = limiter.peekLimit('conn-1');

        // Both should show full bucket for new connection
        expect(peek1.remaining).toBe(15);
        expect(peek2.remaining).toBe(15);
      });

      test('reflects current state without modification', () => {
        // Consume some tokens
        limiter.checkLimit('conn-1');
        limiter.checkLimit('conn-1');

        const peek = limiter.peekLimit('conn-1');
        expect(peek.remaining).toBe(13);

        // Peek again - should still be 13
        const peek2 = limiter.peekLimit('conn-1');
        expect(peek2.remaining).toBe(13);
      });

      test('shows allowed=false when tokens depleted', () => {
        // Use all tokens
        for (let i = 0; i < 15; i++) {
          limiter.checkLimit('conn-1');
        }

        const peek = limiter.peekLimit('conn-1');
        expect(peek.allowed).toBe(false);
        expect(peek.remaining).toBe(0);
        expect(peek.retryAfterMs).toBeGreaterThan(0);
      });
    });

    describe('removeConnection', () => {
      test('removes connection from tracking', () => {
        limiter.checkLimit('conn-1');
        expect(limiter.getStats().activeConnections).toBe(1);

        limiter.removeConnection('conn-1');
        expect(limiter.getStats().activeConnections).toBe(0);
      });

      test('handles non-existent connection gracefully', () => {
        expect(() => limiter.removeConnection('non-existent')).not.toThrow();
      });
    });

    describe('resetConnection', () => {
      test('restores full token bucket', () => {
        // Use all tokens
        for (let i = 0; i < 15; i++) {
          limiter.checkLimit('conn-1');
        }

        limiter.resetConnection('conn-1');

        const result = limiter.checkLimit('conn-1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(14);
      });

      test('clears violation count', () => {
        // Trigger violation
        for (let i = 0; i < 16; i++) {
          limiter.checkLimit('conn-1');
        }

        expect(limiter.getConnectionViolations('conn-1')).toBe(1);

        limiter.resetConnection('conn-1');
        expect(limiter.getConnectionViolations('conn-1')).toBe(0);
      });
    });

    describe('getStats', () => {
      test('returns current statistics', () => {
        limiter.checkLimit('conn-1');
        limiter.checkLimit('conn-2');

        // Trigger violation
        for (let i = 0; i < 16; i++) {
          limiter.checkLimit('conn-3');
        }

        const stats = limiter.getStats();
        expect(stats.activeConnections).toBe(3);
        expect(stats.totalLimitViolations).toBe(1);
        expect(stats.config.maxMessagesPerSecond).toBe(10);
        expect(stats.config.burstLimit).toBe(15);
      });
    });

    describe('getConnectionViolations', () => {
      test('returns 0 for new connection', () => {
        expect(limiter.getConnectionViolations('conn-1')).toBe(0);
      });

      test('tracks violation count', () => {
        // Use all tokens and trigger violations
        for (let i = 0; i < 17; i++) {
          limiter.checkLimit('conn-1');
        }

        expect(limiter.getConnectionViolations('conn-1')).toBe(2);
      });
    });

    describe('destroy', () => {
      test('clears all connections', () => {
        limiter.checkLimit('conn-1');
        limiter.checkLimit('conn-2');

        limiter.destroy();
        expect(limiter.getStats().activeConnections).toBe(0);
      });
    });

    describe('configuration', () => {
      test('respects disconnectOnExceed=false', () => {
        const noDisconnectLimiter = new WebSocketRateLimiter({
          maxMessagesPerSecond: 10,
          burstLimit: 5,
          disconnectOnExceed: false,
        });

        // Exhaust tokens
        for (let i = 0; i < 6; i++) {
          noDisconnectLimiter.checkLimit('conn-1');
        }

        const result = noDisconnectLimiter.checkLimit('conn-1');
        expect(result.allowed).toBe(false);
        expect(result.shouldDisconnect).toBe(false);

        noDisconnectLimiter.destroy();
      });

      test('uses default config when not provided', () => {
        const defaultLimiter = new WebSocketRateLimiter();
        const stats = defaultLimiter.getStats();

        expect(stats.config.maxMessagesPerSecond).toBe(DEFAULT_RATE_LIMIT_CONFIG.maxMessagesPerSecond);
        expect(stats.config.burstLimit).toBe(DEFAULT_RATE_LIMIT_CONFIG.burstLimit);

        defaultLimiter.destroy();
      });
    });
  });

  describe('defaultWsRateLimiter', () => {
    test('is a singleton instance', () => {
      expect(defaultWsRateLimiter).toBeInstanceOf(WebSocketRateLimiter);
    });

    test('uses default configuration', () => {
      const stats = defaultWsRateLimiter.getStats();
      expect(stats.config.maxMessagesPerSecond).toBe(100);
      expect(stats.config.burstLimit).toBe(150);
    });
  });

  describe('DEFAULT_RATE_LIMIT_CONFIG', () => {
    test('has sensible defaults', () => {
      expect(DEFAULT_RATE_LIMIT_CONFIG.maxMessagesPerSecond).toBe(100);
      expect(DEFAULT_RATE_LIMIT_CONFIG.burstLimit).toBe(150);
      expect(DEFAULT_RATE_LIMIT_CONFIG.disconnectOnExceed).toBe(true);
      expect(DEFAULT_RATE_LIMIT_CONFIG.cleanupIntervalMs).toBe(60000);
      expect(DEFAULT_RATE_LIMIT_CONFIG.staleConnectionMs).toBe(300000);
    });
  });
});

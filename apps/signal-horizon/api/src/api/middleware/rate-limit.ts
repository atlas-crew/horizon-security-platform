/**
 * Rate Limiting Middleware
 * Provides tenant-scoped rate limiting for API endpoints
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Logger } from 'pino';

/**
 * Rate limit configuration for different endpoint types
 */
export interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Optional custom message */
  message?: string;
}

/**
 * Default rate limit configurations for playbook endpoints
 */
export const PlaybookRateLimits = {
  /** Playbook creation: 10 per minute per tenant */
  create: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many playbook creation requests. Please try again later.',
  },
  /** Playbook execution: 30 per minute per tenant */
  execute: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: 'Too many playbook execution requests. Please try again later.',
  },
  /** Step completions: 100 per minute per tenant */
  stepComplete: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Too many step completion requests. Please try again later.',
  },
} as const;

/**
 * Extract tenant ID from authenticated request for rate limit keying
 */
function getTenantKey(req: Request): string {
  // Use tenant ID from auth context if available
  if (req.auth?.tenantId) {
    return req.auth.tenantId;
  }
  // Fall back to IP if not authenticated (shouldn't happen with proper middleware ordering)
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create a tenant-scoped rate limiter
 *
 * @param config - Rate limit configuration
 * @param logger - Optional logger for rate limit events
 * @returns Express middleware for rate limiting
 */
export function createTenantRateLimiter(
  config: RateLimitConfig,
  logger?: Logger
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.maxRequests,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    keyGenerator: getTenantKey,
    handler: (req: Request, res: Response) => {
      const tenantId = getTenantKey(req);
      const retryAfterSeconds = Math.ceil(config.windowMs / 1000);

      if (logger) {
        logger.warn(
          {
            tenantId,
            path: req.path,
            method: req.method,
            limit: config.maxRequests,
            windowMs: config.windowMs,
          },
          'Rate limit exceeded'
        );
      }

      res.setHeader('Retry-After', retryAfterSeconds.toString());
      res.status(429).json({
        error: config.message || 'Too many requests. Please try again later.',
        retryAfter: retryAfterSeconds,
      });
    },
    skip: (req: Request) => {
      // Skip rate limiting for OPTIONS requests (CORS preflight)
      return req.method === 'OPTIONS';
    },
  });
}

/**
 * Pre-configured rate limiters for playbook endpoints
 */
export function createPlaybookRateLimiters(logger?: Logger) {
  return {
    /** Rate limiter for POST /playbooks (create) */
    create: createTenantRateLimiter(PlaybookRateLimits.create, logger),
    /** Rate limiter for POST /playbooks/:id/run (execute) */
    execute: createTenantRateLimiter(PlaybookRateLimits.execute, logger),
    /** Rate limiter for POST /playbooks/runs/:id/step (step completion) */
    stepComplete: createTenantRateLimiter(PlaybookRateLimits.stepComplete, logger),
  };
}

/**
 * Combined rate limiter that applies multiple limits
 * Useful for endpoints that count against multiple quotas
 */
export function combineRateLimiters(
  ...limiters: RateLimitRequestHandler[]
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const limiter of limiters) {
      await new Promise<void>((resolve, reject) => {
        limiter(req, res, (err?: unknown) => {
          if (err) {
            reject(err);
          } else if (res.headersSent) {
            // Rate limit was triggered, don't continue
            reject(new Error('Rate limit exceeded'));
          } else {
            resolve();
          }
        });
      }).catch(() => {
        // Response already sent by limiter handler
        return;
      });

      // If response was sent (rate limited), stop processing
      if (res.headersSent) {
        return;
      }
    }
    next();
  };
}

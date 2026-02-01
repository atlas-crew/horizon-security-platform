/**
 * Rate Limiter Middleware (PEN-003 Fixed)
 * Simple sliding window rate limiter for API endpoints with trusted proxy support.
 *
 * For production, consider using Redis-backed rate limiting
 * to support horizontal scaling.
 *
 * Security: Validates X-Forwarded-For comes from trusted proxies only.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Custom key extractor (default: IP address) */
  keyGenerator?: (req: Request) => string;
  /** Custom error message */
  message?: string;
  /**
   * Trusted proxy configuration.
   * - true: Trust all proxies (NOT RECOMMENDED for production)
   * - false: Don't trust any proxy, use socket IP only
   * - string[]: List of trusted proxy IPs/CIDRs
   * @default false
   */
  trustProxy?: boolean | string[];
}

/**
 * Create a rate limiter middleware with sliding window algorithm.
 *
 * @example
 * ```ts
 * // Limit to 100 requests per minute with trusted proxies
 * router.use('/query', createRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60 * 1000,
 *   trustProxy: ['10.0.0.0/8', '172.16.0.0/12'],  // Internal proxies
 * }));
 * ```
 */
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const {
    maxRequests,
    windowMs,
    keyGenerator = (req: Request) => getClientIp(req, options.trustProxy),
    message = 'Too many requests, please try again later',
  } = options;

  // In-memory store (for single instance)
  // For production, use Redis with MULTI/EXEC
  const store = new Map<string, RateLimitEntry>();

  // Cleanup old entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, windowMs);

  // Don't prevent process from exiting
  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = store.get(key);

    // Reset if window expired
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    entry.count++;
    store.set(key, entry);

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter: resetSeconds,
      });
      return;
    }

    next();
  };
}

/**
 * Check if an IP matches a CIDR range or exact IP.
 */
function ipMatchesCIDR(ip: string, cidr: string): boolean {
  // Normalize IPv6-mapped IPv4
  const normalizedIp = ip.replace(/^::ffff:/, '');

  // Exact match
  if (normalizedIp === cidr || ip === cidr) {
    return true;
  }

  // CIDR match (simplified - supports /8, /16, /24 for IPv4)
  if (cidr.includes('/')) {
    const [network, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);

    // Simple IPv4 CIDR matching
    const ipParts = normalizedIp.split('.').map(Number);
    const networkParts = network.split('.').map(Number);

    if (ipParts.length !== 4 || networkParts.length !== 4) {
      return false;
    }

    const octetsToCheck = Math.floor(prefix / 8);
    for (let i = 0; i < octetsToCheck; i++) {
      if (ipParts[i] !== networkParts[i]) {
        return false;
      }
    }

    // Partial octet matching
    const remainingBits = prefix % 8;
    if (remainingBits > 0 && octetsToCheck < 4) {
      const mask = 0xff << (8 - remainingBits);
      if ((ipParts[octetsToCheck] & mask) !== (networkParts[octetsToCheck] & mask)) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * Check if the direct connection IP is from a trusted proxy.
 */
function isTrustedProxy(
  socketIp: string | undefined,
  trustProxy: boolean | string[] | undefined
): boolean {
  if (trustProxy === true) {
    return true;
  }
  if (!trustProxy || trustProxy === false) {
    return false;
  }
  if (!socketIp) {
    return false;
  }

  // Check against trusted proxy list
  return trustProxy.some((trusted) => ipMatchesCIDR(socketIp, trusted));
}

/**
 * Extract client IP from request, handling proxies securely.
 *
 * PEN-003: Only trust X-Forwarded-For when the direct connection
 * comes from a trusted proxy. This prevents IP spoofing attacks.
 */
function getClientIp(
  req: Request,
  trustProxy?: boolean | string[]
): string {
  const socketIp = req.socket.remoteAddress;

  // Only use forwarded headers if connection is from trusted proxy
  if (isTrustedProxy(socketIp, trustProxy)) {
    // X-Forwarded-For: client, proxy1, proxy2
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      // Take the leftmost IP (original client)
      const clientIp = forwarded.split(',')[0].trim();
      if (clientIp) {
        return clientIp;
      }
    }

    // Try other common headers
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }

    // CF-Connecting-IP for Cloudflare
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
      return cfIp.trim();
    }
  }

  // Normalize IPv6-mapped IPv4 addresses
  if (socketIp?.startsWith('::ffff:')) {
    return socketIp.substring(7);
  }

  return socketIp ?? 'unknown';
}

/**
 * Get trusted proxy configuration from environment.
 * PEN-003: Configure trusted proxies via environment variable.
 *
 * Set TRUSTED_PROXIES to comma-separated list of IPs/CIDRs:
 * TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
 */
function getTrustedProxies(): string[] | false {
  const envValue = process.env.TRUSTED_PROXIES;
  if (!envValue) {
    return false; // Don't trust any proxy by default
  }
  return envValue.split(',').map((p) => p.trim()).filter(Boolean);
}

/**
 * Pre-configured rate limiters for common use cases.
 *
 * PEN-003: These use trusted proxy configuration from environment
 * to prevent IP spoofing via X-Forwarded-For headers.
 */
export const rateLimiters: Record<string, RequestHandler> = {
  /** Hunt queries: 100 requests per minute */
  hunt: createRateLimiter({
    maxRequests: 100,
    windowMs: 60 * 1000,
    message: 'Hunt query rate limit exceeded. Please wait before trying again.',
    trustProxy: getTrustedProxies(),
  }),

  /** Saved queries: 30 requests per minute */
  savedQueries: createRateLimiter({
    maxRequests: 30,
    windowMs: 60 * 1000,
    message: 'Saved query rate limit exceeded. Please wait before trying again.',
    trustProxy: getTrustedProxies(),
  }),

  /** Heavy aggregations: 10 requests per minute */
  aggregations: createRateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000,
    message: 'Aggregation rate limit exceeded. These queries are resource-intensive.',
    trustProxy: getTrustedProxies(),
  }),
};

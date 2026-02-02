/**
 * Query Parameter Limits Middleware (WS1-008)
 *
 * Enforces limits on query parameters to prevent DoS attacks via
 * excessive query string parsing or hash collision attacks.
 *
 * OWASP Reference: A05:2021 - Security Misconfiguration
 * CWE-400: Uncontrolled Resource Consumption
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { sendProblem } from '../lib/problem-details.js';

export interface QueryLimitsOptions {
  /**
   * Maximum number of query parameters allowed
   * @default 20
   */
  maxParams?: number;

  /**
   * Maximum total length of query string (in characters)
   * @default 2048
   */
  maxQueryLength?: number;

  /**
   * Maximum length of a single parameter value
   * @default 512
   */
  maxValueLength?: number;

  /**
   * Maximum length of a parameter key
   * @default 100
   */
  maxKeyLength?: number;

  /**
   * Routes to skip validation (e.g., GraphQL endpoints)
   */
  skipRoutes?: (string | RegExp)[];

  /**
   * Routes with custom limits (e.g., search endpoints may need more)
   */
  customLimits?: Map<string | RegExp, Partial<QueryLimitsOptions>>;

  /**
   * Custom error handler
   */
  onError?: (req: Request, res: Response, reason: string) => void;
}

const DEFAULT_OPTIONS: Required<Omit<QueryLimitsOptions, 'onError' | 'customLimits'>> & {
  customLimits: Map<string | RegExp, Partial<QueryLimitsOptions>>;
} = {
  maxParams: 20,
  maxQueryLength: 2048,
  maxValueLength: 512,
  maxKeyLength: 100,
  skipRoutes: [],
  customLimits: new Map(),
};

/**
 * Checks if a path matches any pattern in the list
 */
function matchesRoute(path: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return path === pattern || path.startsWith(pattern + '/');
    }
    return pattern.test(path);
  });
}

/**
 * Gets custom limits for a route, if defined
 */
function getCustomLimits(
  path: string,
  customLimits: Map<string | RegExp, Partial<QueryLimitsOptions>>
): Partial<QueryLimitsOptions> | null {
  for (const [pattern, limits] of customLimits) {
    if (typeof pattern === 'string') {
      if (path === pattern || path.startsWith(pattern + '/')) {
        return limits;
      }
    } else if (pattern.test(path)) {
      return limits;
    }
  }
  return null;
}

/**
 * Creates query parameter limits middleware
 *
 * @example
 * ```typescript
 * app.use(queryLimits({
 *   maxParams: 20,
 *   maxQueryLength: 2048,
 *   customLimits: new Map([
 *     ['/api/v1/hunt', { maxParams: 50, maxQueryLength: 4096 }],
 *     [/^\/api\/v1\/search/, { maxParams: 30 }],
 *   ]),
 * }));
 * ```
 */
export function queryLimits(options: QueryLimitsOptions = {}): RequestHandler {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
    customLimits: options.customLimits ?? DEFAULT_OPTIONS.customLimits,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip validation for excluded routes
    if (matchesRoute(req.path, config.skipRoutes)) {
      next();
      return;
    }

    // Get effective limits (custom if available, otherwise defaults)
    const customConfig = getCustomLimits(req.path, config.customLimits);
    const effectiveLimits = {
      maxParams: customConfig?.maxParams ?? config.maxParams,
      maxQueryLength: customConfig?.maxQueryLength ?? config.maxQueryLength,
      maxValueLength: customConfig?.maxValueLength ?? config.maxValueLength,
      maxKeyLength: customConfig?.maxKeyLength ?? config.maxKeyLength,
    };

    // Check query string length
    const queryString = req.originalUrl.split('?')[1] || '';
    if (queryString.length > effectiveLimits.maxQueryLength) {
      const reason = `Query string length (${queryString.length}) exceeds maximum (${effectiveLimits.maxQueryLength})`;
      if (config.onError) {
        config.onError(req, res, reason);
        return;
      }
      sendProblem(res, 400, 'Query string too long', {
        code: 'QUERY_STRING_TOO_LONG',
        instance: req.originalUrl,
        details: { limit: effectiveLimits.maxQueryLength },
      });
      return;
    }

    // Check number of parameters
    const queryKeys = Object.keys(req.query);
    if (queryKeys.length > effectiveLimits.maxParams) {
      const reason = `Query parameter count (${queryKeys.length}) exceeds maximum (${effectiveLimits.maxParams})`;
      if (config.onError) {
        config.onError(req, res, reason);
        return;
      }
      sendProblem(res, 400, 'Too many query parameters', {
        code: 'TOO_MANY_PARAMS',
        instance: req.originalUrl,
        details: { limit: effectiveLimits.maxParams },
      });
      return;
    }

    // Check individual key and value lengths
    for (const key of queryKeys) {
      if (key.length > effectiveLimits.maxKeyLength) {
        const reason = `Query parameter key length (${key.length}) exceeds maximum (${effectiveLimits.maxKeyLength})`;
        if (config.onError) {
          config.onError(req, res, reason);
          return;
        }
        sendProblem(res, 400, 'Query parameter key too long', {
          code: 'KEY_TOO_LONG',
          instance: req.originalUrl,
          details: {
            key: key.substring(0, 20) + '...',
            limit: effectiveLimits.maxKeyLength,
          },
        });
        return;
      }

      const value = req.query[key];
      const valueString = Array.isArray(value) ? value.join(',') : String(value ?? '');
      if (valueString.length > effectiveLimits.maxValueLength) {
        const reason = `Query parameter value length (${valueString.length}) exceeds maximum (${effectiveLimits.maxValueLength})`;
        if (config.onError) {
          config.onError(req, res, reason);
          return;
        }
        sendProblem(res, 400, `Query parameter '${key}' value too long`, {
          code: 'VALUE_TOO_LONG',
          instance: req.originalUrl,
          details: { key, limit: effectiveLimits.maxValueLength },
        });
        return;
      }
    }

    next();
  };
}

/**
 * Strict query limits middleware - more restrictive defaults
 */
export function strictQueryLimits(): RequestHandler {
  return queryLimits({
    maxParams: 10,
    maxQueryLength: 1024,
    maxValueLength: 256,
    maxKeyLength: 50,
  });
}

export default queryLimits;

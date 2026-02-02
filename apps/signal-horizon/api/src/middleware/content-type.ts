/**
 * Content-Type Validation Middleware (WS1-007)
 *
 * Validates Content-Type headers to prevent content type confusion attacks
 * and ensure proper request body parsing.
 *
 * OWASP Reference: A03:2021 - Injection
 * CWE-20: Improper Input Validation
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { sendProblem } from '../lib/problem-details.js';

export interface ContentTypeOptions {
  /**
   * Required Content-Type for POST/PUT/PATCH requests
   * @default 'application/json'
   */
  requiredType?: string;

  /**
   * Routes that allow multipart/form-data (file uploads)
   * Supports exact paths or regex patterns
   */
  uploadRoutes?: (string | RegExp)[];

  /**
   * Routes that allow application/x-www-form-urlencoded
   */
  formRoutes?: (string | RegExp)[];

  /**
   * Routes to skip validation entirely (e.g., health checks)
   */
  skipRoutes?: (string | RegExp)[];

  /**
   * HTTP methods that require Content-Type validation
   * @default ['POST', 'PUT', 'PATCH']
   */
  methodsToValidate?: string[];

  /**
   * Allow charset specification in Content-Type (e.g., application/json; charset=utf-8)
   * @default true
   */
  allowCharset?: boolean;

  /**
   * Custom error handler
   */
  onError?: (req: Request, res: Response, reason: string) => void;
}

const DEFAULT_OPTIONS: Required<Omit<ContentTypeOptions, 'onError'>> = {
  requiredType: 'application/json',
  uploadRoutes: [],
  formRoutes: [],
  skipRoutes: [],
  methodsToValidate: ['POST', 'PUT', 'PATCH'],
  allowCharset: true,
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
 * Extracts the media type from Content-Type header (strips charset and parameters)
 */
function extractMediaType(contentType: string | undefined): string | null {
  if (!contentType) return null;
  const mediaType = contentType.split(';')[0].trim().toLowerCase();
  return mediaType || null;
}

/**
 * Creates Content-Type validation middleware
 *
 * @example
 * ```typescript
 * app.use(contentTypeValidation({
 *   requiredType: 'application/json',
 *   uploadRoutes: ['/api/v1/sensors/upload', /^\/api\/v1\/fleet\/.*\/firmware$/],
 *   formRoutes: ['/api/v1/auth/login'],
 * }));
 * ```
 */
export function contentTypeValidation(options: ContentTypeOptions = {}): RequestHandler {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip validation for methods that don't have request bodies
    if (!config.methodsToValidate.includes(req.method.toUpperCase())) {
      next();
      return;
    }

    // Skip validation for excluded routes
    if (matchesRoute(req.path, config.skipRoutes)) {
      next();
      return;
    }

    const contentType = req.get('Content-Type');
    const mediaType = extractMediaType(contentType);

    // Handle missing Content-Type
    if (!mediaType) {
      const reason = 'Missing Content-Type header for request with body';
      if (config.onError) {
        config.onError(req, res, reason);
        return;
      }
      sendProblem(res, 415, reason, {
        code: 'MISSING_CONTENT_TYPE',
        instance: req.originalUrl,
        details: { expected: config.requiredType },
      });
      return;
    }

    // Allow multipart/form-data for upload routes
    if (matchesRoute(req.path, config.uploadRoutes)) {
      if (mediaType === 'multipart/form-data') {
        next();
        return;
      }
      if (mediaType === config.requiredType.toLowerCase()) {
        next();
        return;
      }
    }

    // Allow application/x-www-form-urlencoded for form routes
    if (matchesRoute(req.path, config.formRoutes)) {
      if (mediaType === 'application/x-www-form-urlencoded') {
        next();
        return;
      }
      if (mediaType === config.requiredType.toLowerCase()) {
        next();
        return;
      }
    }

    // Validate against required type
    if (mediaType !== config.requiredType.toLowerCase()) {
      const reason = `Invalid Content-Type: expected ${config.requiredType}, received ${mediaType}`;
      if (config.onError) {
        config.onError(req, res, reason);
        return;
      }
      sendProblem(res, 415, `Content-Type must be ${config.requiredType}`, {
        code: 'INVALID_CONTENT_TYPE',
        instance: req.originalUrl,
        details: {
          received: mediaType,
          expected: config.requiredType,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Strict JSON-only middleware - convenience wrapper
 */
export function jsonOnly(skipRoutes: (string | RegExp)[] = []): RequestHandler {
  return contentTypeValidation({
    requiredType: 'application/json',
    skipRoutes,
  });
}

export default contentTypeValidation;

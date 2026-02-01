/**
 * Request Validation Middleware
 * Zod-based validation for request params, query, and body
 *
 * Security: Uses sanitized error responses (WS5-004)
 * In production, only generic messages are returned to prevent schema disclosure.
 */

import { z } from 'zod';
import type { RequestHandler } from 'express';
import { createValidationMiddleware } from '../../lib/zod-sanitizer.js';

/**
 * Validate route parameters
 * Uses sanitized error responses - only generic messages in production
 */
export function validateParams<T extends z.ZodSchema>(schema: T): RequestHandler {
  return createValidationMiddleware(schema, 'params', {
    genericMessage: 'Invalid parameters',
  });
}

/**
 * Validate query parameters
 * Uses sanitized error responses - only generic messages in production
 */
export function validateQuery<T extends z.ZodSchema>(schema: T): RequestHandler {
  return createValidationMiddleware(schema, 'query', {
    genericMessage: 'Invalid query parameters',
  });
}

/**
 * Validate request body
 * Uses sanitized error responses - only generic messages in production
 */
export function validateBody<T extends z.ZodSchema>(schema: T): RequestHandler {
  return createValidationMiddleware(schema, 'body', {
    genericMessage: 'Invalid request body',
  });
}

// Common validation schemas
export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

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
const IdStringSchema = z.string().superRefine((val, ctx) => {
  // Prisma models mix UUIDs and CUIDs (`@default(uuid())` vs `@default(cuid())`).
  // Keep a single shared param schema that accepts either, with a stable message.
  const isUuid = z.string().uuid().safeParse(val).success;
  const isCuid = z.string().cuid().safeParse(val).success;
  if (!isUuid && !isCuid) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ID format' });
  }
});

export const IdParamSchema = z.object({
  id: IdStringSchema,
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

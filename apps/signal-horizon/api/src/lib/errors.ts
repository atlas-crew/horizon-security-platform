/**
 * Error handling utilities for sanitized error responses
 *
 * Security: Handles Prisma, Zod, and generic errors safely to prevent
 * database schema and internal structure disclosure (WS5-004, PEN-005).
 */
import type { Response } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Structured error response format
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Error codes for common scenarios
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

/**
 * PEN-005: Fail-safe development mode detection.
 * Only expose details when explicitly in development mode.
 */
function isDevelopmentMode(): boolean {
  const env = process.env.NODE_ENV?.toLowerCase();
  return env === 'development';
}

/**
 * Sanitize error for client response
 * Never exposes stack traces in production
 *
 * PEN-005: Uses fail-safe approach - if NODE_ENV is undefined
 * or misconfigured, defaults to production-safe behavior.
 */
export function sanitizeError(error: unknown): ErrorResponse {
  const isDevelopment = isDevelopmentMode();

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      details: isDevelopment ? error.flatten() : undefined,
    };
  }

  // Handle Prisma errors - never expose schema details or query structure
  // PEN-005: Prisma errors contain sensitive database schema information
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Map Prisma error codes to user-friendly messages
    const prismaErrorMap: Record<string, { code: string; message: string; status: number }> = {
      'P2002': { code: ErrorCodes.CONFLICT, message: 'Resource already exists', status: 409 },
      'P2025': { code: ErrorCodes.NOT_FOUND, message: 'Resource not found', status: 404 },
      'P2003': { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid reference', status: 400 },
      'P2014': { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid relationship', status: 400 },
    };

    const mapped = prismaErrorMap[error.code];
    if (mapped) {
      return {
        code: mapped.code,
        message: mapped.message,
        // Only include error code (not target/meta) in development
        details: isDevelopment ? { prismaCode: error.code } : undefined,
      };
    }

    // Unknown Prisma code - return generic database error
    return {
      code: ErrorCodes.DATABASE_ERROR,
      message: 'A database error occurred',
      details: isDevelopment ? { prismaCode: error.code } : undefined,
    };
  }

  // Handle Prisma validation errors (malformed queries)
  if (error instanceof Prisma.PrismaClientValidationError) {
    // Never expose the validation message as it contains schema info
    return {
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Invalid request',
    };
  }

  // Handle Prisma initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      code: ErrorCodes.DATABASE_ERROR,
      message: 'Database connection error',
    };
  }

  // Handle known error types
  if (error instanceof Error) {
    // In production, never expose internal error messages
    if (!isDevelopment) {
      return {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'An internal error occurred',
      };
    }

    // In development, include error details
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message,
      details: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  // Unknown error type
  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: isDevelopment ? String(error) : 'An internal error occurred',
  };
}

/**
 * Handle validation error from Zod
 * PEN-005: Uses fail-safe development mode detection.
 */
export function handleValidationError(res: Response, error: ZodError): Response {
  const isDevelopment = isDevelopmentMode();

  return res.status(400).json({
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Validation failed',
    details: isDevelopment ? error.flatten() : undefined,
  });
}

/**
 * Generic error handler for route handlers
 * Logs error and returns sanitized response
 */
export function handleRouteError(
  res: Response,
  error: unknown,
  logger: Logger,
  context?: Record<string, unknown>
): Response {
  // Log the full error with context
  logger.error({ error, ...context }, 'Route handler error');

  // Return sanitized error to client
  const sanitized = sanitizeError(error);

  // Determine status code
  let statusCode = 500;
  if (sanitized.code === ErrorCodes.VALIDATION_ERROR) {
    statusCode = 400;
  } else if (sanitized.code === ErrorCodes.UNAUTHORIZED) {
    statusCode = 401;
  } else if (sanitized.code === ErrorCodes.FORBIDDEN) {
    statusCode = 403;
  } else if (sanitized.code === ErrorCodes.NOT_FOUND) {
    statusCode = 404;
  } else if (sanitized.code === ErrorCodes.CONFLICT) {
    statusCode = 409;
  }

  return res.status(statusCode).json(sanitized);
}

/**
 * Async error wrapper for Express route handlers
 * Catches async errors and forwards to error handler
 */
export function asyncHandler(
  fn: (req: any, res: Response, next?: any) => Promise<any>
) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      handleRouteError(res, error, req.logger || console, {
        route: req.route?.path,
        method: req.method,
      });
    });
  };
}

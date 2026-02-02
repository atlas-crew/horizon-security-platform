/**
 * JSON Depth Limiting Middleware (WS4-003)
 *
 * Protects against deeply nested JSON payloads that could cause:
 * - Stack overflow during parsing/processing
 * - CPU exhaustion during recursive operations
 * - Memory exhaustion from deeply nested structures
 *
 * OWASP Reference: CWE-674 - Uncontrolled Recursion
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Default maximum nesting depth for JSON payloads.
 * 20 levels is sufficient for most legitimate use cases while
 * preventing malicious deeply nested payloads.
 */
const DEFAULT_MAX_DEPTH = 20;

/**
 * Circuit breaker depth - if we reach this during traversal,
 * we've definitely exceeded any reasonable limit.
 */
const CIRCUIT_BREAKER_DEPTH = 100;

/**
 * Calculate the maximum nesting depth of a value.
 *
 * Uses iterative approach with explicit stack to avoid
 * stack overflow on malicious payloads.
 *
 * @param value - The value to check
 * @returns The maximum nesting depth
 */
function getDepth(value: unknown): number {
  // Non-objects have depth 0
  if (typeof value !== 'object' || value === null) {
    return 0;
  }

  // Use iterative BFS with explicit stack to avoid call stack issues
  let maxDepth = 1;
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 1 }];

  while (stack.length > 0) {
    const item = stack.pop()!;

    // Circuit breaker - definitely too deep
    if (item.depth > CIRCUIT_BREAKER_DEPTH) {
      return CIRCUIT_BREAKER_DEPTH;
    }

    if (item.depth > maxDepth) {
      maxDepth = item.depth;
    }

    if (typeof item.value === 'object' && item.value !== null) {
      // Handle arrays
      if (Array.isArray(item.value)) {
        for (const element of item.value) {
          if (typeof element === 'object' && element !== null) {
            stack.push({ value: element, depth: item.depth + 1 });
          }
        }
      } else {
        // Handle objects
        for (const key of Object.keys(item.value)) {
          const child = (item.value as Record<string, unknown>)[key];
          if (typeof child === 'object' && child !== null) {
            stack.push({ value: child, depth: item.depth + 1 });
          }
        }
      }
    }
  }

  return maxDepth;
}

/**
 * Express middleware that limits JSON nesting depth.
 *
 * Should be applied after express.json() middleware.
 *
 * @param maxDepth - Maximum allowed nesting depth (default: 20)
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * app.use(express.json({ limit: '10mb' }));
 * app.use(jsonDepthLimit(20));
 * ```
 */
export function jsonDepthLimit(maxDepth: number = DEFAULT_MAX_DEPTH) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only check if there's a body to check
    if (!req.body || typeof req.body !== 'object') {
      next();
      return;
    }

    const depth = getDepth(req.body);

    if (depth > maxDepth) {
      res.status(400).json({
        error: 'Request payload too deeply nested',
        code: 'JSON_DEPTH_EXCEEDED',
        maxDepth,
      });
      return;
    }

    next();
  };
}

export default jsonDepthLimit;

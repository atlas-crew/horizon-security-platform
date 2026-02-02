/**
 * CSRF Protection Middleware
 *
 * Implements double-submit cookie pattern for CSRF protection on mutation endpoints.
 * While Bearer token authentication is inherently CSRF-resistant (browsers don't
 * auto-attach Authorization headers), this provides defense-in-depth for:
 * - Browser-based dashboard interactions that may use cookies
 * - Protection against token theft via XSS followed by CSRF
 * - Compliance with security audit requirements
 *
 * Usage:
 * 1. Apply csrfProtection() middleware to mutation routes
 * 2. Frontend sends X-CSRF-Token header with value from csrf-token cookie
 * 3. Middleware validates token matches between cookie and header
 *
 * @module middleware/csrf
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * CSRF configuration options
 */
export interface CsrfOptions {
  /** Cookie name for CSRF token (default: 'csrf-token') */
  cookieName?: string;
  /** Header name for CSRF token (default: 'X-CSRF-Token') */
  headerName?: string;
  /** Token length in bytes (default: 32) */
  tokenLength?: number;
  /** Cookie max age in milliseconds (default: 1 hour) */
  maxAge?: number;
  /** Whether cookie should be secure (HTTPS only) */
  secure?: boolean;
  /** SameSite cookie attribute */
  sameSite?: 'strict' | 'lax' | 'none';
  /** Routes to skip CSRF validation (regex or string) */
  skipRoutes?: (string | RegExp)[];
  /** HTTP methods to protect (default: POST, PUT, PATCH, DELETE) */
  protectedMethods?: string[];
}

const DEFAULT_OPTIONS: Required<CsrfOptions> = {
  cookieName: 'csrf-token',
  headerName: 'X-CSRF-Token',
  tokenLength: 32,
  maxAge: 60 * 60 * 1000, // 1 hour
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  skipRoutes: [],
  protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
};

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Timing-safe comparison of CSRF tokens
 */
function tokensMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Ensure same length for timing-safe comparison
  if (a.length !== b.length) {
    return false;
  }

  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Check if a route should skip CSRF validation
 */
function shouldSkipRoute(
  path: string,
  skipRoutes: (string | RegExp)[]
): boolean {
  return skipRoutes.some((pattern) => {
    if (typeof pattern === 'string') {
      return path.startsWith(pattern);
    }
    return pattern.test(path);
  });
}

/**
 * Create CSRF protection middleware
 *
 * @example
 * ```typescript
 * import { csrfProtection, csrfTokenHandler } from './middleware/csrf';
 *
 * // Apply to all mutation routes
 * router.use(csrfProtection());
 *
 * // Or apply selectively
 * router.post('/config', csrfProtection(), updateConfig);
 *
 * // Endpoint to get CSRF token
 * router.get('/csrf-token', csrfTokenHandler());
 * ```
 */
export function csrfProtection(options: CsrfOptions = {}): RequestHandler {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return function csrfMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Skip for non-protected methods (GET, HEAD, OPTIONS)
    if (!config.protectedMethods.includes(req.method)) {
      next();
      return;
    }

    // Skip for configured routes
    if (shouldSkipRoute(req.path, config.skipRoutes)) {
      next();
      return;
    }

    // Get token from cookie
    const cookieToken = req.cookies?.[config.cookieName];

    // Get token from header
    const headerToken = req.get(config.headerName);

    // Both must be present
    if (!cookieToken || !headerToken) {
      res.status(403).json({
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
        details: !cookieToken
          ? 'CSRF cookie not found'
          : 'X-CSRF-Token header not found',
      });
      return;
    }

    // Tokens must match (timing-safe comparison)
    if (!tokensMatch(cookieToken, headerToken)) {
      res.status(403).json({
        error: 'CSRF token invalid',
        code: 'CSRF_TOKEN_MISMATCH',
      });
      return;
    }

    next();
  };
}

/**
 * Create handler to issue CSRF tokens
 *
 * Sets a new CSRF token cookie and returns the token in the response.
 * Call this endpoint before making mutation requests.
 *
 * @example
 * ```typescript
 * router.get('/api/csrf-token', csrfTokenHandler());
 * ```
 */
export function csrfTokenHandler(options: CsrfOptions = {}): RequestHandler {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return function tokenHandler(
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    // Generate new token
    const token = generateCsrfToken(config.tokenLength);

    // Set cookie with token
    res.cookie(config.cookieName, token, {
      httpOnly: false, // Must be readable by JavaScript to send in header
      secure: config.secure,
      sameSite: config.sameSite,
      maxAge: config.maxAge,
      path: '/',
    });

    res.json({
      csrfToken: token,
      expiresIn: config.maxAge,
    });
  };
}

/**
 * Middleware to ensure CSRF token cookie exists
 *
 * Sets a CSRF token cookie if one doesn't exist, without requiring validation.
 * Use this on read-only routes to pre-populate the cookie for subsequent mutations.
 */
export function ensureCsrfToken(options: CsrfOptions = {}): RequestHandler {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return function ensureTokenMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Check if token already exists
    const existingToken = req.cookies?.[config.cookieName];

    if (!existingToken) {
      // Generate and set new token
      const token = generateCsrfToken(config.tokenLength);

      res.cookie(config.cookieName, token, {
        httpOnly: false,
        secure: config.secure,
        sameSite: config.sameSite,
        maxAge: config.maxAge,
        path: '/',
      });
    }

    next();
  };
}

/**
 * Extract CSRF token from request for logging/debugging
 */
export function getCsrfToken(
  req: Request,
  options: CsrfOptions = {}
): { cookie?: string; header?: string } {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return {
    cookie: req.cookies?.[config.cookieName],
    header: req.get(config.headerName),
  };
}

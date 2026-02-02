/**
 * API Authentication Middleware
 * Validates API keys and extracts tenant context
 *
 * Security: Includes rate limiting for failed auth attempts (ADMIN-01)
 */

import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  checkAuthLockout,
  recordFailedAuth,
  clearFailedAuth,
  getClientIpForAuth,
} from '../../middleware/rate-limiter.js';

export interface AuthContext {
  tenantId: string;
  apiKeyId: string;
  scopes: string[];
  isFleetAdmin: boolean;
  /** User ID if authenticated via user session (optional for API keys) */
  userId?: string;
  /** User display name (optional) */
  userName?: string;
}

// Extend Express Request with auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function createAuthMiddleware(prisma: PrismaClient) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const clientIp = getClientIpForAuth(req);

    // ADMIN-01: Check for auth lockout before processing
    const lockoutCheck = checkAuthLockout(clientIp);
    if (lockoutCheck.locked) {
      res.setHeader('Retry-After', lockoutCheck.retryAfterSeconds.toString());
      res.status(429).json({
        error: 'Too many authentication attempts',
        retryAfter: lockoutCheck.retryAfterSeconds,
      });
      return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      recordFailedAuth(clientIp);
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      recordFailedAuth(clientIp);
      res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <api-key>' });
      return;
    }

    try {
      // Hash the API key for lookup
      const keyHash = createHash('sha256').update(token).digest('hex');

      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { tenant: true },
      });

      if (!apiKeyRecord) {
        recordFailedAuth(clientIp);
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      if (apiKeyRecord.isRevoked) {
        recordFailedAuth(clientIp);
        res.status(401).json({ error: 'API key has been revoked' });
        return;
      }

      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        recordFailedAuth(clientIp);
        res.status(401).json({ error: 'API key has expired' });
        return;
      }

      // Successful authentication - clear any failed attempt tracking
      clearFailedAuth(clientIp);

      // Update last used timestamp (fire and forget)
      prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {
        // Ignore update errors - don't block the request
      });

      // Set auth context on request
      req.auth = {
        tenantId: apiKeyRecord.tenantId,
        apiKeyId: apiKeyRecord.id,
        scopes: apiKeyRecord.scopes,
        isFleetAdmin: apiKeyRecord.scopes.includes('fleet:admin'),
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  };
}

/**
 * Require specific scope(s) for a route
 */
export function requireScope(...requiredScopes: string[]) {
  return function scopeMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasScope = requiredScopes.some((scope) => req.auth!.scopes.includes(scope));

    if (!hasScope) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredScopes,
        granted: req.auth.scopes,
      });
      return;
    }

    next();
  };
}

/**
 * Role definitions with scope mappings (WS2-009)
 *
 * Role hierarchy: viewer < operator < admin
 * Each role includes all permissions of lower roles.
 */
export type Role = 'viewer' | 'operator' | 'admin';

const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

/**
 * Map scopes to effective role
 * Admin: fleet:admin or *:admin scope
 * Operator: fleet:write, config:write, command:execute
 * Viewer: any valid authentication (default)
 */
function deriveRole(scopes: string[]): Role {
  // Check for admin
  if (scopes.some((s) => s === 'fleet:admin' || s.endsWith(':admin'))) {
    return 'admin';
  }

  // Check for operator
  const operatorScopes = ['fleet:write', 'config:write', 'command:execute', 'rules:write'];
  if (scopes.some((s) => operatorScopes.includes(s))) {
    return 'operator';
  }

  // Default to viewer
  return 'viewer';
}

/**
 * Require a minimum role level for a route (WS2-009)
 *
 * Role hierarchy:
 * - viewer: Can read data
 * - operator: Can modify operational settings (config, commands)
 * - admin: Full access including security-sensitive operations
 *
 * @example
 * router.get('/sensors', requireRole('viewer'), listSensors);
 * router.post('/commands', requireRole('operator'), sendCommand);
 * router.delete('/templates/:id', requireRole('admin'), deleteTemplate);
 */
export function requireRole(minRole: Role) {
  return function roleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userRole = deriveRole(req.auth.scopes);
    const userLevel = ROLE_HIERARCHY[userRole];
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: `Requires ${minRole} role`,
        code: 'INSUFFICIENT_ROLE',
        currentRole: userRole,
        requiredRole: minRole,
      });
      return;
    }

    next();
  };
}

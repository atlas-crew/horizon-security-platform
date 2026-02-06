/**
 * Auth Management Routes (labs-wqy1)
 *
 * Administrative endpoints for token revocation and epoch management.
 * Separated from auth.ts to keep public auth routes (login/refresh) isolated
 * from admin-only management operations.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { config } from '../../config.js';
import { parseJwt } from '../../lib/jwt.js';
import { incrementEpochForTenant } from '../../lib/epoch.js';
import type { RedisKv } from '../../storage/redis/kv.js';

// =============================================================================
// Validation Schemas
// =============================================================================

const RevokeTokenSchema = z.object({
  jti: z.string().min(1),
  token: z.string().min(1).optional(),
  reason: z.string().optional(),
  expiresInSeconds: z.number().int().min(60).max(31536000).optional(),
}).superRefine((data, ctx) => {
  if (!data.token && !data.expiresInSeconds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either expiresInSeconds or token must be provided',
      path: ['expiresInSeconds'],
    });
  }
  if (data.token && data.expiresInSeconds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'token and expiresInSeconds are mutually exclusive',
      path: ['expiresInSeconds'],
    });
  }
});

// =============================================================================
// Route Factory
// =============================================================================

export function createAuthManagementRoutes(
  prisma: PrismaClient,
  logger: Logger,
  kv?: RedisKv | null
): Router {
  const router = Router();
  const log = logger.child({ module: 'auth-management' });

  /**
   * POST /revoke
   * Revoke a single token by JTI.
   * Requires admin role (enforced by caller mounting with appropriate middleware).
   */
  router.post('/revoke', async (req: Request, res: Response) => {
    const result = RevokeTokenSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.issues });
      return;
    }

    const { jti, reason, expiresInSeconds, token } = result.data;
    const auth = req.auth!;
    let expiresAt: Date;
    let targetTenantId: string;

    if (token) {
      const secret = config.telemetry.jwtSecret;
      if (!secret) {
        res.status(503).json({ error: 'jwt_secret_missing' });
        return;
      }

      const jwtPayload = parseJwt(token, secret);
      if (!jwtPayload || !jwtPayload.exp || !jwtPayload.jti) {
        res.status(400).json({ error: 'invalid_token' });
        return;
      }

      if (jwtPayload.jti !== jti) {
        res.status(400).json({ error: 'jti_mismatch' });
        return;
      }

      targetTenantId = (jwtPayload.tenantId ?? jwtPayload.tenant_id)!;

      if (targetTenantId !== auth.tenantId && !auth.isFleetAdmin) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      expiresAt = new Date(jwtPayload.exp * 1000);
    } else {
      targetTenantId = auth.tenantId;
      expiresAt = new Date(Date.now() + (expiresInSeconds ?? 0) * 1000);
    }

    try {
      await prisma.tokenBlacklist.create({
        data: {
          jti,
          tenantId: targetTenantId,
          reason,
          expiresAt,
        },
      });

      res.status(204).send();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(204).send();
        return;
      }
      log.error({ error }, 'Failed to revoke token');
      res.status(500).json({ error: 'Failed to revoke token' });
    }
  });

  /**
   * POST /revoke-all
   * Increment the tenant epoch to invalidate all previously issued tokens (labs-wqy1).
   * Requires admin role.
   */
  router.post('/revoke-all', async (req: Request, res: Response) => {
    const auth = req.auth!;

    if (!kv) {
      res.status(503).json({ error: 'Epoch store unavailable (Redis not configured)' });
      return;
    }

    try {
      const newEpoch = await incrementEpochForTenant(auth.tenantId, kv);
      log.info({ tenantId: auth.tenantId, epoch: newEpoch, userId: auth.userId }, 'All tokens revoked via epoch increment');
      res.json({ epoch: newEpoch });
    } catch (error) {
      log.error({ error, tenantId: auth.tenantId }, 'Failed to increment epoch');
      res.status(500).json({ error: 'Failed to revoke all tokens' });
    }
  });

  return router;
}

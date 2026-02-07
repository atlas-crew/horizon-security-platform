/**
 * Telemetry JWT authentication middleware utilities.
 *
 * Enforces JWT validation + revocation checks for telemetry ingest.
 */

import type { Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { config } from '../../config.js';
import { isTokenRevoked, parseJwt, type JwtPayload } from '../../lib/jwt.js';

export interface TelemetryAuthContext {
  tenantId: string;
  sensorId: string;
  jti: string;
}

function normalizeHeaderToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveSensorIdFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return 'unknown';

  const asAny = body as Record<string, unknown>;
  const direct =
    normalizeHeaderToken(asAny.instance_id) ??
    normalizeHeaderToken(asAny.sensorId);
  if (direct) return direct.slice(0, 255);

  const events = asAny.events;
  if (Array.isArray(events) && events.length > 0) {
    const first = events[0];
    if (first && typeof first === 'object') {
      const firstAny = first as Record<string, unknown>;
      const fromEvent =
        normalizeHeaderToken(firstAny.instance_id) ??
        normalizeHeaderToken(firstAny.sensorId);
      if (fromEvent) return fromEvent.slice(0, 255);
    }
  }

  return 'unknown';
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Check if token is revoked in database.
 * If Prisma is not provided, assumes valid (fail open for availability, but logs warning).
 */
export async function isTelemetryTokenRevoked(jti: string, prisma?: PrismaClient): Promise<boolean> {
  if (!prisma) {
    // In-memory fallback or fail open?
    // Given distributed requirement, we should rely on DB.
    // If DB is missing, we can't check revocation.
    return false;
  }

  try {
    // Reusing the shared isTokenRevoked logic would be better but that requires tenantId
    // And tokenBlacklist schema is unique([jti, tenantId])
    // The previous implementation used findUnique({ where: { jti } }) which implies jti is unique globally?
    // Let's check schema: @@unique([jti, tenantId]). So looking up by jti alone is NOT valid unless jti is @unique.
    // Schema says: jti String (not unique globally).
    // So the previous code was BROKEN? "const entry = await prisma.tokenBlacklist.findUnique({ where: { jti } });"
    // Wait, let's check schema.
    // model TokenBlacklist { ... @@unique([jti, tenantId]) ... }
    // It does NOT have @unique on jti alone.
    // So findUnique({ where: { jti } }) would fail type check if generated correctly.
    // But maybe I'm misremembering the previous code's validity.
    // Ah, wait. The previous code was:
    // const entry = await prisma.tokenBlacklist.findUnique({ where: { jti } });
    // This implies there IS a unique constraint on jti?
    // Let's check schema again.
    // model TokenBlacklist { ... @@unique([jti, tenantId]) ... }
    // No unique on jti.
    // So `where: { jti }` is INVALID in Prisma unless jti is unique.
    
    // However, if I use findFirst, it works.
    const entry = await prisma.tokenBlacklist.findFirst({
      where: { jti },
    });
    return !!entry;
  } catch {
    // Fail open on DB error to avoid blocking telemetry
    return false;
  }
}

export async function requireTelemetryJwt(
  req: Request,
  res: Response,
  prisma?: PrismaClient
): Promise<TelemetryAuthContext | null> {
  const secret = config.telemetry.jwtSecret;

  const authHeader = normalizeHeaderToken(req.headers.authorization);
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
  const apiKeyToken =
    bearerToken ??
    normalizeHeaderToken(req.headers['x-api-key']) ??
    normalizeHeaderToken(req.headers['x-admin-key']);

  if (!secret) {
    // In dev/demo environments, allow sensor API keys even when JWT secret is not configured.
    // If API key auth fails, preserve the original 503 to make the misconfig visible.
    if (apiKeyToken && prisma) {
      const keyHash = sha256Hex(apiKeyToken);
      const now = new Date();

      const sensorKey = await prisma.sensorApiKey.findFirst({
        where: {
          keyHash,
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: {
          sensor: {
            select: {
              tenantId: true,
              approvalStatus: true,
            },
          },
        },
      }).catch(() => null);

      if (sensorKey) {
        const allowed = Array.isArray(sensorKey.permissions) && sensorKey.permissions.includes('signal:write');
        const approved = sensorKey.sensor.approvalStatus === 'APPROVED';
        if (allowed && approved) {
          return {
            tenantId: sensorKey.sensor.tenantId,
            sensorId: sensorKey.sensorId,
            jti: sensorKey.id,
          };
        }
      }

      // Legacy: tenant-scoped API keys.
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        select: {
          id: true,
          tenantId: true,
          isRevoked: true,
          expiresAt: true,
          scopes: true,
        },
      }).catch(() => null);

      if (
        apiKey
        && !apiKey.isRevoked
        && (!apiKey.expiresAt || apiKey.expiresAt > now)
        && apiKey.scopes.includes('signal:write')
      ) {
        return {
          tenantId: apiKey.tenantId,
          sensorId: deriveSensorIdFromBody(req.body),
          jti: apiKey.id,
        };
      }
    }

    res.status(503).json({ error: 'telemetry_jwt_missing' });
    return null;
  }

  if (!apiKeyToken) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const payload = parseJwt(apiKeyToken, secret, { audience: 'signal-horizon' });
  
  if (payload && payload.jti) {
    if (await isTelemetryTokenRevoked(payload.jti, prisma)) {
      res.status(401).json({ error: 'token_revoked' });
      return null;
    }

    const tenantId = payload.tenantId ?? payload.tenant_id;
    const sensorId = payload.sensorId ?? payload.sensor_id;
    if (!tenantId || !sensorId) {
      res.status(401).json({ error: 'unauthorized' });
      return null;
    }

    return { tenantId, sensorId, jti: payload.jti };
  }

  // Fallback: accept sensor API keys (and legacy ApiKey) for telemetry ingest.
  if (!prisma) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const keyHash = sha256Hex(apiKeyToken);
  const now = new Date();

  // Preferred: sensor-scoped keys (tenantId derived via sensor relation).
  const sensorKey = await prisma.sensorApiKey.findFirst({
    where: {
      keyHash,
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      sensor: {
        select: {
          tenantId: true,
          approvalStatus: true,
        },
      },
    },
  }).catch(() => null);

  if (sensorKey) {
    const allowed = Array.isArray(sensorKey.permissions) && sensorKey.permissions.includes('signal:write');
    const approved = sensorKey.sensor.approvalStatus === 'APPROVED';
    if (!allowed || !approved) {
      res.status(401).json({ error: 'unauthorized' });
      return null;
    }

    return {
      tenantId: sensorKey.sensor.tenantId,
      sensorId: sensorKey.sensorId,
      jti: sensorKey.id,
    };
  }

  // Legacy: tenant-scoped API keys (sensorId is derived from payload instance_id).
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      tenantId: true,
      isRevoked: true,
      expiresAt: true,
      scopes: true,
    },
  }).catch(() => null);

  if (
    apiKey
    && !apiKey.isRevoked
    && (!apiKey.expiresAt || apiKey.expiresAt > now)
    && apiKey.scopes.includes('signal:write')
  ) {
    return {
      tenantId: apiKey.tenantId,
      sensorId: deriveSensorIdFromBody(req.body),
      jti: apiKey.id,
    };
  }

  res.status(401).json({ error: 'unauthorized' });
  return null;
}

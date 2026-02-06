import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import { createHmac, createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import request from '../../__tests__/test-request.js';
import { createAuthMiddleware } from './auth.js';
import { metrics } from '../../services/metrics.js';

const mockConfig = vi.hoisted(() => ({
  telemetry: { jwtSecret: 'test-secret' as string | undefined },
}));

vi.mock('../../config.js', () => ({
  config: mockConfig,
}));

const base64UrlEncode = (value: string | Buffer): string =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const createJwt = (overrides: Record<string, unknown> = {}): string => {
  const secret = mockConfig.telemetry.jwtSecret ?? 'test-secret';
  const now = Math.floor(Date.now() / 1000);
  const payloadData = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    scopes: ['fleet:read'],
    jti: 'jti-1',
    iat: now - 1,
    exp: now + 3600,
    ...overrides,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payloadData));
  const signature = base64UrlEncode(
    createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest()
  );

  return `${headerB64}.${payloadB64}.${signature}`;
};

describe('Auth middleware JWT', () => {
  let app: Express;
  let prisma: PrismaClient;

  beforeEach(() => {
    mockConfig.telemetry.jwtSecret = 'test-secret';

    prisma = {
      tokenBlacklist: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      apiKey: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;

    app = express();
    app.use(express.json());
    app.use(createAuthMiddleware(prisma));
    app.get('/secure', (req, res) => res.json({ auth: req.auth }));
  });

  it('rejects revoked jwt tokens', async () => {
    vi.mocked(prisma.tokenBlacklist.findUnique).mockResolvedValue({ jti: 'revoked-jti' } as never);

    const token = createJwt({ jti: 'revoked-jti' });

    const res = await request(app)
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(res.body).toMatchObject({ code: 'TOKEN_REVOKED' });
  });

  it('accepts valid jwt tokens and sets auth context', async () => {
    const token = createJwt({
      jti: 'valid-jti',
      scopes: ['fleet:admin', 'fleet:read'],
      userId: 'user-42',
    });

    const res = await request(app)
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.auth).toEqual({
      tenantId: 'tenant-1',
      authId: 'valid-jti',
      apiKeyId: 'valid-jti',
      scopes: ['fleet:admin', 'fleet:read'],
      isFleetAdmin: true,
      userId: 'user-42',
    });

    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it('rejects jwt tokens missing jti', async () => {
    const token = createJwt({ jti: undefined });

    const res = await request(app)
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(res.body).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('rejects jwt tokens missing tenantId', async () => {
    const token = createJwt({ tenantId: undefined, tenant_id: undefined });

    const res = await request(app)
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(res.body).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('fails open on blacklist DB errors and records metric', async () => {
    vi.mocked(prisma.tokenBlacklist.findUnique).mockRejectedValue(new Error('db down'));
    const incSpy = vi.spyOn(metrics.authBlacklistDbErrors, 'inc');

    const token = createJwt({ jti: 'valid-jti' });

    const res = await request(app)
      .get('/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.auth.tenantId).toBe('tenant-1');
    expect(incSpy).toHaveBeenCalledWith({ source: 'api' });
  });

  it('falls back to API key when JWT parse fails', async () => {
    const apiKey = 'not.a.jwt';
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    vi.mocked(prisma.apiKey.findUnique).mockImplementation(async ({ where }) => {
      if (where?.keyHash === keyHash) {
        return {
          id: 'api-key-1',
          tenantId: 'tenant-1',
          isRevoked: false,
          expiresAt: null,
          scopes: ['fleet:read'],
          tenant: { id: 'tenant-1' },
        } as never;
      }
      return null as never;
    });

    const res = await request(app)
      .get('/secure')
      .set('Authorization', `Bearer ${apiKey}`)
      .expect(200);

    expect(res.body.auth).toMatchObject({
      tenantId: 'tenant-1',
      apiKeyId: 'api-key-1',
      scopes: ['fleet:read'],
      isFleetAdmin: false,
    });
  });
});

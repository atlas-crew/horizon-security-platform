import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import { createHmac } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import request from '../../__tests__/test-request.js';
import { createAuthManagementRoutes } from './auth-management.js';

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
    scopes: ['fleet:admin'],
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

describe('Auth Management routes', () => {
  let app: Express;
  let prisma: PrismaClient;
  let logger: Logger;

  beforeEach(() => {
    mockConfig.telemetry.jwtSecret = 'test-secret';

    prisma = {
      tokenBlacklist: {
        create: vi.fn().mockResolvedValue({ jti: 'jti-1' }),
      },
    } as unknown as PrismaClient;

    logger = {
      info: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as unknown as Logger;

    app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      req.auth = {
        tenantId: 'tenant-1',
        apiKeyId: 'api-key-1',
        scopes: ['fleet:admin'],
        isFleetAdmin: true,
        userId: 'user-1',
      };
      next();
    });

    app.use('/auth', createAuthManagementRoutes(prisma, logger));
  });

  it('rejects revocation without expiry info', async () => {
    const res = await request(app)
      .post('/auth/revoke')
      .send({ jti: 'jti-1' })
      .expect(400);

    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects revocation with both token and expiresInSeconds', async () => {
    const token = createJwt({ jti: 'jti-1' });

    const res = await request(app)
      .post('/auth/revoke')
      .send({ jti: 'jti-1', token, expiresInSeconds: 3600 })
      .expect(400);

    expect(res.body.error).toBe('Validation failed');
  });

  it('uses token exp to set blacklist expiry', async () => {
    const exp = Math.floor(Date.now() / 1000) + 7200;
    const token = createJwt({ exp, jti: 'jti-42' });

    await request(app)
      .post('/auth/revoke')
      .send({ jti: 'jti-42', token, reason: 'manual revoke' })
      .expect(204);

    expect(prisma.tokenBlacklist.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jti: 'jti-42',
        reason: 'manual revoke',
        expiresAt: new Date(exp * 1000),
      }),
    });
  });

  it('rejects jti mismatch between token and payload', async () => {
    const token = createJwt({ jti: 'jti-42' });

    const res = await request(app)
      .post('/auth/revoke')
      .send({ jti: 'jti-43', token })
      .expect(400);

    expect(res.body.error).toBe('jti_mismatch');
  });

  it('rejects expired tokens', async () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const token = createJwt({ exp, jti: 'expired-jti' });

    const res = await request(app)
      .post('/auth/revoke')
      .send({ jti: 'expired-jti', token })
      .expect(400);

    expect(res.body.error).toBe('invalid_token');
  });

  it('returns 204 on duplicate revocation', async () => {
    vi.mocked(prisma.tokenBlacklist.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    await request(app)
      .post('/auth/revoke')
      .send({ jti: 'jti-dup', expiresInSeconds: 3600 })
      .expect(204);
  });
});

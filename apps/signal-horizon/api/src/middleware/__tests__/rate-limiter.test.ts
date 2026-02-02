/**
 * Rate Limiter Middleware Tests (PEN-003)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createRateLimiter } from '../rate-limiter.js';

interface MockResponse extends Partial<Response> {
  statusCode: number;
  body: unknown;
  headers: Record<string, string | number | string[]>;
  headersSent: boolean;
}

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/api/v1/test',
    headers: {},
    socket: { remoteAddress: '203.0.113.1' },
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

describe('createRateLimiter', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('allows requests within limit and sets headers', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });
    const req = createMockReq();

    const res1 = createMockRes();
    limiter(req, res1 as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res1.headers['X-RateLimit-Limit']).toBe(2);
    expect(res1.headers['X-RateLimit-Remaining']).toBe(1);

    const res2 = createMockRes();
    limiter(req, res2 as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res2.headers['X-RateLimit-Remaining']).toBe(0);
  });

  it('blocks when the limit is exceeded', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1000 });
    const req = createMockReq();

    const res1 = createMockRes();
    limiter(req, res1 as Response, next);

    const res2 = createMockRes();
    limiter(req, res2 as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res2.statusCode).toBe(429);
    expect(res2.body).toMatchObject({
      error: 'Rate limit exceeded',
      message: expect.any(String),
      retryAfter: expect.any(Number),
    });
    expect(res2.headers['Retry-After']).toBeDefined();
  });

  it('uses forwarded client IP when trust proxy matches', () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 1000,
      trustProxy: ['10.0.0.0/8'],
    });

    const reqA = createMockReq({
      headers: { 'x-forwarded-for': '198.51.100.10' },
      socket: { remoteAddress: '10.1.2.3' },
    });
    const resA = createMockRes();
    limiter(reqA, resA as Response, next);

    const reqB = createMockReq({
      headers: { 'x-forwarded-for': '198.51.100.11' },
      socket: { remoteAddress: '10.1.2.3' },
    });
    const resB = createMockRes();
    limiter(reqB, resB as Response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(resB.statusCode).toBe(200);
  });
});

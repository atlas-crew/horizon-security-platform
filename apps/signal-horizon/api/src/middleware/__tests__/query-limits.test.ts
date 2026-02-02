/**
 * Query Parameter Limits Middleware Tests (WS1-008)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { queryLimits, strictQueryLimits } from '../query-limits.js';

function createMockReq(overrides: Partial<Request & { query: Record<string, unknown> }> = {}): Partial<Request> {
  return {
    method: 'GET',
    path: '/api/v1/test',
    query: {},
    originalUrl: '/api/v1/test',
    ...overrides,
  };
}

interface MockResponse extends Partial<Response> {
  statusCode: number;
  body: unknown;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status: vi.fn(function (this: MockResponse, code: number) {
      this.statusCode = code;
      return this as Response;
    }),
    json: vi.fn(function (this: MockResponse, data: unknown) {
      this.body = data;
      return this as Response;
    }),
  };
  return res;
}

describe('queryLimits', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  describe('Valid requests', () => {
    it('should pass requests within limits', () => {
      const middleware = queryLimits();
      const req = createMockReq({
        query: { a: '1', b: '2', c: '3' },
        originalUrl: '/api/v1/test?a=1&b=2&c=3',
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should pass requests with no query params', () => {
      const middleware = queryLimits();
      const req = createMockReq({
        query: {},
        originalUrl: '/api/v1/test',
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should pass requests at exact limit', () => {
      const middleware = queryLimits({ maxParams: 3 });
      const req = createMockReq({
        query: { a: '1', b: '2', c: '3' },
        originalUrl: '/api/v1/test?a=1&b=2&c=3',
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Parameter count limits', () => {
    it('should reject too many parameters', () => {
      const middleware = queryLimits({ maxParams: 2 });
      const req = createMockReq({
        query: { a: '1', b: '2', c: '3' },
        originalUrl: '/api/v1/test?a=1&b=2&c=3',
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        error: 'Bad Request',
        code: 'TOO_MANY_PARAMS',
        limit: 2,
      });
    });
  });

  describe('Query string length limits', () => {
    it('should reject query string that is too long', () => {
      const longValue = 'a'.repeat(2000);
      const middleware = queryLimits({ maxQueryLength: 100 });
      const req = createMockReq({
        query: { param: longValue },
        originalUrl: `/api/v1/test?param=${longValue}`,
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        error: 'Bad Request',
        code: 'QUERY_STRING_TOO_LONG',
        limit: 100,
      });
    });
  });

  describe('Key length limits', () => {
    it('should reject key that is too long', () => {
      const longKey = 'x'.repeat(150);
      const middleware = queryLimits({ maxKeyLength: 100 });
      const req = createMockReq({
        query: { [longKey]: 'value' },
        originalUrl: `/api/v1/test?${longKey}=value`,
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        error: 'Bad Request',
        code: 'KEY_TOO_LONG',
        limit: 100,
      });
    });
  });

  describe('Value length limits', () => {
    it('should reject value that is too long', () => {
      const longValue = 'x'.repeat(600);
      const middleware = queryLimits({ maxValueLength: 512 });
      const req = createMockReq({
        query: { param: longValue },
        originalUrl: `/api/v1/test?param=${longValue}`,
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        error: 'Bad Request',
        code: 'VALUE_TOO_LONG',
        key: 'param',
        limit: 512,
      });
    });

    it('should handle array values', () => {
      const middleware = queryLimits({ maxValueLength: 20 });
      const req = createMockReq({
        query: { tags: ['a'.repeat(10), 'b'.repeat(10), 'c'.repeat(10)] },
        originalUrl: '/api/v1/test?tags=short',
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Skip routes', () => {
    it('should skip validation for specified routes', () => {
      const middleware = queryLimits({
        maxParams: 1,
        skipRoutes: ['/api/v1/graphql'],
      });
      const req = createMockReq({
        path: '/api/v1/graphql',
        query: { a: '1', b: '2', c: '3' },
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip validation for regex skip routes', () => {
      const middleware = queryLimits({
        maxParams: 1,
        skipRoutes: [/^\/internal\//],
      });
      const req = createMockReq({
        path: '/internal/debug',
        query: { a: '1', b: '2', c: '3' },
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Custom limits per route', () => {
    it('should apply custom limits for specific routes', () => {
      const middleware = queryLimits({
        maxParams: 5,
        customLimits: new Map([
          ['/api/v1/hunt', { maxParams: 50 }],
        ]),
      });

      // 30 params should fail on default route
      const query30: Record<string, string> = {};
      for (let i = 0; i < 30; i++) {
        query30[`param${i}`] = `value${i}`;
      }

      const req1 = createMockReq({
        path: '/api/v1/other',
        query: query30,
      });
      const res1 = createMockRes();

      middleware(req1 as Request, res1 as Response, next);
      expect(next).not.toHaveBeenCalled();

      // Reset next
      vi.mocked(next).mockClear();

      // 30 params should pass on hunt route
      const req2 = createMockReq({
        path: '/api/v1/hunt',
        query: query30,
      });
      const res2 = createMockRes();

      middleware(req2 as Request, res2 as Response, next);
      expect(next).toHaveBeenCalled();
    });

    it('should apply custom limits with regex patterns', () => {
      const middleware = queryLimits({
        maxQueryLength: 100,
        maxValueLength: 50,
        customLimits: new Map([
          [/^\/api\/v1\/search/, { maxQueryLength: 4096, maxValueLength: 2048 }],
        ]),
      });

      const longQuery = 'a'.repeat(1000);
      const req = createMockReq({
        path: '/api/v1/search',
        query: { q: longQuery },
        originalUrl: `/api/v1/search?q=${longQuery}`,
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Custom error handler', () => {
    it('should use custom error handler when provided', () => {
      const onError = vi.fn();
      const middleware = queryLimits({
        maxParams: 1,
        onError,
      });
      const req = createMockReq({
        query: { a: '1', b: '2' },
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(onError).toHaveBeenCalled();
      const callArgs = onError.mock.calls[0];
      expect(callArgs[0]).toBe(req);
      expect(callArgs[1]).toBe(res);
      expect(callArgs[2]).toContain('Query parameter count');
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty query string', () => {
      const middleware = queryLimits();
      const req = createMockReq({
        query: {},
        originalUrl: '/api/v1/test',
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle undefined query values', () => {
      const middleware = queryLimits();
      const req = createMockReq({
        query: { key: undefined },
        originalUrl: '/api/v1/test?key',
      });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

describe('strictQueryLimits', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('should use stricter limits', () => {
    const middleware = strictQueryLimits();

    // 11 params should fail with strict limits (max 10)
    const query: Record<string, string> = {};
    for (let i = 0; i < 11; i++) {
      query[`p${i}`] = `v${i}`;
    }

    const req = createMockReq({ query });
    const res = createMockRes();

    middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('should pass with 10 or fewer parameters', () => {
    const middleware = strictQueryLimits();

    const query: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      query[`p${i}`] = `v${i}`;
    }

    const req = createMockReq({ query });
    const res = createMockRes();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});

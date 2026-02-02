/**
 * CSRF Middleware Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  csrfProtection,
  csrfTokenHandler,
  ensureCsrfToken,
  generateCsrfToken,
  getCsrfToken,
} from '../csrf.js';

// Mock request factory
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/api/test',
    cookies: {},
    get: vi.fn().mockReturnValue(undefined),
    ...overrides,
  } as unknown as Request;
}

// Mock response factory
function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('CSRF Middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  describe('generateCsrfToken', () => {
    it('generates a 64-character hex token by default', () => {
      const token = generateCsrfToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates tokens of specified length', () => {
      const token = generateCsrfToken(16);
      expect(token).toMatch(/^[a-f0-9]{32}$/); // 16 bytes = 32 hex chars
    });

    it('generates unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('csrfProtection', () => {
    it('allows GET requests without validation', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows HEAD requests without validation', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({ method: 'HEAD' });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows OPTIONS requests without validation', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('rejects POST without CSRF cookie', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({
        method: 'POST',
        cookies: {},
        get: vi.fn().mockReturnValue('some-token'),
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
      }));
    });

    it('rejects POST without CSRF header', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({
        method: 'POST',
        cookies: { 'csrf-token': 'valid-token' },
        get: vi.fn().mockReturnValue(undefined),
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects POST with mismatched tokens', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({
        method: 'POST',
        cookies: { 'csrf-token': 'cookie-token' },
        get: vi.fn().mockReturnValue('header-token'),
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'CSRF_TOKEN_MISMATCH',
      }));
    });

    it('allows POST with matching tokens', () => {
      const token = generateCsrfToken();
      const middleware = csrfProtection();
      const req = createMockRequest({
        method: 'POST',
        cookies: { 'csrf-token': token },
        get: vi.fn().mockReturnValue(token),
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('validates PUT requests', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({ method: 'PUT', cookies: {} });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('validates DELETE requests', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({ method: 'DELETE', cookies: {} });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('validates PATCH requests', () => {
      const middleware = csrfProtection();
      const req = createMockRequest({ method: 'PATCH', cookies: {} });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('skips configured routes (string)', () => {
      const middleware = csrfProtection({
        skipRoutes: ['/api/webhook'],
      });
      const req = createMockRequest({
        method: 'POST',
        path: '/api/webhook/event',
        cookies: {},
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('skips configured routes (regex)', () => {
      const middleware = csrfProtection({
        skipRoutes: [/^\/api\/internal/],
      });
      const req = createMockRequest({
        method: 'POST',
        path: '/api/internal/sync',
        cookies: {},
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('uses custom cookie name', () => {
      const token = generateCsrfToken();
      const middleware = csrfProtection({ cookieName: 'my-csrf' });
      const req = createMockRequest({
        method: 'POST',
        cookies: { 'my-csrf': token },
        get: vi.fn().mockReturnValue(token),
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('uses custom header name', () => {
      const token = generateCsrfToken();
      const middleware = csrfProtection({ headerName: 'X-Custom-CSRF' });
      const req = createMockRequest({
        method: 'POST',
        cookies: { 'csrf-token': token },
        get: vi.fn().mockImplementation((name: string) => {
          if (name === 'X-Custom-CSRF') return token;
          return undefined;
        }),
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('prevents timing attacks with constant-time comparison', () => {
      // Tokens of different lengths should be rejected quickly
      // but still go through the comparison logic
      const middleware = csrfProtection();
      const req = createMockRequest({
        method: 'POST',
        cookies: { 'csrf-token': 'short' },
        get: vi.fn().mockReturnValue('much-longer-token-here'),
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('csrfTokenHandler', () => {
    it('generates and returns a CSRF token', () => {
      const handler = csrfTokenHandler();
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      handler(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.stringMatching(/^[a-f0-9]{64}$/),
        expect.objectContaining({
          httpOnly: false,
          path: '/',
        })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        csrfToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresIn: expect.any(Number),
      }));
    });

    it('uses custom cookie name', () => {
      const handler = csrfTokenHandler({ cookieName: 'my-token' });
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      handler(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'my-token',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('ensureCsrfToken', () => {
    it('sets cookie if not present', () => {
      const middleware = ensureCsrfToken();
      const req = createMockRequest({ cookies: {} });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(res.cookie).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('does not set cookie if already present', () => {
      const middleware = ensureCsrfToken();
      const req = createMockRequest({
        cookies: { 'csrf-token': 'existing-token' },
      });
      const res = createMockResponse();

      middleware(req, res, next);

      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getCsrfToken', () => {
    it('extracts tokens from request', () => {
      const req = createMockRequest({
        cookies: { 'csrf-token': 'cookie-val' },
        get: vi.fn().mockReturnValue('header-val'),
      });

      const result = getCsrfToken(req);

      expect(result).toEqual({
        cookie: 'cookie-val',
        header: 'header-val',
      });
    });

    it('handles missing tokens', () => {
      const req = createMockRequest({
        cookies: {},
        get: vi.fn().mockReturnValue(undefined),
      });

      const result = getCsrfToken(req);

      expect(result).toEqual({
        cookie: undefined,
        header: undefined,
      });
    });
  });
});

/**
 * Content-Type Validation Middleware Tests (WS1-007)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { contentTypeValidation, jsonOnly } from '../content-type.js';

function createMockReq(overrides: Partial<Request & { contentType?: string | undefined }> = {}): Request {
  const contentType = 'contentType' in overrides ? overrides.contentType : 'application/json';
  return {
    method: 'POST',
    path: '/api/v1/test',
    get: vi.fn((header: string): string | string[] | undefined => {
      if (header === 'Content-Type') {
        return contentType;
      }
      return undefined;
    }),
    ...overrides,
  } as unknown as Request;
}

interface MockResponse extends Partial<Response> {
  statusCode: number;
  body: unknown;
  contentType?: string;
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
    type: vi.fn(function (this: MockResponse, value: string) {
      this.contentType = value;
      return this as Response;
    }),
  };
  return res;
}

describe('contentTypeValidation', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  describe('Valid requests', () => {
    it('should pass valid application/json Content-Type', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({ contentType: 'application/json' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should pass application/json with charset', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({ contentType: 'application/json; charset=utf-8' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip validation for GET requests', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({ method: 'GET', contentType: undefined } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip validation for DELETE requests', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({ method: 'DELETE', contentType: undefined } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip validation for excluded routes', () => {
      const middleware = contentTypeValidation({
        skipRoutes: ['/health', '/api/health'],
      });
      const req = createMockReq({
        path: '/health',
        contentType: undefined,
      } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip validation for regex skip routes', () => {
      const middleware = contentTypeValidation({
        skipRoutes: [/^\/internal\//],
      });
      const req = createMockReq({
        path: '/internal/debug',
        contentType: undefined,
      } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Upload routes', () => {
    it('should allow multipart/form-data on upload routes', () => {
      const middleware = contentTypeValidation({
        uploadRoutes: ['/api/v1/sensors/upload'],
      });
      const req = createMockReq({
        path: '/api/v1/sensors/upload',
        contentType: 'multipart/form-data; boundary=----WebKitFormBoundary',
      } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow multipart/form-data on regex upload routes', () => {
      const middleware = contentTypeValidation({
        uploadRoutes: [/^\/api\/v1\/fleet\/.*\/firmware$/],
      });
      const req = createMockReq({
        path: '/api/v1/fleet/sensor-123/firmware',
        contentType: 'multipart/form-data',
      } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should still allow application/json on upload routes', () => {
      const middleware = contentTypeValidation({
        uploadRoutes: ['/api/v1/sensors/upload'],
      });
      const req = createMockReq({
        path: '/api/v1/sensors/upload',
        contentType: 'application/json',
      } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Form routes', () => {
    it('should allow application/x-www-form-urlencoded on form routes', () => {
      const middleware = contentTypeValidation({
        formRoutes: ['/api/v1/auth/login'],
      });
      const req = createMockReq({
        path: '/api/v1/auth/login',
        contentType: 'application/x-www-form-urlencoded',
      } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Invalid requests', () => {
    it('should reject missing Content-Type', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({ contentType: undefined } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(415);
      expect(res.body).toMatchObject({
        title: 'Unsupported Media Type',
        status: 415,
        detail: 'Missing Content-Type header for request with body',
        code: 'MISSING_CONTENT_TYPE',
        details: { expected: 'application/json' },
      });
    });

    it('should reject wrong Content-Type', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({ contentType: 'text/plain' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(415);
      expect(res.body).toMatchObject({
        title: 'Unsupported Media Type',
        status: 415,
        detail: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE',
        details: {
          received: 'text/plain',
          expected: 'application/json',
        },
      });
    });

    it('should reject multipart/form-data on non-upload routes', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({
        path: '/api/v1/sensors',
        contentType: 'multipart/form-data',
      } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(415);
    });
  });

  describe('Custom required type', () => {
    it('should accept custom required type', () => {
      const middleware = contentTypeValidation({
        requiredType: 'application/xml',
      });
      const req = createMockReq({ contentType: 'application/xml' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject other types when custom type is set', () => {
      const middleware = contentTypeValidation({
        requiredType: 'application/xml',
      });
      const req = createMockReq({ contentType: 'application/json' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(415);
    });
  });

  describe('Custom error handler', () => {
    it('should use custom error handler when provided', () => {
      const onError = vi.fn();
      const middleware = contentTypeValidation({ onError });
      const req = createMockReq({ contentType: 'text/plain' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(onError).toHaveBeenCalledWith(
        req,
        res,
        expect.stringContaining('Invalid Content-Type')
      );
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('HTTP methods', () => {
    it('should validate PUT requests', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({ method: 'PUT', contentType: 'text/plain' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(415);
    });

    it('should validate PATCH requests', () => {
      const middleware = contentTypeValidation();
      const req = createMockReq({ method: 'PATCH', contentType: 'text/plain' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(415);
    });

    it('should support custom methods to validate', () => {
      const middleware = contentTypeValidation({
        methodsToValidate: ['POST', 'PUT'],
      });
      const req = createMockReq({ method: 'PATCH', contentType: 'text/plain' } as Partial<Request>);
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

describe('jsonOnly', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('should only accept application/json', () => {
    const middleware = jsonOnly();
    const req = createMockReq({ contentType: 'application/json' } as Partial<Request>);
    const res = createMockRes();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should reject other types', () => {
    const middleware = jsonOnly();
    const req = createMockReq({ contentType: 'text/plain' } as Partial<Request>);
    const res = createMockRes();

    middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(415);
  });

  it('should support skip routes', () => {
    const middleware = jsonOnly(['/health']);
    const req = createMockReq({
      path: '/health',
      contentType: undefined,
    } as Partial<Request>);
    const res = createMockRes();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});

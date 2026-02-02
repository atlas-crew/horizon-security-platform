/**
 * Zod Error Sanitization Utilities Tests (WS5-004)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { Request, Response } from 'express';
import {
  sanitizeZodError,
  safeParse,
  createValidationMiddleware,
  createCombinedValidation,
} from '../zod-sanitizer.js';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().min(18),
});

function createZodError() {
  const result = UserSchema.safeParse({
    email: 'invalid',
    password: '123',
    age: 16,
  });
  if (!result.success) return result.error;
  throw new Error('Expected validation to fail');
}

describe('sanitizeZodError', () => {
  describe('production mode', () => {
    it('returns generic message', () => {
      const error = createZodError();
      const message = sanitizeZodError(error, { production: true });
      expect(message).toBe('Validation failed');
    });

    it('uses custom generic message', () => {
      const error = createZodError();
      const message = sanitizeZodError(error, {
        production: true,
        genericMessage: 'Invalid request',
      });
      expect(message).toBe('Invalid request');
    });

    it('does not expose field names', () => {
      const error = createZodError();
      const message = sanitizeZodError(error, { production: true });
      expect(message).not.toContain('email');
      expect(message).not.toContain('password');
      expect(message).not.toContain('age');
    });
  });

  describe('development mode', () => {
    it('returns detailed errors', () => {
      const error = createZodError();
      const message = sanitizeZodError(error, { production: false });
      expect(message).toContain('email');
    });

    it('includes all failing fields', () => {
      const error = createZodError();
      const message = sanitizeZodError(error, { production: false });
      expect(message).toContain('email');
      expect(message).toContain('password');
      expect(message).toContain('age');
    });
  });

  describe('environment detection', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('defaults to production behavior in production', () => {
      process.env.NODE_ENV = 'production';
      const error = createZodError();
      const message = sanitizeZodError(error);
      expect(message).toBe('Validation failed');
    });

    it('defaults to development behavior in development', () => {
      process.env.NODE_ENV = 'development';
      const error = createZodError();
      const message = sanitizeZodError(error);
      expect(message).toContain('email');
    });
  });
});

describe('safeParse', () => {
  it('returns success with parsed data', () => {
    const result = safeParse(UserSchema, {
      email: 'test@example.com',
      password: 'password123',
      age: 25,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('returns error on failure', () => {
    const result = safeParse(UserSchema, { invalid: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
    }
  });

  it('applies transformations', () => {
    const TransformSchema = z.object({
      value: z.string().transform((v) => v.toUpperCase()),
    });
    const result = safeParse(TransformSchema, { value: 'hello' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('HELLO');
    }
  });

  it('applies defaults', () => {
    const DefaultSchema = z.object({
      name: z.string(),
      role: z.string().default('user'),
    });
    const result = safeParse(DefaultSchema, { name: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('user');
    }
  });
});

describe('createValidationMiddleware', () => {
  function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      body: {},
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
      ...overrides,
    };
  }

  function createMockRes() {
    const res = {
      statusCode: 200,
      body: null as unknown,
      status: vi.fn(function (this: typeof res, code: number) {
        this.statusCode = code;
        return this;
      }),
      json: vi.fn(function (this: typeof res, data: unknown) {
        this.body = data;
        return this;
      }),
    };
    return res;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next on valid body', () => {
    const middleware = createValidationMiddleware(UserSchema, 'body');
    const req = createMockReq({
      body: { email: 'test@example.com', password: 'password123', age: 25 },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('replaces body with parsed data', () => {
    const CoerceSchema = z.object({ count: z.coerce.number() });
    const middleware = createValidationMiddleware(CoerceSchema, 'body');
    const req = createMockReq({ body: { count: '42' } });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(req.body).toEqual({ count: 42 });
  });

  it('returns 400 on validation failure', () => {
    const middleware = createValidationMiddleware(UserSchema, 'body', { production: false });
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('returns generic error in production', () => {
    const middleware = createValidationMiddleware(UserSchema, 'body', { production: true });
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(res.body).toEqual({ error: 'Validation failed' });
  });

  it('validates query parameters', () => {
    const QuerySchema = z.object({
      page: z.coerce.number().min(1).default(1),
    });
    const middleware = createValidationMiddleware(QuerySchema, 'query');
    const req = createMockReq({ query: { page: '2' } });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.query).toEqual({ page: 2 });
  });

  it('validates URL params', () => {
    const ParamsSchema = z.object({ id: z.string().uuid() });
    const middleware = createValidationMiddleware(ParamsSchema, 'params');
    const req = createMockReq({
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('uses custom status code', () => {
    const middleware = createValidationMiddleware(UserSchema, 'body', { statusCode: 422 });
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(res.statusCode).toBe(422);
  });
});

describe('createCombinedValidation', () => {
  const ParamsSchema = z.object({ id: z.string().uuid() });
  const BodySchema = z.object({ status: z.enum(['active', 'inactive']) });

  function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      body: {},
      query: {},
      params: {},
      path: '/test',
      method: 'PATCH',
      ...overrides,
    };
  }

  function createMockRes() {
    const res = {
      statusCode: 200,
      body: null as unknown,
      status: vi.fn(function (this: typeof res, code: number) {
        this.statusCode = code;
        return this;
      }),
      json: vi.fn(function (this: typeof res, data: unknown) {
        this.body = data;
        return this;
      }),
    };
    return res;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates all sources when valid', () => {
    const middleware = createCombinedValidation({ params: ParamsSchema, body: BodySchema });
    const req = createMockReq({
      params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      body: { status: 'active' },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('collects errors from multiple sources', () => {
    const middleware = createCombinedValidation(
      { params: ParamsSchema, body: BodySchema },
      { production: false }
    );
    const req = createMockReq({
      params: { id: 'invalid' },
      body: { status: 'unknown' },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    const response = res.body as { details?: Array<{ source: string }> };
    expect(response.details).toHaveLength(2);
  });

  it('returns generic error in production', () => {
    const middleware = createCombinedValidation(
      { params: ParamsSchema, body: BodySchema },
      { production: true }
    );
    const req = createMockReq({
      params: { id: 'invalid' },
      body: { status: 'unknown' },
    });
    const res = createMockRes();
    const next = vi.fn();

    middleware(req as Request, res as unknown as Response, next);

    expect(res.body).toEqual({ error: 'Validation failed' });
  });
});

describe('schema disclosure prevention', () => {
  it('does not expose schema structure in production', () => {
    const SensitiveSchema = z.object({
      apiKey: z.string().min(32),
      secretToken: z.string().regex(/^sk_[a-zA-Z0-9]+$/),
    });

    const result = SensitiveSchema.safeParse({});
    if (result.success) throw new Error('Expected failure');

    const message = sanitizeZodError(result.error, { production: true });

    expect(message).not.toContain('apiKey');
    expect(message).not.toContain('secretToken');
    expect(message).not.toContain('32');
    expect(message).not.toContain('sk_');
  });
});

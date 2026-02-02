/**
 * Request Timeout Middleware Tests (WS4-008)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestTimeout, TimeoutPresets } from '../timeout.js';

// Mock timers
vi.useFakeTimers();

function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    method: 'GET',
    path: '/api/v1/test',
    ...overrides,
  };
}

interface MockResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  listeners: Record<string, Array<() => void>>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

function createMockRes(): MockResponse & Response {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    headers: {},
    listeners: {},
    status: vi.fn(function (this: MockResponse, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: MockResponse, data: unknown) {
      this.body = data;
      return this;
    }),
    setHeader: vi.fn(function (this: MockResponse, name: string, value: string | number) {
      this.headers[name] = String(value);
      return this;
    }),
    on: vi.fn(function (this: MockResponse, event: string, handler: () => void) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(handler);
      return this;
    }),
  };
  return res as MockResponse & Response;
}

function emitEvent(res: MockResponse, event: string): void {
  const handlers = res.listeners[event] || [];
  handlers.forEach((handler) => handler());
}

describe('requestTimeout', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic timeout functionality', () => {
    it('should call next immediately for middleware chain', () => {
      const middleware = requestTimeout({ timeout: 1000 });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 408 when timeout expires', () => {
      const middleware = requestTimeout({ timeout: 1000 });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      // Advance time past timeout
      vi.advanceTimersByTime(1100);

      expect(res.status).toHaveBeenCalledWith(408);
      expect(res.body).toMatchObject({
        error: 'Request Timeout',
        code: 'REQUEST_TIMEOUT',
        timeout: 1000,
      });
    });

    it('should use default timeout of 30 seconds', () => {
      const middleware = requestTimeout();
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      // 29 seconds - should not timeout
      vi.advanceTimersByTime(29000);
      expect(res.status).not.toHaveBeenCalled();

      // 31 seconds - should timeout
      vi.advanceTimersByTime(2000);
      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should clear timeout when response finishes', () => {
      const middleware = requestTimeout({ timeout: 1000 });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      // Simulate response finish before timeout
      emitEvent(res, 'finish');

      // Advance time past timeout
      vi.advanceTimersByTime(2000);

      // Should not have sent timeout response
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should clear timeout when response closes', () => {
      const middleware = requestTimeout({ timeout: 1000 });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      // Simulate connection close
      emitEvent(res, 'close');

      // Advance time past timeout
      vi.advanceTimersByTime(2000);

      expect(res.status).not.toHaveBeenCalled();
    });

    it('should clear timeout on error', () => {
      const middleware = requestTimeout({ timeout: 1000 });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      // Simulate error
      emitEvent(res, 'error');

      // Advance time past timeout
      vi.advanceTimersByTime(2000);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Timeout header', () => {
    it('should set X-Request-Timeout header by default', () => {
      const middleware = requestTimeout({ timeout: 5000 });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Timeout', '5000');
    });

    it('should use custom header name', () => {
      const middleware = requestTimeout({
        timeout: 5000,
        headerName: 'X-Custom-Timeout',
      });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Custom-Timeout', '5000');
    });
  });

  describe('Skip routes', () => {
    it('should skip timeout for specified routes', () => {
      const middleware = requestTimeout({
        timeout: 100,
        skipRoutes: ['/api/v1/ws'],
      });
      const req = createMockReq({ path: '/api/v1/ws' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      // Advance time past timeout
      vi.advanceTimersByTime(200);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should skip timeout for regex skip routes', () => {
      const middleware = requestTimeout({
        timeout: 100,
        skipRoutes: [/^\/api\/v1\/stream/],
      });
      const req = createMockReq({ path: '/api/v1/stream/events' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      vi.advanceTimersByTime(200);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Custom timeouts per route', () => {
    it('should use custom timeout for specific routes', () => {
      const middleware = requestTimeout({
        timeout: 1000,
        customTimeouts: new Map([
          ['/api/v1/hunt', 60000],
        ]),
      });
      const req = createMockReq({ path: '/api/v1/hunt' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('60000');

      // 30 seconds should not timeout
      vi.advanceTimersByTime(30000);
      expect(res.status).not.toHaveBeenCalled();

      // 61 seconds should timeout
      vi.advanceTimersByTime(31000);
      expect(res.status).toHaveBeenCalledWith(408);
    });

    it('should use custom timeout for regex routes', () => {
      const middleware = requestTimeout({
        timeout: 1000,
        customTimeouts: new Map([
          [/^\/api\/v1\/reports/, 120000],
        ]),
      });
      const req = createMockReq({ path: '/api/v1/reports/export' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('120000');
    });

    it('should use default timeout for non-matching routes', () => {
      const middleware = requestTimeout({
        timeout: 5000,
        customTimeouts: new Map([
          ['/api/v1/hunt', 60000],
        ]),
      });
      const req = createMockReq({ path: '/api/v1/other' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('5000');
    });
  });

  describe('Custom timeout handler', () => {
    it('should use custom handler when provided', () => {
      const onTimeout = vi.fn();
      const middleware = requestTimeout({
        timeout: 100,
        onTimeout,
      });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      vi.advanceTimersByTime(200);

      expect(onTimeout).toHaveBeenCalledWith(req, res);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Request timeout info', () => {
    it('should attach timeout info to request', () => {
      const middleware = requestTimeout({ timeout: 5000 });
      const req = createMockReq() as Request & { timeoutInfo?: { timeout: number; startTime: number } };
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(req.timeoutInfo).toBeDefined();
      expect(req.timeoutInfo?.timeout).toBe(5000);
      expect(req.timeoutInfo?.startTime).toBeDefined();
    });
  });

  describe('Multiple timeout triggers', () => {
    it('should only send timeout response once', () => {
      const middleware = requestTimeout({ timeout: 100 });
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      // Trigger timeout
      vi.advanceTimersByTime(200);

      expect(res.status).toHaveBeenCalledTimes(1);

      // Try to trigger again (should not happen due to cleanup)
      vi.advanceTimersByTime(200);

      expect(res.status).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TimeoutPresets', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('standard', () => {
    it('should use 30 second timeout', () => {
      const middleware = TimeoutPresets.standard();
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('30000');
    });
  });

  describe('extended', () => {
    it('should use 60 second timeout', () => {
      const middleware = TimeoutPresets.extended();
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('60000');
    });
  });

  describe('health', () => {
    it('should use 5 second timeout', () => {
      const middleware = TimeoutPresets.health();
      const req = createMockReq();
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('5000');
    });
  });

  describe('signalHorizon', () => {
    it('should use 30 second default timeout', () => {
      const middleware = TimeoutPresets.signalHorizon();
      const req = createMockReq({ path: '/api/v1/sensors' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('30000');
    });

    it('should use 60 second timeout for hunt routes', () => {
      const middleware = TimeoutPresets.signalHorizon();
      const req = createMockReq({ path: '/api/v1/hunt' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('60000');
    });

    it('should use 120 second timeout for report routes', () => {
      const middleware = TimeoutPresets.signalHorizon();
      const req = createMockReq({ path: '/api/v1/reports/export' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('120000');
    });

    it('should use 180 second timeout for export routes', () => {
      const middleware = TimeoutPresets.signalHorizon();
      const req = createMockReq({ path: '/api/v1/export/csv' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('180000');
    });

    it('should skip timeout for WebSocket endpoints', () => {
      const middleware = TimeoutPresets.signalHorizon();
      const req = createMockReq({ path: '/api/v1/ws' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should skip timeout for health endpoints', () => {
      const middleware = TimeoutPresets.signalHorizon();
      const req = createMockReq({ path: '/health' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should use 60 second timeout for synapse evaluate', () => {
      const middleware = TimeoutPresets.signalHorizon();
      const req = createMockReq({ path: '/api/v1/synapse/evaluate' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('60000');
    });

    it('should use 120 second timeout for firmware updates', () => {
      const middleware = TimeoutPresets.signalHorizon();
      const req = createMockReq({ path: '/api/v1/fleet/sensor-123/firmware' });
      const res = createMockRes();

      middleware(req as Request, res as Response, next);

      expect(res.headers['X-Request-Timeout']).toBe('120000');
    });
  });
});

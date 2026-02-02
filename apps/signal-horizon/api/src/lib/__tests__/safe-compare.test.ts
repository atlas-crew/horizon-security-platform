/**
 * Timing-Safe Comparison Utilities Tests (WS5-003)
 */

import { describe, it, expect } from 'vitest';
import {
  safeCompare,
  safeBufferCompare,
  safeHexCompare,
  computeHmac,
  createHmacVerifier,
  generateSecureToken,
} from '../safe-compare.js';

describe('safeCompare', () => {
  it('returns true for equal strings', () => {
    expect(safeCompare('secret', 'secret')).toBe(true);
    expect(safeCompare('', '')).toBe(true);
    expect(safeCompare('a', 'a')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(safeCompare('secret', 'Secret')).toBe(false);
    expect(safeCompare('abc', 'abd')).toBe(false);
    expect(safeCompare('abc', 'abcd')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(safeCompare('short', 'longer')).toBe(false);
    expect(safeCompare('a', 'aa')).toBe(false);
  });

  it('handles unicode strings', () => {
    expect(safeCompare('héllo', 'héllo')).toBe(true);
    expect(safeCompare('héllo', 'hello')).toBe(false);
    expect(safeCompare('🔐', '🔐')).toBe(true);
  });

  it('returns false for non-string inputs', () => {
    expect(safeCompare(null as unknown as string, 'test')).toBe(false);
    expect(safeCompare('test', undefined as unknown as string)).toBe(false);
    expect(safeCompare(123 as unknown as string, '123')).toBe(false);
  });
});

describe('safeBufferCompare', () => {
  it('returns true for equal buffers', () => {
    const a = Buffer.from('secret');
    const b = Buffer.from('secret');
    expect(safeBufferCompare(a, b)).toBe(true);
  });

  it('returns false for different buffers', () => {
    const a = Buffer.from('secret');
    const b = Buffer.from('Secret');
    expect(safeBufferCompare(a, b)).toBe(false);
  });

  it('returns false for different length buffers', () => {
    const a = Buffer.from('short');
    const b = Buffer.from('longer');
    expect(safeBufferCompare(a, b)).toBe(false);
  });

  it('returns false for non-buffer inputs', () => {
    expect(safeBufferCompare('string' as unknown as Buffer, Buffer.from('test'))).toBe(false);
    expect(safeBufferCompare(Buffer.from('test'), null as unknown as Buffer)).toBe(false);
  });
});

describe('safeHexCompare', () => {
  it('returns true for equal hex strings', () => {
    expect(safeHexCompare('abc123', 'abc123')).toBe(true);
    expect(safeHexCompare('ABC123', 'abc123')).toBe(true); // case-insensitive
    expect(safeHexCompare('0xabc', '0xABC')).toBe(true);
  });

  it('returns false for different hex strings', () => {
    expect(safeHexCompare('abc123', 'abc124')).toBe(false);
  });

  it('handles 0x prefix', () => {
    expect(safeHexCompare('0xabc', 'abc')).toBe(true);
    expect(safeHexCompare('0xabc', '0xabc')).toBe(true);
  });

  it('returns false for invalid hex', () => {
    expect(safeHexCompare('xyz', 'abc')).toBe(false);
    expect(safeHexCompare('abc', 'ghijkl')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(safeHexCompare(null as unknown as string, 'abc')).toBe(false);
    expect(safeHexCompare('abc', 123 as unknown as string)).toBe(false);
  });
});

describe('computeHmac', () => {
  it('computes SHA-256 HMAC', () => {
    const hmac = computeHmac('sha256', 'secret', 'data');
    expect(hmac).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computes SHA-384 HMAC', () => {
    const hmac = computeHmac('sha384', 'secret', 'data');
    expect(hmac).toMatch(/^[a-f0-9]{96}$/);
  });

  it('computes SHA-512 HMAC', () => {
    const hmac = computeHmac('sha512', 'secret', 'data');
    expect(hmac).toMatch(/^[a-f0-9]{128}$/);
  });

  it('produces consistent output', () => {
    const hmac1 = computeHmac('sha256', 'secret', 'data');
    const hmac2 = computeHmac('sha256', 'secret', 'data');
    expect(hmac1).toBe(hmac2);
  });

  it('produces different output for different secrets', () => {
    const hmac1 = computeHmac('sha256', 'secret1', 'data');
    const hmac2 = computeHmac('sha256', 'secret2', 'data');
    expect(hmac1).not.toBe(hmac2);
  });
});

describe('createHmacVerifier', () => {
  const secret = 'webhook-secret';
  const verify = createHmacVerifier('sha256', secret);

  it('returns true for valid signature', () => {
    const data = '{"event":"test"}';
    const signature = computeHmac('sha256', secret, data);
    expect(verify(data, signature)).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const data = '{"event":"test"}';
    expect(verify(data, 'invalid')).toBe(false);
  });

  it('returns false for tampered data', () => {
    const originalData = '{"event":"test"}';
    const tamperedData = '{"event":"hacked"}';
    const signature = computeHmac('sha256', secret, originalData);
    expect(verify(tamperedData, signature)).toBe(false);
  });

  it('returns false for empty inputs', () => {
    expect(verify('', 'sig')).toBe(false);
    expect(verify('data', '')).toBe(false);
  });

  it('is case-insensitive for signatures', () => {
    const data = 'test';
    const signature = computeHmac('sha256', secret, data);
    expect(verify(data, signature.toUpperCase())).toBe(true);
  });
});

describe('generateSecureToken', () => {
  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()));
    expect(tokens.size).toBe(100);
  });

  it('generates URL-safe tokens (no +, /, =)', () => {
    const token = generateSecureToken();
    expect(token).not.toMatch(/[+/=]/);
  });

  it('respects byte length parameter', () => {
    const token16 = generateSecureToken(16);
    const token32 = generateSecureToken(32);
    const token64 = generateSecureToken(64);

    // base64url encoding: ~1.33 chars per byte
    expect(token16.length).toBeGreaterThan(20);
    expect(token32.length).toBeGreaterThan(40);
    expect(token64.length).toBeGreaterThan(80);
  });
});

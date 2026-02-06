import { describe, expect, it } from 'vitest';

import { TTL_SECONDS, applyTtlJitter } from './ttl.js';

describe('TTL_SECONDS', () => {
  it('matches agreed shape conventions', () => {
    expect(TTL_SECONDS.session).toBe(24 * 60 * 60);
    expect(TTL_SECONDS.cacheMin).toBe(5 * 60);
    expect(TTL_SECONDS.cacheMax).toBe(15 * 60);
    expect(TTL_SECONDS.lockMin).toBe(30);
    expect(TTL_SECONDS.lockMax).toBe(120);
  });
});

describe('applyTtlJitter', () => {
  it('returns ttl when jitterFraction is invalid', () => {
    expect(applyTtlJitter(100, { jitterFraction: -1 })).toBe(100);
    expect(applyTtlJitter(100, { jitterFraction: 1 })).toBe(100);
  });

  it('applies symmetric jitter', () => {
    // r=0 -> -span
    expect(applyTtlJitter(100, { jitterFraction: 0.1, random: () => 0 })).toBe(90);
    // r=0.5 -> ~0
    expect(applyTtlJitter(100, { jitterFraction: 0.1, random: () => 0.5 })).toBe(100);
    // r=1 -> +span (exclusive, but we accept 1 in tests)
    expect(applyTtlJitter(100, { jitterFraction: 0.1, random: () => 1 })).toBe(110);
  });
});


import { describe, it, expect } from 'vitest';
import { parseIntSafe, parseFloatSafe } from '../parseNumeric';

describe('parseIntSafe', () => {
  it('parses valid integers', () => {
    expect(parseIntSafe('42', 0)).toBe(42);
    expect(parseIntSafe('0', 100)).toBe(0); // 0 is valid, not fallback
    expect(parseIntSafe('-10', 0)).toBe(-10);
    expect(parseIntSafe('999', 0)).toBe(999);
  });

  it('returns fallback on empty string', () => {
    expect(parseIntSafe('', 100)).toBe(100);
    expect(parseIntSafe('   ', 50)).toBe(50);
  });

  it('returns fallback on invalid input', () => {
    expect(parseIntSafe('abc', 100)).toBe(100);
    expect(parseIntSafe('12.34', 100)).toBe(12); // parseInt truncates
    expect(parseIntSafe('NaN', 100)).toBe(100);
    expect(parseIntSafe('Infinity', 100)).toBe(100);
  });

  it('handles edge cases', () => {
    expect(parseIntSafe('0', 999)).toBe(0); // Critical: 0 should NOT use fallback
    expect(parseIntSafe('1e2', 0)).toBe(1); // parseInt stops at 'e'
  });
});

describe('parseFloatSafe', () => {
  it('parses valid floats', () => {
    expect(parseFloatSafe('3.14', 0)).toBe(3.14);
    expect(parseFloatSafe('0.0', 100)).toBe(0); // 0 is valid, not fallback
    expect(parseFloatSafe('-2.5', 0)).toBe(-2.5);
    expect(parseFloatSafe('1e2', 0)).toBe(100);
  });

  it('returns fallback on empty string', () => {
    expect(parseFloatSafe('', 1.5)).toBe(1.5);
  });

  it('returns fallback on invalid input', () => {
    expect(parseFloatSafe('abc', 1.5)).toBe(1.5);
    expect(parseFloatSafe('NaN', 1.5)).toBe(1.5);
  });

  it('handles edge cases', () => {
    expect(parseFloatSafe('0', 999)).toBe(0); // Critical: 0 should NOT use fallback
    expect(parseFloatSafe('Infinity', 0)).toBe(Infinity); // Infinity is valid for parseFloat
  });
});

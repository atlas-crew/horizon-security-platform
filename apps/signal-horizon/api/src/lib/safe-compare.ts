/**
 * Timing-Safe Comparison Utilities (WS5-003)
 *
 * Provides constant-time comparison functions to prevent timing side-channel attacks.
 *
 * OWASP Reference: CWE-208 - Observable Timing Discrepancy
 */

import { createHmac, timingSafeEqual, randomBytes, type BinaryLike } from 'crypto';

export type HmacAlgorithm = 'sha256' | 'sha384' | 'sha512';

/**
 * Timing-safe string comparison.
 * Returns true if strings are equal, false otherwise.
 * Comparison time is constant regardless of where strings differ.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  // If lengths differ, pad shorter buffer to match length
  // This ensures constant-time comparison even for different lengths
  if (bufA.length !== bufB.length) {
    const maxLen = Math.max(bufA.length, bufB.length);
    const paddedA = Buffer.alloc(maxLen, 0);
    const paddedB = Buffer.alloc(maxLen, 0);
    bufA.copy(paddedA);
    bufB.copy(paddedB);
    // Always return false for different lengths, but still do comparison
    timingSafeEqual(paddedA, paddedB);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

/**
 * Timing-safe buffer comparison.
 */
export function safeBufferCompare(a: Buffer, b: Buffer): boolean {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    return false;
  }

  if (a.length !== b.length) {
    const maxLen = Math.max(a.length, b.length);
    const paddedA = Buffer.alloc(maxLen, 0);
    const paddedB = Buffer.alloc(maxLen, 0);
    a.copy(paddedA);
    b.copy(paddedB);
    timingSafeEqual(paddedA, paddedB);
    return false;
  }

  return timingSafeEqual(a, b);
}

/**
 * Timing-safe hex string comparison (case-insensitive).
 */
export function safeHexCompare(hexA: string, hexB: string): boolean {
  if (typeof hexA !== 'string' || typeof hexB !== 'string') {
    return false;
  }

  const normalizedA = hexA.toLowerCase().replace(/^0x/, '');
  const normalizedB = hexB.toLowerCase().replace(/^0x/, '');

  // Validate hex format
  if (!/^[a-f0-9]*$/.test(normalizedA) || !/^[a-f0-9]*$/.test(normalizedB)) {
    return false;
  }

  return safeCompare(normalizedA, normalizedB);
}

/**
 * Compute HMAC signature for data.
 */
export function computeHmac(
  algorithm: HmacAlgorithm,
  secret: string,
  data: BinaryLike
): string {
  return createHmac(algorithm, secret).update(data).digest('hex');
}

/**
 * Create a reusable HMAC verifier function.
 * Useful for webhook signature validation.
 *
 * @example
 * ```typescript
 * const verifyGitHub = createHmacVerifier('sha256', process.env.GITHUB_SECRET);
 * const isValid = verifyGitHub(payload, signature);
 * ```
 */
export function createHmacVerifier(
  algorithm: HmacAlgorithm,
  secret: string
): (data: string, signature: string) => boolean {
  return (data: string, signature: string): boolean => {
    if (!data || !signature) {
      return false;
    }

    const computed = computeHmac(algorithm, secret, data);
    return safeHexCompare(computed, signature);
  };
}

/**
 * Generate a cryptographically secure random string.
 */
export function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export default {
  safeCompare,
  safeBufferCompare,
  safeHexCompare,
  computeHmac,
  createHmacVerifier,
  generateSecureToken,
};

/**
 * Encryption Utilities for Sensitive Configuration Data
 *
 * Uses AES-256-GCM for authenticated encryption.
 * Encryption key should be stored in environment variable.
 *
 * Security: WS3-004 - Encrypt sensitive configuration at rest
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment, deriving it with scrypt for added security.
 * Falls back to a warning if not configured (for development only).
 */
function getEncryptionKey(salt: Buffer): Buffer {
  const masterKey = process.env.CONFIG_ENCRYPTION_KEY;

  if (!masterKey) {
    // In production, this should fail hard
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CONFIG_ENCRYPTION_KEY environment variable is required in production');
    }
    // Development fallback - log warning
    console.warn(
      '[SECURITY WARNING] CONFIG_ENCRYPTION_KEY not set. Using insecure default. ' +
      'Set CONFIG_ENCRYPTION_KEY in production!'
    );
    return scryptSync('INSECURE_DEV_KEY_DO_NOT_USE_IN_PRODUCTION', salt, KEY_LENGTH);
  }

  // Derive key from master key using scrypt
  return scryptSync(masterKey, salt, KEY_LENGTH);
}

/**
 * Encrypt a string value using AES-256-GCM.
 *
 * Format: base64(salt || iv || authTag || ciphertext)
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in base64 format
 */
export function encryptConfig(plaintext: string): string {
  if (!plaintext) return '';

  const salt = randomBytes(SALT_LENGTH);
  const key = getEncryptionKey(salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a value encrypted with encryptConfig.
 *
 * @param ciphertext - The encrypted string in base64 format
 * @returns Decrypted string
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decryptConfig(ciphertext: string): string {
  if (!ciphertext) return '';

  const combined = Buffer.from(ciphertext, 'base64');

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = getEncryptionKey(salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt sensitive fields in a configuration object.
 * Fields to encrypt are identified by naming convention (ending in 'Secret', 'Key', 'Password', etc.)
 *
 * @param config - Configuration object with potentially sensitive fields
 * @returns New object with sensitive fields encrypted
 */
export function encryptSensitiveFields(config: Record<string, unknown>): Record<string, unknown> {
  const sensitivePatterns = [
    /secret$/i,
    /password$/i,
    /key$/i,
    /token$/i,
    /credential/i,
    /^hmac/i,
    /^tls/i,
    /^private/i,
  ];

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    // Check if this field should be encrypted
    const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key));

    if (isSensitive && typeof value === 'string') {
      // Encrypt string values of sensitive fields
      result[key] = { _encrypted: true, value: encryptConfig(value) };
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively process nested objects
      result[key] = encryptSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Decrypt sensitive fields in a configuration object.
 * Reverses encryptSensitiveFields.
 *
 * @param config - Configuration object with encrypted fields
 * @returns New object with sensitive fields decrypted
 */
export function decryptSensitiveFields(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    // Check if this is an encrypted field marker
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>)._encrypted === true
    ) {
      const encrypted = (value as Record<string, unknown>).value;
      if (typeof encrypted === 'string') {
        result[key] = decryptConfig(encrypted);
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively process nested objects
      result[key] = decryptSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Check if a configuration object has any encrypted fields.
 * Useful for migration detection.
 */
export function hasEncryptedFields(config: Record<string, unknown>): boolean {
  for (const value of Object.values(config)) {
    if (value === null || value === undefined) continue;

    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>)._encrypted === true
    ) {
      return true;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      if (hasEncryptedFields(value as Record<string, unknown>)) {
        return true;
      }
    }
  }

  return false;
}

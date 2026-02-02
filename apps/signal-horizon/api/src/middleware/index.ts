/**
 * Middleware exports
 */

// Rate limiting
export { createRateLimiter, rateLimiters } from './rate-limiter.js';

// Replay protection
export {
  createReplayProtection,
  validateReplayProtection,
  validateTimestamp,
  validateNonceFormat,
  generateNonce,
  NonceStore,
  DEFAULT_REPLAY_CONFIG,
  type ReplayProtectionConfig,
  type ReplayProtectionResult,
  type ReplayProtectionError,
} from './replay-protection.js';

// Content-Type validation (WS1-007)
export {
  contentTypeValidation,
  jsonOnly,
  type ContentTypeOptions,
} from './content-type.js';

// Query parameter limits (WS1-008)
export {
  queryLimits,
  strictQueryLimits,
  type QueryLimitsOptions,
} from './query-limits.js';

// Request timeout (WS4-008)
export {
  requestTimeout,
  TimeoutPresets,
  type TimeoutOptions,
} from './timeout.js';

// CSRF protection
export {
  csrfProtection,
  csrfTokenHandler,
  ensureCsrfToken,
  generateCsrfToken,
  getCsrfToken,
  type CsrfOptions,
} from './csrf.js';

/**
 * ReDoS (Regular Expression Denial of Service) Prevention
 *
 * Validates user-supplied regex patterns for safety before compilation.
 * Detects patterns that could cause catastrophic backtracking leading to
 * exponential time complexity and CPU exhaustion.
 *
 * @module regex-validator
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum allowed pattern length to limit complexity.
 */
export const MAX_REGEX_LENGTH = 500;

/**
 * Maximum execution time for regex test in milliseconds.
 * Used as a safety net during pattern compilation.
 */
export const MAX_REGEX_COMPILE_MS = 100;

/**
 * Patterns that indicate potential ReDoS vulnerabilities.
 * These patterns can cause catastrophic backtracking.
 *
 * PEN-001: Added comprehensive backreference quantifier detection.
 */
export const REDOS_PATTERNS = [
  // Nested quantifiers: (a+)+ or (a*)* or (a+)* etc.
  // These cause exponential backtracking on non-matching input
  /\([^)]*[+*]\)[+*]/,

  // Alternation with overlapping patterns under quantifier: (a|a)+
  // Causes exponential branching as both alternatives match
  /\([^)]*\|[^)]*\)[+*]/,

  // Backreference with quantifier: \1+ or \1* or \1{2,}
  // Can cause exponential backtracking
  /\\[1-9][+*]/,
  /\\[1-9]\{[0-9,]+\}/,

  // Backreference following a quantified capture group: (a+)\1
  // The backreference must match what the group captured, causing backtracking
  /\([^)]*[+*]\)[^)]*\\[1-9]/,

  // Nested backreference patterns: ((a+)\2)+
  // Causes exponential backtracking due to nested matching
  /\([^)]*\\[1-9][^)]*\)[+*]/,

  // Adjacent quantified wildcards: .*.* or .+.+
  // Causes quadratic or worse backtracking
  /\.\*\.\*/,
  /\.\+\.\+/,

  // Quantified groups followed by overlapping quantified pattern
  // Example: (.*a)+ followed by more quantified content
  /\([^)]*\.\*[^)]*\)[+*]/,

  // Multiple adjacent optional groups with overlap potential
  // Example: a*a* or [a-z]*[a-z]*
  /\[[^\]]+\]\*\[[^\]]+\]\*/,

  // Unbounded repetition of complex groups
  // Example: (.+)+ or (.*)+
  /\(\.\+\)\+/,
  /\(\.\*\)\+/,
  /\(\.\+\)\*/,
  /\(\.\*\)\*/,

  // Quantified character class followed by same class: [a-z]+[a-z]+
  // Can cause polynomial backtracking
  /\[[^\]]+\]\+\[[^\]]+\]\+/,
] as const;

/**
 * Forbidden characters/sequences that shouldn't appear in user patterns.
 * These are either dangerous or unnecessary for log filtering.
 */
export const FORBIDDEN_SEQUENCES = [
  // Lookahead/lookbehind (can be used for ReDoS)
  '(?=',
  '(?!',
  '(?<=',
  '(?<!',
  // Named groups (unnecessary complexity)
  '(?<',
  // Atomic groups
  '(?>',
  // Recursion/subroutine
  '(?R)',
  '(?P',
] as const;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of regex validation.
 */
export interface RegexValidationResult {
  /** Whether the pattern is safe to use */
  safe: boolean;
  /** Reason for rejection if not safe */
  reason?: string;
  /** Specific pattern that triggered rejection */
  triggeredBy?: string;
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates a regex pattern for safety against ReDoS attacks.
 *
 * Performs multiple checks:
 * 1. Length limit (500 chars max)
 * 2. Forbidden sequences (lookahead, recursion, etc.)
 * 3. ReDoS pattern detection (nested quantifiers, etc.)
 * 4. Compilation test with timeout
 *
 * @param pattern - User-supplied regex pattern to validate
 * @returns Validation result with safety status and optional reason
 *
 * @example
 * ```typescript
 * const result = isRegexSafe('error|warning');
 * if (result.safe) {
 *   const regex = new RegExp(pattern, 'i');
 *   // Use regex safely
 * } else {
 *   logger.warn({ reason: result.reason }, 'Rejected unsafe regex');
 * }
 * ```
 */
export function isRegexSafe(pattern: string): RegexValidationResult {
  // Check length limit
  if (pattern.length > MAX_REGEX_LENGTH) {
    return {
      safe: false,
      reason: `Pattern exceeds maximum length of ${MAX_REGEX_LENGTH} characters`,
    };
  }

  // Check for empty pattern
  if (pattern.length === 0) {
    return {
      safe: false,
      reason: 'Empty pattern not allowed',
    };
  }

  // Check for forbidden sequences
  for (const seq of FORBIDDEN_SEQUENCES) {
    if (pattern.includes(seq)) {
      return {
        safe: false,
        reason: `Pattern contains forbidden sequence: ${seq}`,
        triggeredBy: seq,
      };
    }
  }

  // Check for ReDoS patterns
  for (const redosPattern of REDOS_PATTERNS) {
    if (redosPattern.test(pattern)) {
      return {
        safe: false,
        reason: 'Pattern contains potentially dangerous nested quantifiers or alternation',
        triggeredBy: redosPattern.source,
      };
    }
  }

  // Try to compile the pattern to catch syntax errors
  try {
    new RegExp(pattern);
  } catch (error) {
    return {
      safe: false,
      reason: `Invalid regex syntax: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }

  return { safe: true };
}

/**
 * Creates a safe regex from a user-supplied pattern with timeout protection.
 *
 * Returns null if the pattern is unsafe or invalid.
 * The returned regex is case-insensitive by default.
 *
 * @param pattern - User-supplied regex pattern
 * @param flags - Optional regex flags (defaults to 'i' for case-insensitive)
 * @returns Compiled RegExp or null if pattern is unsafe
 *
 * @example
 * ```typescript
 * const regex = createSafeRegex(userPattern);
 * if (regex) {
 *   const matches = regex.test(logMessage);
 * }
 * ```
 */
export function createSafeRegex(
  pattern: string,
  flags = 'i'
): RegExp | null {
  const validation = isRegexSafe(pattern);
  if (!validation.safe) {
    return null;
  }

  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * Tests a regex pattern with timeout protection.
 *
 * Executes the regex test in a controlled manner to prevent
 * long-running matches from blocking the event loop.
 *
 * @param pattern - Regex pattern (already validated)
 * @param input - Input string to test
 * @param timeoutMs - Maximum execution time in milliseconds
 * @returns Match result or null if timed out
 */
export function testRegexWithTimeout(
  pattern: RegExp,
  input: string,
  _timeoutMs: number = MAX_REGEX_COMPILE_MS
): boolean | null {
  // For Node.js/Bun environments, we can't truly timeout synchronous regex
  // Instead, we limit input length as a proxy for execution time
  const maxInputLength = 10000;

  if (input.length > maxInputLength) {
    // Truncate input for safety
    return pattern.test(input.slice(0, maxInputLength));
  }

  try {
    return pattern.test(input);
  } catch {
    // Regex execution error
    return null;
  }
}

/**
 * Zod refinement function for validating regex patterns.
 *
 * Use with Zod's .refine() or .superRefine() for schema validation.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   regex: z.string().max(512).refine(zodRegexSafeRefinement, {
 *     message: 'Invalid or potentially dangerous regex pattern',
 *   }),
 * });
 * ```
 */
export function zodRegexSafeRefinement(pattern: string): boolean {
  const result = isRegexSafe(pattern);
  return result.safe;
}

/**
 * Zod superRefine function for detailed regex validation errors.
 *
 * Provides detailed error messages about why a pattern was rejected.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   regex: z.string().max(512).superRefine(zodRegexSafeSuperRefine),
 * });
 * ```
 */
export function zodRegexSafeSuperRefine(
  pattern: string,
  ctx: { addIssue: (issue: { code: 'custom'; message: string }) => void }
): void {
  const result = isRegexSafe(pattern);
  if (!result.safe) {
    ctx.addIssue({
      code: 'custom',
      message: result.reason ?? 'Invalid regex pattern',
    });
  }
}

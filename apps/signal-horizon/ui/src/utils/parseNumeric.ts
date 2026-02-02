/**
 * Numeric Parsing Utilities for Form Inputs
 *
 * These utilities preserve current values on parse failure rather than
 * silently defaulting to 0, which can disable features (e.g., delay=0).
 */

/**
 * Parses an integer from a string, returning the fallback on failure.
 *
 * Unlike `parseInt(value) || defaultValue`, this function:
 * - Returns the fallback when parsing fails (NaN)
 * - Correctly handles 0 as a valid parsed value
 *
 * @param value - The string to parse
 * @param fallback - The value to return if parsing fails (usually the current value)
 * @returns The parsed integer or the fallback
 *
 * @example
 * // When user clears the field, preserve the current value
 * parseIntSafe("", currentValue) // returns currentValue
 * parseIntSafe("abc", currentValue) // returns currentValue
 * parseIntSafe("42", currentValue) // returns 42
 * parseIntSafe("0", currentValue) // returns 0 (not fallback!)
 */
export function parseIntSafe(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Parses a float from a string, returning the fallback on failure.
 *
 * @param value - The string to parse
 * @param fallback - The value to return if parsing fails
 * @returns The parsed float or the fallback
 */
export function parseFloatSafe(value: string, fallback: number): number {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

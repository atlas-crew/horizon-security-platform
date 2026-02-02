/**
 * Deep merge utility for configuration objects.
 *
 * Recursively merges source objects into target, handling nested objects.
 * Arrays are replaced entirely (not merged by index) since configuration
 * arrays like rules should be treated as atomic values.
 */

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<U>
      : DeepPartial<T[P]>
    : T[P];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Deeply merges multiple source objects into a target object.
 * Creates a new object; does not mutate the inputs.
 *
 * Behavior:
 * - Primitive values: source overwrites target
 * - Arrays: source replaces target (not concatenated or merged by index)
 * - Objects: recursively merged
 * - null/undefined in source: overwrites target value
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<DeepPartial<T> | undefined | null>
): T {
  if (!sources.length) {
    return target;
  }

  const result = { ...target } as Record<string, unknown>;

  for (const source of sources) {
    if (source == null) {
      continue;
    }

    for (const key of Object.keys(source)) {
      const sourceValue = source[key as keyof typeof source];
      const targetValue = result[key];

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result as T;
}

/**
 * Type-safe deep merge for configuration objects.
 * Merges source into target, preserving nested properties from target
 * that don't exist in source.
 */
export function deepMergeConfig<T extends object, S extends object>(
  target: T,
  source: S | undefined | null
): T & S {
  if (source == null) {
    return target as T & S;
  }
  return deepMerge(
    target as unknown as Record<string, unknown>,
    source as unknown as Record<string, unknown>
  ) as T & S;
}

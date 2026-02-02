/**
 * Safe JSON stringify utility
 * Prevents OOM and CPU exhaustion by limiting depth, array length, and output size.
 * Handles circular references gracefully.
 */

export interface SafeStringifyOptions {
  maxDepth?: number;
  maxLength?: number;
  maxArrayLength?: number;
}

export function safeStringify(
  value: unknown,
  options: SafeStringifyOptions = {}
): string {
  const maxDepth = options.maxDepth ?? 5;
  const maxLength = options.maxLength ?? 10240; // 10KB
  const maxArrayLength = options.maxArrayLength ?? 50;

  if (value === undefined) return 'undefined'; // Technically JSON.stringify returns undefined, but we need a string
  if (value === null) return 'null';
  
  try {
    const seen = new WeakSet();
    const pruned = prune(value, maxDepth, maxArrayLength, seen);
    let result = JSON.stringify(pruned);
    
    // Check if result is undefined (e.g. if input was function or undefined)
    if (result === undefined) return 'undefined';

    if (result.length > maxLength) {
      result = result.slice(0, maxLength) + '...[Truncated]';
    }
    return result;
  } catch (err) {
    return `[Error serializing: ${err}]`;
  }
}

function prune(
  value: unknown, 
  depth: number, 
  maxArrayLength: number,
  seen: WeakSet<object>
): unknown {
  if (depth < 0) return '[Max Depth]';
  if (value === null || typeof value !== 'object') return value;
  
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  
  if (Array.isArray(value)) {
    if (value.length > maxArrayLength) {
      const truncated = value.slice(0, maxArrayLength).map(v => prune(v, depth - 1, maxArrayLength, seen));
      truncated.push(`... ${value.length - maxArrayLength} more items`);
      return truncated;
    }
    return value.map(v => prune(v, depth - 1, maxArrayLength, seen));
  }
  
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Error) return { message: value.message, stack: value.stack, name: value.name };
  
  const result: Record<string, unknown> = {};
  const keys = Object.keys(value);
  const maxKeys = maxArrayLength; // Re-use array limit for object keys
  
  let keyCount = 0;
  for (const key of keys) {
    if (keyCount >= maxKeys) {
      result['_truncated'] = `... ${keys.length - maxKeys} more keys`;
      break;
    }
    // Safe access
    const val = (value as Record<string, unknown>)[key];
    result[key] = prune(val, depth - 1, maxArrayLength, seen);
    keyCount++;
  }
  return result;
}

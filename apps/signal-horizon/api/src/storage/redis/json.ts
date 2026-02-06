export interface JsonDecodeOptions {
  /**
   * If set, reject payloads larger than this (bytes), to avoid accidental huge values.
   */
  maxBytes?: number;
}

export function jsonEncode(value: unknown): string {
  return JSON.stringify(value);
}

export function jsonDecode<T>(raw: string, options: JsonDecodeOptions = {}): T {
  const maxBytes = options.maxBytes;
  if (maxBytes && Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw new Error(`jsonDecode: payload exceeds maxBytes (${maxBytes})`);
  }
  return JSON.parse(raw) as T;
}

export function tryJsonDecode<T>(raw: string, options: JsonDecodeOptions = {}): T | null {
  try {
    return jsonDecode<T>(raw, options);
  } catch {
    return null;
  }
}


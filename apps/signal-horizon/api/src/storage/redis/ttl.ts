export interface TtlJitterOptions {
  /**
   * Fractional jitter in [0, 1). Default: 0.1 (10%).
   * Example: ttl=100, jitter=0.1 -> result in [90, 110].
   */
  jitterFraction?: number;
  /**
   * Injectable RNG for deterministic tests.
   */
  random?: () => number;
}

export const TTL_SECONDS = {
  session: 24 * 60 * 60,
  cacheMin: 5 * 60,
  cacheMax: 15 * 60,
  lockMin: 30,
  lockMax: 2 * 60,
} as const;

export function applyTtlJitter(ttlSeconds: number, options: TtlJitterOptions = {}): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return ttlSeconds;

  const jitterFraction = options.jitterFraction ?? 0.1;
  if (!Number.isFinite(jitterFraction) || jitterFraction < 0 || jitterFraction >= 1) return ttlSeconds;

  const rnd = options.random ?? Math.random;
  const r = rnd(); // expected [0, 1)
  const span = ttlSeconds * jitterFraction;

  // Map r in [0,1) to [-span, +span)
  const delta = (r * 2 - 1) * span;
  const jittered = Math.round(ttlSeconds + delta);

  return Math.max(1, jittered);
}

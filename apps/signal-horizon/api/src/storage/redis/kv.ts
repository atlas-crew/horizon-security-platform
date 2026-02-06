export interface RedisKvSetOptions {
  ttlSeconds?: number;
  /**
   * Only set if key does not already exist.
   */
  ifNotExists?: boolean;
}

/**
 * Minimal key/value surface used by state stores.
 *
 * Intentionally client-agnostic:
 * - `ioredis` uses SET key val EX <ttl> NX
 * - `redis` (node-redis) uses SET key val { EX, NX }
 */
export interface RedisKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: RedisKvSetOptions): Promise<boolean>;
  del(key: string): Promise<number>;
}

export interface IoredisLikeClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode?: 'EX',
    ttlSeconds?: number,
    flag?: 'NX'
  ): Promise<'OK' | null>;
  del(key: string): Promise<number>;
}

export function createIoredisKv(client: IoredisLikeClient): RedisKv {
  return {
    get: (key) => client.get(key),
    del: (key) => client.del(key),
    async set(key, value, options) {
      const ttlSeconds = options?.ttlSeconds;
      const ifNotExists = options?.ifNotExists ?? false;

      if (ttlSeconds && ifNotExists) return (await client.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
      if (ttlSeconds) return (await client.set(key, value, 'EX', ttlSeconds)) === 'OK';
      if (ifNotExists) return (await client.set(key, value, undefined, undefined, 'NX')) === 'OK';
      return (await client.set(key, value)) === 'OK';
    },
  };
}

export interface NodeRedisLikeClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { EX?: number; PX?: number; NX?: boolean; XX?: boolean }
  ): Promise<'OK' | null>;
  del(key: string): Promise<number>;
}

export function createNodeRedisKv(client: NodeRedisLikeClient): RedisKv {
  return {
    get: (key) => client.get(key),
    del: (key) => client.del(key),
    async set(key, value, options) {
      const redisOptions: { EX?: number; NX?: boolean } = {};
      if (options?.ttlSeconds) redisOptions.EX = options.ttlSeconds;
      if (options?.ifNotExists) redisOptions.NX = true;

      // If no options, node-redis accepts undefined.
      const result = await client.set(key, value, Object.keys(redisOptions).length ? redisOptions : undefined);
      return result === 'OK';
    },
  };
}


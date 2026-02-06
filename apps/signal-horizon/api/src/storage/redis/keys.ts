export type RedisKeyPart = string | number | boolean;

export interface RedisKeyInput {
  /**
   * Key schema (per decision):
   *   {namespace}:{version}:{tenant}:{datatype}:{id}
   *
   * Example:
   *   synapse:v1:tenant-abc:session:user-123
   *
   * Keep `namespace` stable; bump `version` when you change JSON schema/semantics.
   */
  namespace: string;
  /**
   * Store schema version (NOT app version).
   */
  version: number;
  /**
   * Tenant scope for multi-tenant isolation. Use a literal like "global" if needed.
   */
  tenantId: string;
  /**
   * Logical data type segment: "session", "cache", "rate", "lock", etc.
   */
  dataType: string;
  /**
   * Identifier segment(s).
   * For composite keys, supply multiple parts (they'll be joined with ':').
   */
  id: RedisKeyPart | RedisKeyPart[];
}

function encodeKeyPart(value: RedisKeyPart): string {
  // `encodeURIComponent` is stable ASCII and avoids accidental `:` collisions.
  return encodeURIComponent(String(value));
}

export function buildRedisKey(input: RedisKeyInput): string {
  if (!input.namespace) throw new Error('buildRedisKey: namespace is required');
  if (!Number.isFinite(input.version) || input.version <= 0) {
    throw new Error('buildRedisKey: version must be a positive number');
  }
  if (!input.tenantId) throw new Error('buildRedisKey: tenantId is required');
  if (!input.dataType) throw new Error('buildRedisKey: dataType is required');

  const segments: string[] = [
    encodeKeyPart(input.namespace),
    `v${input.version}`,
    encodeKeyPart(input.tenantId),
    encodeKeyPart(input.dataType),
  ];

  const idParts = Array.isArray(input.id) ? input.id : [input.id];
  for (const part of idParts) segments.push(encodeKeyPart(part));

  return segments.join(':');
}

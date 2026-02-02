/**
 * Sensor Schemas (OWASP API4)
 *
 * Zod schemas for sensor update endpoints.
 * Prevents mass assignment by explicitly defining allowed fields.
 *
 * OWASP Reference: API4:2023 - Unrestricted Resource Consumption
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Sensor Update Schema (Mass Assignment Prevention)
// -----------------------------------------------------------------------------

/**
 * Explicit allowlist of fields that can be updated via API
 * Uses .strict() to reject any additional properties
 */
export const SensorUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  location: z.string().max(255).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  enabled: z.boolean().optional(),
  config: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    heartbeatInterval: z.number().int().min(1000).max(300000).optional(),
    batchSize: z.number().int().min(1).max(1000).optional(),
  }).strict().optional(),
}).strict();

export type SensorUpdate = z.infer<typeof SensorUpdateSchema>;

// -----------------------------------------------------------------------------
// Sensor Configuration Schema
// -----------------------------------------------------------------------------

export const SensorConfigSchema = z.object({
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  heartbeatInterval: z.number().int().min(1000).max(300000).default(30000),
  batchSize: z.number().int().min(1).max(1000).default(100),
  enableMetrics: z.boolean().default(true),
  enableTrends: z.boolean().default(true),
  autoUpdate: z.boolean().default(false),
  rulesVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
}).strict();

export type SensorConfig = z.infer<typeof SensorConfigSchema>;

// -----------------------------------------------------------------------------
// Sensor Status Report Schema
// -----------------------------------------------------------------------------

export const SensorStatusReportSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']),
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  disk: z.number().min(0).max(100),
  requestsLastMinute: z.number().int().nonnegative(),
  avgLatencyMs: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1).optional(),
  uptime: z.number().int().nonnegative().optional(),
  version: z.string().max(50).optional(),
  configHash: z.string().max(64).optional(),
  rulesHash: z.string().max(64).optional(),
}).strict();

export type SensorStatusReport = z.infer<typeof SensorStatusReportSchema>;

// -----------------------------------------------------------------------------
// Sensor Registration Schema
// -----------------------------------------------------------------------------

export const SensorRegistrationSchema = z.object({
  name: z.string().min(1).max(255),
  hostname: z.string().min(1).max(253),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  capabilities: z.array(z.enum(['waf', 'metrics', 'trends', 'campaigns', 'tunnel'])).optional(),
  config: SensorConfigSchema.optional(),
}).strict();

export type SensorRegistration = z.infer<typeof SensorRegistrationSchema>;

// -----------------------------------------------------------------------------
// Sensor Query Schema (Pagination with Limits)
// -----------------------------------------------------------------------------

export const SensorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline', 'all']).default('all'),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['name', 'status', 'lastSeen', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  tags: z.string().max(500).optional(), // Comma-separated
}).strict();

export type SensorQuery = z.infer<typeof SensorQuerySchema>;

// -----------------------------------------------------------------------------
// Sensor Bulk Action Schema
// -----------------------------------------------------------------------------

export const SensorBulkActionSchema = z.object({
  sensorIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(['enable', 'disable', 'restart', 'updateConfig', 'delete']),
  config: SensorConfigSchema.partial().optional(),
}).strict().refine(
  (data) => data.action !== 'updateConfig' || data.config !== undefined,
  { message: 'Config is required for updateConfig action' }
);

export type SensorBulkAction = z.infer<typeof SensorBulkActionSchema>;

// -----------------------------------------------------------------------------
// Validation Helpers
// -----------------------------------------------------------------------------

export function validateSensorUpdate(data: unknown): { success: true; data: SensorUpdate } | { success: false; errors: string[] } {
  const result = SensorUpdateSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) };
}

export function validateSensorQuery(data: unknown): { success: true; data: SensorQuery } | { success: false; errors: string[] } {
  const result = SensorQuerySchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) };
}

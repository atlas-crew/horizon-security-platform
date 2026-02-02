/**
 * Hunt Response Schemas (OWASP API3)
 *
 * Schemas for hunt query responses with field filtering.
 * Prevents excessive data exposure by controlling returned fields.
 *
 * OWASP Reference: API3:2023 - Broken Object Property Level Authorization
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Field Control (Prevent Excessive Data Exposure)
// -----------------------------------------------------------------------------

/**
 * Fields that are allowed in hunt queries and responses
 */
export const HUNT_ALLOWED_FIELDS = [
  'id', 'timestamp', 'sourceIp', 'destinationIp', 'method', 'path', 'statusCode',
  'userAgent', 'signalType', 'severity', 'confidence', 'ruleId', 'ruleName',
  'sensorId', 'sensorName', 'country', 'city', 'asn', 'fingerprint', 'sessionId',
  'campaignId', 'attackType', 'blocked', 'responseTime', 'requestSize', 'responseSize',
] as const;

export type HuntAllowedField = typeof HUNT_ALLOWED_FIELDS[number];

/**
 * Fields that must NEVER be exposed in responses
 */
export const EXCLUDED_INTERNAL_FIELDS = [
  '_id', '__v', 'internalId', 'rawRequest', 'rawResponse', 'requestBody',
  'responseBody', 'apiKey', 'authToken', 'sessionSecret', 'passwordHash',
  'encryptionKey', 'privateKey', 'debugData', 'stackTrace', 'internalNotes',
] as const;

// -----------------------------------------------------------------------------
// Hunt Query Schema
// -----------------------------------------------------------------------------

export const HuntQuerySchema = z.object({
  // Query parameters
  query: z.string().min(1).max(5000),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),

  // Field selection (only allowed fields)
  fields: z.array(z.enum(HUNT_ALLOWED_FIELDS)).max(20).optional(),

  // Pagination with hard limits
  page: z.number().int().min(1).max(1000).default(1),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).max(10000).default(0),

  // Sorting
  sortBy: z.enum(HUNT_ALLOWED_FIELDS).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Filtering
  filters: z.object({
    sensorIds: z.array(z.string()).max(50).optional(),
    severities: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional(),
    signalTypes: z.array(z.string().max(50)).max(20).optional(),
    countries: z.array(z.string().length(2)).max(50).optional(),
    blocked: z.boolean().optional(),
  }).optional(),
}).strict();

export type HuntQuery = z.infer<typeof HuntQuerySchema>;

// -----------------------------------------------------------------------------
// Hunt Result Schema (Safe Field Selection)
// -----------------------------------------------------------------------------

export const HuntResultSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  sourceIp: z.string().optional(),
  destinationIp: z.string().optional(),
  method: z.string().optional(),
  path: z.string().max(2000).optional(),
  statusCode: z.number().int().optional(),
  userAgent: z.string().max(1000).optional(),
  signalType: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  ruleId: z.string().optional(),
  ruleName: z.string().optional(),
  sensorId: z.string().optional(),
  sensorName: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  fingerprint: z.string().optional(),
  blocked: z.boolean().optional(),
  responseTime: z.number().optional(),
});

export type HuntResult = z.infer<typeof HuntResultSchema>;

// -----------------------------------------------------------------------------
// Hunt Response Schema (Paginated)
// -----------------------------------------------------------------------------

export const HuntResponseSchema = z.object({
  results: z.array(HuntResultSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasMore: z.boolean(),
  }),
  query: z.object({
    executionTime: z.number(),
    scannedRows: z.number().optional(),
    truncated: z.boolean().optional(),
  }),
});

export type HuntResponse = z.infer<typeof HuntResponseSchema>;

// -----------------------------------------------------------------------------
// Hunt Export Schema
// -----------------------------------------------------------------------------

export const HuntExportSchema = z.object({
  format: z.enum(['csv', 'json', 'jsonl']).default('csv'),
  query: HuntQuerySchema,
  maxRows: z.number().int().min(1).max(100000).default(10000),
  includeHeaders: z.boolean().default(true),
  fields: z.array(z.enum(HUNT_ALLOWED_FIELDS)).max(30).optional(),
}).strict();

export type HuntExport = z.infer<typeof HuntExportSchema>;

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Strip internal fields from raw data before response
 */
export function stripInternalFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  const result = { ...data };
  for (const field of EXCLUDED_INTERNAL_FIELDS) {
    delete result[field];
  }
  return result;
}

/**
 * Filter object to only allowed fields
 */
export function filterToAllowedFields<T extends Record<string, unknown>>(
  data: T,
  allowedFields: readonly string[] = HUNT_ALLOWED_FIELDS
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of allowedFields) {
    if (field in data) {
      (result as Record<string, unknown>)[field] = data[field];
    }
  }
  return result;
}

/**
 * Validate and sanitize hunt query
 */
export function validateHuntQuery(data: unknown): { success: true; data: HuntQuery } | { success: false; errors: string[] } {
  const result = HuntQuerySchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) };
}

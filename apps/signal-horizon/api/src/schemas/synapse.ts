/**
 * Synapse External API Schemas (OWASP API10)
 *
 * Validates responses from external Synapse APIs.
 * Prevents unsafe consumption of untrusted external data.
 *
 * OWASP Reference: API10:2023 - Unsafe Consumption of APIs
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Safe URL Schema (SSRF Prevention)
// -----------------------------------------------------------------------------

const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  '169.254.169.254', // AWS metadata
  '100.100.100.200', // Alibaba metadata
  'metadata.google.internal', // GCP metadata
];

const PRIVATE_IP_RANGES = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^fc00:/i, /^fd00:/i, // IPv6 private
];

export const SafeUrlSchema = z.string()
  .url()
  .max(2000)
  .refine(url => {
    try {
      const parsed = new URL(url);
      // Require HTTPS in production
      if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
        return false;
      }
      // Block internal hosts
      if (BLOCKED_HOSTS.includes(parsed.hostname.toLowerCase())) {
        return false;
      }
      // Block private IPs
      for (const pattern of PRIVATE_IP_RANGES) {
        if (pattern.test(parsed.hostname)) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }, { message: 'URL must be a safe external HTTPS URL' });

// -----------------------------------------------------------------------------
// Sanitized String Schema (XSS Prevention)
// -----------------------------------------------------------------------------

export const SanitizedStringSchema = z.string()
  .max(10000)
  .transform(val => val
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
  );

// -----------------------------------------------------------------------------
// Synapse Rule Response Schema
// -----------------------------------------------------------------------------

export const SynapseRuleSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(255),
  description: z.string().max(2000).optional(),
  pattern: z.string().max(5000),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  enabled: z.boolean(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
}).strict();

export const SynapseRuleResponseSchema = z.object({
  rules: z.array(SynapseRuleSchema).max(10000),
  total: z.number().int().nonnegative(),
  version: z.string().optional(),
  lastUpdated: z.string().datetime().optional(),
});

export type SynapseRule = z.infer<typeof SynapseRuleSchema>;
export type SynapseRuleResponse = z.infer<typeof SynapseRuleResponseSchema>;

// -----------------------------------------------------------------------------
// Synapse Campaign Schema
// -----------------------------------------------------------------------------

export const SynapseCampaignSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(255),
  description: z.string().max(5000).optional(),
  status: z.enum(['active', 'inactive', 'monitoring', 'contained']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  indicators: z.array(z.object({
    type: z.enum(['ip', 'fingerprint', 'userAgent', 'path', 'header']),
    value: z.string().max(1000),
    confidence: z.number().min(0).max(1),
  })).max(1000).optional(),
  affectedSensors: z.array(z.string().max(100)).max(100).optional(),
  metrics: z.object({
    totalRequests: z.number().int().nonnegative(),
    blockedRequests: z.number().int().nonnegative(),
    uniqueIps: z.number().int().nonnegative(),
  }).optional(),
}).strict();

export type SynapseCampaign = z.infer<typeof SynapseCampaignSchema>;

// -----------------------------------------------------------------------------
// Synapse Actor Schema
// -----------------------------------------------------------------------------

export const SynapseActorSchema = z.object({
  id: z.string().max(100),
  type: z.enum(['ip', 'fingerprint', 'session', 'user']),
  identifier: z.string().max(500),
  firstSeen: z.string().datetime(),
  lastSeen: z.string().datetime(),
  riskScore: z.number().min(0).max(100),
  blocked: z.boolean(),
  signals: z.array(z.object({
    type: z.string().max(50),
    count: z.number().int().nonnegative(),
    lastSeen: z.string().datetime(),
  })).max(100).optional(),
  geo: z.object({
    country: z.string().length(2).optional(),
    city: z.string().max(100).optional(),
    asn: z.number().int().optional(),
    org: z.string().max(200).optional(),
  }).optional(),
}).strict();

export type SynapseActor = z.infer<typeof SynapseActorSchema>;

// -----------------------------------------------------------------------------
// Synapse Session Schema
// -----------------------------------------------------------------------------

export const SynapseSessionSchema = z.object({
  id: z.string().max(100),
  actorId: z.string().max(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  requestCount: z.number().int().nonnegative(),
  endpoints: z.array(z.string().max(500)).max(100).optional(),
  suspicious: z.boolean(),
  anomalies: z.array(z.string().max(100)).max(50).optional(),
}).strict();

export type SynapseSession = z.infer<typeof SynapseSessionSchema>;

// -----------------------------------------------------------------------------
// Validation Helpers
// -----------------------------------------------------------------------------

/**
 * Validate external API response with logging
 */
export function validateExternalResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  source: string
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
  console.warn(`[OWASP API10] Invalid response from ${source}:`, errors);

  return { success: false, errors };
}

/**
 * Fetch and validate external API response
 */
export async function fetchAndValidateExternal<T>(
  schema: z.ZodType<T>,
  url: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  // Validate URL first
  const urlResult = SafeUrlSchema.safeParse(url);
  if (!urlResult.success) {
    return { success: false, error: 'Invalid or unsafe URL' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    // Limit response size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      return { success: false, error: 'Response too large' };
    }

    const data = await response.json();
    const validated = validateExternalResponse(schema, data, url);

    if (validated.success) {
      return { success: true, data: validated.data };
    }

    return { success: false, error: validated.errors.join('; ') };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

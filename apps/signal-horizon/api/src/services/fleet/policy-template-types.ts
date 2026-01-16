/**
 * Policy Template Types
 * Types for global security policy management
 */

import { z } from 'zod';
import type { RolloutStrategy, RolloutConfig } from './types.js';

// =============================================================================
// Core Policy Types
// =============================================================================

/**
 * Security policy severity levels
 */
export type PolicySeverity = 'strict' | 'standard' | 'dev';

/**
 * Policy enforcement mode
 */
export type EnforcementMode = 'block' | 'log' | 'challenge';

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  requestsPerSecond: number;
  burstSize: number;
  windowSeconds: number;
}

/**
 * WAF protection settings
 */
export interface WAFProtectionSettings {
  sqlInjection: {
    enabled: boolean;
    mode: EnforcementMode;
    sensitivity: 'low' | 'medium' | 'high';
  };
  xss: {
    enabled: boolean;
    mode: EnforcementMode;
    sensitivity: 'low' | 'medium' | 'high';
  };
  commandInjection: {
    enabled: boolean;
    mode: EnforcementMode;
    sensitivity: 'low' | 'medium' | 'high';
  };
  pathTraversal: {
    enabled: boolean;
    mode: EnforcementMode;
    sensitivity: 'low' | 'medium' | 'high';
  };
  fileUpload: {
    enabled: boolean;
    mode: EnforcementMode;
    maxSizeBytes: number;
    allowedExtensions: string[];
  };
}

/**
 * Bot protection settings
 */
export interface BotProtectionSettings {
  enabled: boolean;
  mode: EnforcementMode;
  blockKnownBadBots: boolean;
  challengeSuspiciousBots: boolean;
  allowVerifiedBots: boolean;
  customBotRules: Array<{
    userAgentPattern: string;
    action: EnforcementMode;
  }>;
}

/**
 * Geo-blocking settings
 */
export interface GeoBlockingSettings {
  enabled: boolean;
  mode: 'allowlist' | 'blocklist';
  countries: string[];
}

/**
 * IP reputation settings
 */
export interface IPReputationSettings {
  enabled: boolean;
  blockThreshold: number; // 0-100, lower = more strict
  challengeThreshold: number;
}

/**
 * Complete policy configuration
 */
export interface PolicyConfig {
  /** Overall threat blocking threshold (0-100) */
  blockThreshold: number;
  /** Log all requests for analysis */
  logAllRequests: boolean;
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
  /** WAF protection settings */
  wafProtection: WAFProtectionSettings;
  /** Bot protection settings */
  botProtection: BotProtectionSettings;
  /** Geo-blocking settings */
  geoBlocking: GeoBlockingSettings;
  /** IP reputation settings */
  ipReputation: IPReputationSettings;
  /** Custom headers to inject */
  customHeaders: Record<string, string>;
  /** Request body size limit in bytes */
  maxBodySizeBytes: number;
  /** Request timeout in milliseconds */
  requestTimeoutMs: number;
  /** Enable detailed logging for debugging */
  debugMode: boolean;
}

/**
 * Policy template metadata
 */
export interface PolicyTemplateMetadata {
  /** Template category */
  category: 'default' | 'custom' | 'industry';
  /** Industry vertical (e.g., 'fintech', 'healthcare', 'ecommerce') */
  industry?: string;
  /** Compliance standards this template helps with */
  compliance?: string[];
  /** Template author */
  author?: string;
  /** Tags for searchability */
  tags?: string[];
}

/**
 * Security policy template
 */
export interface PolicyTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  severity: PolicySeverity;
  config: PolicyConfig;
  metadata: PolicyTemplateMetadata;
  isDefault: boolean;
  isActive: boolean;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Policy application request
 */
export interface PolicyApplicationRequest {
  templateId: string;
  sensorIds: string[];
  strategy: RolloutStrategy;
  rolloutConfig?: Partial<RolloutConfig>;
}

/**
 * Policy application result
 */
export interface PolicyApplicationResult {
  success: boolean;
  templateId: string;
  appliedTo: string[];
  failed: Array<{
    sensorId: string;
    error: string;
  }>;
  strategy: RolloutStrategy;
  deploymentId?: string;
  startedAt: Date;
  completedAt?: Date;
}

// =============================================================================
// Zod Validation Schemas
// =============================================================================

export const RateLimitConfigSchema = z.object({
  enabled: z.boolean(),
  requestsPerSecond: z.number().min(1).max(100000),
  burstSize: z.number().min(1).max(10000),
  windowSeconds: z.number().min(1).max(3600),
});

export const EnforcementModeSchema = z.enum(['block', 'log', 'challenge']);

export const ProtectionSettingSchema = z.object({
  enabled: z.boolean(),
  mode: EnforcementModeSchema,
  sensitivity: z.enum(['low', 'medium', 'high']),
});

export const FileUploadSettingSchema = z.object({
  enabled: z.boolean(),
  mode: EnforcementModeSchema,
  maxSizeBytes: z.number().min(0).max(1073741824), // Max 1GB
  allowedExtensions: z.array(z.string()),
});

export const WAFProtectionSettingsSchema = z.object({
  sqlInjection: ProtectionSettingSchema,
  xss: ProtectionSettingSchema,
  commandInjection: ProtectionSettingSchema,
  pathTraversal: ProtectionSettingSchema,
  fileUpload: FileUploadSettingSchema,
});

export const BotProtectionSettingsSchema = z.object({
  enabled: z.boolean(),
  mode: EnforcementModeSchema,
  blockKnownBadBots: z.boolean(),
  challengeSuspiciousBots: z.boolean(),
  allowVerifiedBots: z.boolean(),
  customBotRules: z.array(z.object({
    userAgentPattern: z.string(),
    action: EnforcementModeSchema,
  })),
});

export const GeoBlockingSettingsSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['allowlist', 'blocklist']),
  countries: z.array(z.string().length(2)),
});

export const IPReputationSettingsSchema = z.object({
  enabled: z.boolean(),
  blockThreshold: z.number().min(0).max(100),
  challengeThreshold: z.number().min(0).max(100),
});

export const PolicyConfigSchema = z.object({
  blockThreshold: z.number().min(0).max(100),
  logAllRequests: z.boolean(),
  rateLimit: RateLimitConfigSchema,
  wafProtection: WAFProtectionSettingsSchema,
  botProtection: BotProtectionSettingsSchema,
  geoBlocking: GeoBlockingSettingsSchema,
  ipReputation: IPReputationSettingsSchema,
  customHeaders: z.record(z.string()),
  maxBodySizeBytes: z.number().min(0).max(1073741824),
  requestTimeoutMs: z.number().min(1000).max(300000),
  debugMode: z.boolean(),
});

export const PolicyTemplateMetadataSchema = z.object({
  category: z.enum(['default', 'custom', 'industry']),
  industry: z.string().optional(),
  compliance: z.array(z.string()).optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const CreatePolicyTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  severity: z.enum(['strict', 'standard', 'dev']),
  config: PolicyConfigSchema,
  metadata: PolicyTemplateMetadataSchema.optional(),
});

export const UpdatePolicyTemplateSchema = CreatePolicyTemplateSchema.partial();

export const ApplyPolicyTemplateSchema = z.object({
  sensorIds: z.array(z.string()).min(1),
  strategy: z.enum(['immediate', 'canary', 'scheduled', 'rolling', 'blue_green']).default('immediate'),
  // Canary options
  canaryPercentage: z.number().min(1).max(100).optional(),
  // Scheduled options
  scheduledTime: z.string().datetime().optional(),
  // Rolling strategy options
  rollingBatchSize: z.number().min(1).max(100).optional(),
  healthCheckTimeout: z.number().min(5000).max(300000).optional(),
  maxFailuresBeforeAbort: z.number().min(1).max(100).optional(),
  rollbackOnFailure: z.boolean().optional(),
  healthCheckIntervalMs: z.number().min(1000).max(60000).optional(),
  // Blue/Green strategy options
  stagingTimeout: z.number().min(10000).max(600000).optional(),
  switchTimeout: z.number().min(5000).max(300000).optional(),
  requireAllSensorsStaged: z.boolean().optional(),
  minStagedPercentage: z.number().min(1).max(100).optional(),
  cleanupDelayMs: z.number().min(60000).max(3600000).optional(),
});

export type CreatePolicyTemplateInput = z.infer<typeof CreatePolicyTemplateSchema>;
export type UpdatePolicyTemplateInput = z.infer<typeof UpdatePolicyTemplateSchema>;
export type ApplyPolicyTemplateInput = z.infer<typeof ApplyPolicyTemplateSchema>;

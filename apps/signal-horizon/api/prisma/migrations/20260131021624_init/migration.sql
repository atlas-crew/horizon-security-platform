-- CreateEnum
CREATE TYPE "TenantTier" AS ENUM ('FREE', 'STANDARD', 'ENTERPRISE', 'PLATINUM');

-- CreateEnum
CREATE TYPE "SharingPreference" AS ENUM ('CONTRIBUTE_AND_RECEIVE', 'RECEIVE_ONLY', 'CONTRIBUTE_ONLY', 'ISOLATED');

-- CreateEnum
CREATE TYPE "ConnectionState" AS ENUM ('CONNECTED', 'DISCONNECTED', 'RECONNECTING');

-- CreateEnum
CREATE TYPE "RegistrationMethod" AS ENUM ('MANUAL', 'AGENT_SCRIPT', 'AUTO_DISCOVERY');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('IP_THREAT', 'FINGERPRINT_THREAT', 'CAMPAIGN_INDICATOR', 'CREDENTIAL_STUFFING', 'RATE_ANOMALY', 'BOT_SIGNATURE', 'IMPOSSIBLE_TRAVEL', 'TEMPLATE_DISCOVERY', 'SCHEMA_VIOLATION');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ThreatType" AS ENUM ('IP', 'FINGERPRINT', 'ASN', 'USER_AGENT', 'TLS_FINGERPRINT', 'CREDENTIAL_PATTERN');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('IP', 'IP_RANGE', 'FINGERPRINT', 'ASN', 'USER_AGENT');

-- CreateEnum
CREATE TYPE "BlockSource" AS ENUM ('AUTOMATIC', 'MANUAL', 'FLEET_INTEL', 'EXTERNAL_FEED', 'WAR_ROOM');

-- CreateEnum
CREATE TYPE "PropagationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'MONITORING', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "WarRoomStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActivityActorType" AS ENUM ('USER', 'HORIZON_BOT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityActionType" AS ENUM ('MESSAGE', 'BLOCK_CREATED', 'BLOCK_REMOVED', 'CAMPAIGN_LINKED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'ALERT_TRIGGERED');

-- CreateEnum
CREATE TYPE "ScheduledDeploymentStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "TenantTier" NOT NULL DEFAULT 'STANDARD',
    "sharingPreference" "SharingPreference" NOT NULL DEFAULT 'CONTRIBUTE_AND_RECEIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopes" TEXT[],
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "region" TEXT NOT NULL DEFAULT 'us-east-1',
    "version" TEXT NOT NULL,
    "connectionState" "ConnectionState" NOT NULL DEFAULT 'DISCONNECTED',
    "lastHeartbeat" TIMESTAMP(3),
    "lastSignalAt" TIMESTAMP(3),
    "signalsReported" INTEGER NOT NULL DEFAULT 0,
    "blocksApplied" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publicIp" TEXT,
    "privateIp" TEXT,
    "os" TEXT,
    "kernel" TEXT,
    "architecture" TEXT,
    "instanceType" TEXT,
    "lastBoot" TIMESTAMP(3),
    "uptime" INTEGER,
    "tunnelActive" BOOLEAN NOT NULL DEFAULT false,
    "tunnelSessionId" TEXT,
    "registrationMethod" "RegistrationMethod" NOT NULL DEFAULT 'MANUAL',
    "registrationToken" TEXT,
    "registrationTokenId" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "signalType" "SignalType" NOT NULL,
    "sourceIp" TEXT,
    "fingerprint" TEXT,
    "anonFingerprint" TEXT,
    "severity" "Severity" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "eventCount" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threats" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "threatType" "ThreatType" NOT NULL,
    "indicator" TEXT NOT NULL,
    "anonIndicator" TEXT,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "fleetRiskScore" DOUBLE PRECISION,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "tenantsAffected" INTEGER NOT NULL DEFAULT 1,
    "isFleetThreat" BOOLEAN NOT NULL DEFAULT false,
    "ttl" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threat_signals" (
    "id" TEXT NOT NULL,
    "threatId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "threat_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocklist_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "threatId" TEXT,
    "blockType" "BlockType" NOT NULL,
    "indicator" TEXT NOT NULL,
    "source" "BlockSource" NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "propagatedAt" TIMESTAMP(3),
    "propagationStatus" "PropagationStatus" NOT NULL DEFAULT 'PENDING',
    "sensorsNotified" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "severity" "Severity" NOT NULL,
    "isCrossTenant" BOOLEAN NOT NULL DEFAULT false,
    "tenantsAffected" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL,
    "correlationSignals" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_threats" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "threatId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_threats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "war_rooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WarRoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "leaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "war_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "war_room_activities" (
    "id" TEXT NOT NULL,
    "warRoomId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorType" "ActivityActorType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actionType" "ActivityActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "war_room_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "war_room_campaigns" (
    "id" TEXT NOT NULL,
    "warRoomId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedBy" TEXT,

    CONSTRAINT "war_room_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL,
    "triggerValue" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_runs" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "warRoomId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "stepResults" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "startedBy" TEXT,

    CONSTRAINT "playbook_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "result" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "config" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'standard',
    "config" JSONB NOT NULL,
    "metadata" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_sync_state" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "expectedConfigHash" TEXT NOT NULL,
    "expectedRulesHash" TEXT NOT NULL,
    "expectedBlocklistHash" TEXT NOT NULL,
    "actualConfigHash" TEXT,
    "actualRulesHash" TEXT,
    "actualBlocklistHash" TEXT,
    "lastSyncAttempt" TIMESTAMP(3),
    "lastSyncSuccess" TIMESTAMP(3),
    "syncErrors" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensor_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_commands" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "timeoutAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_sync_state" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "syncedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_deployments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sensorIds" TEXT[],
    "rules" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledDeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "error" TEXT,
    "resultSuccess" BOOLEAN,
    "resultTotalTargets" INTEGER,
    "resultSuccessCount" INTEGER,
    "resultFailureCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "status" "KeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[],
    "createdBy" TEXT,

    CONSTRAINT "sensor_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_bundles" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "includes" TEXT[],
    "downloadUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "diagnostic_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_updates" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "fromVersion" TEXT NOT NULL,
    "toVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rollbackAvailable" BOOLEAN NOT NULL DEFAULT true,
    "logs" TEXT,

    CONSTRAINT "sensor_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sensorId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "fleet_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_tokens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "name" TEXT,
    "region" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "metadata" JSONB,

    CONSTRAINT "registration_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beam_endpoints" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pathTemplate" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'default',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "hasSchema" BOOLEAN NOT NULL DEFAULT false,
    "schemaVersion" TEXT,
    "schemaHash" TEXT,
    "requestSchema" JSONB,
    "responseSchema" JSONB,
    "avgLatencyMs" DOUBLE PRECISION,
    "p95LatencyMs" DOUBLE PRECISION,
    "p99LatencyMs" DOUBLE PRECISION,
    "errorRate" DOUBLE PRECISION,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "authRequired" BOOLEAN NOT NULL DEFAULT false,
    "sensitiveData" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "beam_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beam_schema_changes" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "previousHash" TEXT,
    "currentHash" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beam_schema_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beam_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "action" TEXT NOT NULL DEFAULT 'block',
    "patterns" JSONB NOT NULL,
    "exclusions" JSONB,
    "sensitivity" INTEGER NOT NULL DEFAULT 50,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rolloutStrategy" TEXT NOT NULL DEFAULT 'immediate',
    "rolloutConfig" JSONB,
    "totalSensors" INTEGER NOT NULL DEFAULT 0,
    "deployedSensors" INTEGER NOT NULL DEFAULT 0,
    "failedSensors" INTEGER NOT NULL DEFAULT 0,
    "triggers24h" INTEGER NOT NULL DEFAULT 0,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deployedAt" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "beam_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beam_rule_deployments" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "beam_rule_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beam_rule_endpoint_bindings" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bindingType" TEXT NOT NULL DEFAULT 'include',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beam_rule_endpoint_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beam_block_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "ruleId" TEXT,
    "ruleName" TEXT,
    "reason" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "requestMethod" TEXT NOT NULL,
    "requestPath" TEXT NOT NULL,
    "requestHeaders" JSONB,
    "entityState" JSONB NOT NULL,
    "matchedRules" JSONB NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beam_block_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT NOT NULL,
    "binaryUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rollouts" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "targetTags" TEXT[],
    "batchSize" INTEGER NOT NULL DEFAULT 10,
    "batchDelay" INTEGER NOT NULL DEFAULT 60,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "rollouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rollout_progress" (
    "id" TEXT NOT NULL,
    "rolloutId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rollout_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_tenantId_idx" ON "api_keys"("tenantId");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "sensors_tenantId_idx" ON "sensors"("tenantId");

-- CreateIndex
CREATE INDEX "sensors_connectionState_idx" ON "sensors"("connectionState");

-- CreateIndex
CREATE UNIQUE INDEX "sensors_tenantId_name_key" ON "sensors"("tenantId", "name");

-- CreateIndex
CREATE INDEX "signals_tenantId_idx" ON "signals"("tenantId");

-- CreateIndex
CREATE INDEX "signals_sensorId_idx" ON "signals"("sensorId");

-- CreateIndex
CREATE INDEX "signals_signalType_idx" ON "signals"("signalType");

-- CreateIndex
CREATE INDEX "signals_anonFingerprint_idx" ON "signals"("anonFingerprint");

-- CreateIndex
CREATE INDEX "signals_createdAt_idx" ON "signals"("createdAt");

-- CreateIndex
CREATE INDEX "signals_severity_idx" ON "signals"("severity");

-- CreateIndex
CREATE INDEX "signals_createdAt_sensorId_idx" ON "signals"("createdAt", "sensorId");

-- CreateIndex
CREATE INDEX "signals_signalType_createdAt_idx" ON "signals"("signalType", "createdAt");

-- CreateIndex
CREATE INDEX "signals_tenantId_createdAt_idx" ON "signals"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "signals_anonFingerprint_createdAt_idx" ON "signals"("anonFingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "signals_severity_createdAt_idx" ON "signals"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "signals_tenantId_severity_createdAt_idx" ON "signals"("tenantId", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "threats_tenantId_idx" ON "threats"("tenantId");

-- CreateIndex
CREATE INDEX "threats_threatType_idx" ON "threats"("threatType");

-- CreateIndex
CREATE INDEX "threats_isFleetThreat_idx" ON "threats"("isFleetThreat");

-- CreateIndex
CREATE INDEX "threats_riskScore_idx" ON "threats"("riskScore");

-- CreateIndex
CREATE INDEX "threats_lastSeenAt_idx" ON "threats"("lastSeenAt");

-- CreateIndex
CREATE INDEX "threats_isFleetThreat_lastSeenAt_idx" ON "threats"("isFleetThreat", "lastSeenAt");

-- CreateIndex
CREATE INDEX "threats_threatType_lastSeenAt_idx" ON "threats"("threatType", "lastSeenAt");

-- CreateIndex
CREATE INDEX "threats_riskScore_lastSeenAt_idx" ON "threats"("riskScore", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "threats_threatType_indicator_key" ON "threats"("threatType", "indicator");

-- CreateIndex
CREATE UNIQUE INDEX "threat_signals_threatId_signalId_key" ON "threat_signals"("threatId", "signalId");

-- CreateIndex
CREATE INDEX "blocklist_entries_tenantId_idx" ON "blocklist_entries"("tenantId");

-- CreateIndex
CREATE INDEX "blocklist_entries_blockType_idx" ON "blocklist_entries"("blockType");

-- CreateIndex
CREATE INDEX "blocklist_entries_propagationStatus_idx" ON "blocklist_entries"("propagationStatus");

-- CreateIndex
CREATE INDEX "blocklist_entries_expiresAt_idx" ON "blocklist_entries"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "blocklist_entries_blockType_indicator_tenantId_key" ON "blocklist_entries"("blockType", "indicator", "tenantId");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_idx" ON "campaigns"("tenantId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_isCrossTenant_idx" ON "campaigns"("isCrossTenant");

-- CreateIndex
CREATE INDEX "campaigns_lastActivityAt_idx" ON "campaigns"("lastActivityAt");

-- CreateIndex
CREATE INDEX "campaigns_status_lastActivityAt_idx" ON "campaigns"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "campaigns_isCrossTenant_status_idx" ON "campaigns"("isCrossTenant", "status");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_status_lastActivityAt_idx" ON "campaigns"("tenantId", "status", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_threats_campaignId_threatId_key" ON "campaign_threats"("campaignId", "threatId");

-- CreateIndex
CREATE INDEX "war_rooms_tenantId_idx" ON "war_rooms"("tenantId");

-- CreateIndex
CREATE INDEX "war_rooms_status_idx" ON "war_rooms"("status");

-- CreateIndex
CREATE INDEX "war_room_activities_warRoomId_idx" ON "war_room_activities"("warRoomId");

-- CreateIndex
CREATE INDEX "war_room_activities_tenantId_idx" ON "war_room_activities"("tenantId");

-- CreateIndex
CREATE INDEX "war_room_activities_createdAt_idx" ON "war_room_activities"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "war_room_campaigns_warRoomId_campaignId_key" ON "war_room_campaigns"("warRoomId", "campaignId");

-- CreateIndex
CREATE INDEX "playbooks_tenantId_idx" ON "playbooks"("tenantId");

-- CreateIndex
CREATE INDEX "playbooks_triggerType_idx" ON "playbooks"("triggerType");

-- CreateIndex
CREATE INDEX "playbooks_tenantId_isActive_updatedAt_idx" ON "playbooks"("tenantId", "isActive", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "playbook_runs_warRoomId_idx" ON "playbook_runs"("warRoomId");

-- CreateIndex
CREATE INDEX "playbook_runs_playbookId_idx" ON "playbook_runs"("playbookId");

-- CreateIndex
CREATE INDEX "playbook_runs_tenantId_status_startedAt_idx" ON "playbook_runs"("tenantId", "status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "playbook_runs_playbookId_warRoomId_status_idx" ON "playbook_runs"("playbookId", "warRoomId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "security_audit_logs_tenantId_timestamp_idx" ON "security_audit_logs"("tenantId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "security_audit_logs_userId_timestamp_idx" ON "security_audit_logs"("userId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "security_audit_logs_action_timestamp_idx" ON "security_audit_logs"("action", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "security_audit_logs_tenantId_action_timestamp_idx" ON "security_audit_logs"("tenantId", "action", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "security_audit_logs_resourceType_resourceId_idx" ON "security_audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "config_templates_environment_idx" ON "config_templates"("environment");

-- CreateIndex
CREATE INDEX "config_templates_isActive_idx" ON "config_templates"("isActive");

-- CreateIndex
CREATE INDEX "config_templates_environment_isActive_idx" ON "config_templates"("environment", "isActive");

-- CreateIndex
CREATE INDEX "policy_templates_tenantId_idx" ON "policy_templates"("tenantId");

-- CreateIndex
CREATE INDEX "policy_templates_severity_idx" ON "policy_templates"("severity");

-- CreateIndex
CREATE INDEX "policy_templates_isDefault_idx" ON "policy_templates"("isDefault");

-- CreateIndex
CREATE INDEX "policy_templates_isActive_idx" ON "policy_templates"("isActive");

-- CreateIndex
CREATE INDEX "policy_templates_tenantId_isDefault_idx" ON "policy_templates"("tenantId", "isDefault");

-- CreateIndex
CREATE INDEX "policy_templates_tenantId_severity_isActive_idx" ON "policy_templates"("tenantId", "severity", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "policy_templates_tenantId_name_key" ON "policy_templates"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sensor_sync_state_sensorId_key" ON "sensor_sync_state"("sensorId");

-- CreateIndex
CREATE INDEX "sensor_sync_state_sensorId_idx" ON "sensor_sync_state"("sensorId");

-- CreateIndex
CREATE INDEX "fleet_commands_sensorId_idx" ON "fleet_commands"("sensorId");

-- CreateIndex
CREATE INDEX "fleet_commands_status_idx" ON "fleet_commands"("status");

-- CreateIndex
CREATE INDEX "fleet_commands_queuedAt_idx" ON "fleet_commands"("queuedAt");

-- CreateIndex
CREATE INDEX "fleet_commands_sensorId_status_idx" ON "fleet_commands"("sensorId", "status");

-- CreateIndex
CREATE INDEX "fleet_commands_status_queuedAt_idx" ON "fleet_commands"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "rule_sync_state_sensorId_idx" ON "rule_sync_state"("sensorId");

-- CreateIndex
CREATE INDEX "rule_sync_state_ruleId_idx" ON "rule_sync_state"("ruleId");

-- CreateIndex
CREATE INDEX "rule_sync_state_status_idx" ON "rule_sync_state"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rule_sync_state_sensorId_ruleId_key" ON "rule_sync_state"("sensorId", "ruleId");

-- CreateIndex
CREATE INDEX "scheduled_deployments_status_idx" ON "scheduled_deployments"("status");

-- CreateIndex
CREATE INDEX "scheduled_deployments_scheduledAt_idx" ON "scheduled_deployments"("scheduledAt");

-- CreateIndex
CREATE INDEX "scheduled_deployments_tenantId_idx" ON "scheduled_deployments"("tenantId");

-- CreateIndex
CREATE INDEX "scheduled_deployments_status_scheduledAt_idx" ON "scheduled_deployments"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "sensor_api_keys_sensorId_idx" ON "sensor_api_keys"("sensorId");

-- CreateIndex
CREATE INDEX "sensor_api_keys_keyHash_idx" ON "sensor_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "diagnostic_bundles_sensorId_idx" ON "diagnostic_bundles"("sensorId");

-- CreateIndex
CREATE INDEX "sensor_updates_sensorId_idx" ON "sensor_updates"("sensorId");

-- CreateIndex
CREATE INDEX "fleet_alerts_tenantId_idx" ON "fleet_alerts"("tenantId");

-- CreateIndex
CREATE INDEX "fleet_alerts_sensorId_idx" ON "fleet_alerts"("sensorId");

-- CreateIndex
CREATE INDEX "fleet_alerts_alertType_idx" ON "fleet_alerts"("alertType");

-- CreateIndex
CREATE INDEX "fleet_alerts_acknowledged_idx" ON "fleet_alerts"("acknowledged");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tokens_tokenHash_key" ON "registration_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "registration_tokens_tenantId_idx" ON "registration_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "registration_tokens_tokenHash_idx" ON "registration_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "beam_endpoints_tenantId_idx" ON "beam_endpoints"("tenantId");

-- CreateIndex
CREATE INDEX "beam_endpoints_lastSeenAt_idx" ON "beam_endpoints"("lastSeenAt");

-- CreateIndex
CREATE INDEX "beam_endpoints_service_idx" ON "beam_endpoints"("service");

-- CreateIndex
CREATE UNIQUE INDEX "beam_endpoints_tenantId_sensorId_method_pathTemplate_key" ON "beam_endpoints"("tenantId", "sensorId", "method", "pathTemplate");

-- CreateIndex
CREATE INDEX "beam_schema_changes_tenantId_detectedAt_idx" ON "beam_schema_changes"("tenantId", "detectedAt");

-- CreateIndex
CREATE INDEX "beam_schema_changes_endpointId_idx" ON "beam_schema_changes"("endpointId");

-- CreateIndex
CREATE INDEX "beam_rules_tenantId_status_idx" ON "beam_rules"("tenantId", "status");

-- CreateIndex
CREATE INDEX "beam_rules_tenantId_enabled_idx" ON "beam_rules"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "beam_rule_deployments_ruleId_status_idx" ON "beam_rule_deployments"("ruleId", "status");

-- CreateIndex
CREATE INDEX "beam_rule_deployments_sensorId_idx" ON "beam_rule_deployments"("sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "beam_rule_deployments_ruleId_sensorId_key" ON "beam_rule_deployments"("ruleId", "sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "beam_rule_endpoint_bindings_ruleId_endpointId_key" ON "beam_rule_endpoint_bindings"("ruleId", "endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "beam_block_decisions_blockId_key" ON "beam_block_decisions"("blockId");

-- CreateIndex
CREATE INDEX "beam_block_decisions_tenantId_decidedAt_idx" ON "beam_block_decisions"("tenantId", "decidedAt");

-- CreateIndex
CREATE INDEX "beam_block_decisions_entityId_idx" ON "beam_block_decisions"("entityId");

-- CreateIndex
CREATE INDEX "beam_block_decisions_sourceIp_idx" ON "beam_block_decisions"("sourceIp");

-- CreateIndex
CREATE UNIQUE INDEX "releases_version_key" ON "releases"("version");

-- CreateIndex
CREATE INDEX "releases_createdAt_idx" ON "releases"("createdAt");

-- CreateIndex
CREATE INDEX "rollouts_status_idx" ON "rollouts"("status");

-- CreateIndex
CREATE INDEX "rollouts_releaseId_idx" ON "rollouts"("releaseId");

-- CreateIndex
CREATE INDEX "rollouts_status_startedAt_idx" ON "rollouts"("status", "startedAt");

-- CreateIndex
CREATE INDEX "rollout_progress_rolloutId_idx" ON "rollout_progress"("rolloutId");

-- CreateIndex
CREATE INDEX "rollout_progress_sensorId_idx" ON "rollout_progress"("sensorId");

-- CreateIndex
CREATE INDEX "rollout_progress_status_idx" ON "rollout_progress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rollout_progress_rolloutId_sensorId_key" ON "rollout_progress"("rolloutId", "sensorId");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_registrationTokenId_fkey" FOREIGN KEY ("registrationTokenId") REFERENCES "registration_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threats" ADD CONSTRAINT "threats_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_signals" ADD CONSTRAINT "threat_signals_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_signals" ADD CONSTRAINT "threat_signals_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocklist_entries" ADD CONSTRAINT "blocklist_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocklist_entries" ADD CONSTRAINT "blocklist_entries_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_threats" ADD CONSTRAINT "campaign_threats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_threats" ADD CONSTRAINT "campaign_threats_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "threats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "war_rooms" ADD CONSTRAINT "war_rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "war_room_activities" ADD CONSTRAINT "war_room_activities_warRoomId_fkey" FOREIGN KEY ("warRoomId") REFERENCES "war_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "war_room_activities" ADD CONSTRAINT "war_room_activities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "war_room_campaigns" ADD CONSTRAINT "war_room_campaigns_warRoomId_fkey" FOREIGN KEY ("warRoomId") REFERENCES "war_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "war_room_campaigns" ADD CONSTRAINT "war_room_campaigns_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_runs" ADD CONSTRAINT "playbook_runs_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_runs" ADD CONSTRAINT "playbook_runs_warRoomId_fkey" FOREIGN KEY ("warRoomId") REFERENCES "war_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_sync_state" ADD CONSTRAINT "sensor_sync_state_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_commands" ADD CONSTRAINT "fleet_commands_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_sync_state" ADD CONSTRAINT "rule_sync_state_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_api_keys" ADD CONSTRAINT "sensor_api_keys_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_bundles" ADD CONSTRAINT "diagnostic_bundles_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_updates" ADD CONSTRAINT "sensor_updates_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_endpoints" ADD CONSTRAINT "beam_endpoints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_endpoints" ADD CONSTRAINT "beam_endpoints_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_schema_changes" ADD CONSTRAINT "beam_schema_changes_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "beam_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_rules" ADD CONSTRAINT "beam_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_rule_deployments" ADD CONSTRAINT "beam_rule_deployments_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "beam_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_rule_deployments" ADD CONSTRAINT "beam_rule_deployments_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_rule_endpoint_bindings" ADD CONSTRAINT "beam_rule_endpoint_bindings_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "beam_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_rule_endpoint_bindings" ADD CONSTRAINT "beam_rule_endpoint_bindings_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "beam_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_block_decisions" ADD CONSTRAINT "beam_block_decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beam_block_decisions" ADD CONSTRAINT "beam_block_decisions_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollouts" ADD CONSTRAINT "rollouts_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rollout_progress" ADD CONSTRAINT "rollout_progress_rolloutId_fkey" FOREIGN KEY ("rolloutId") REFERENCES "rollouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

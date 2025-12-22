-- CreateEnum
CREATE TYPE "TenantTier" AS ENUM ('FREE', 'STANDARD', 'ENTERPRISE', 'PLATINUM');

-- CreateEnum
CREATE TYPE "SharingPreference" AS ENUM ('CONTRIBUTE_AND_RECEIVE', 'RECEIVE_ONLY', 'CONTRIBUTE_ONLY', 'ISOLATED');

-- CreateEnum
CREATE TYPE "ConnectionState" AS ENUM ('CONNECTED', 'DISCONNECTED', 'RECONNECTING');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('IP_THREAT', 'FINGERPRINT_THREAT', 'CAMPAIGN_INDICATOR', 'CREDENTIAL_STUFFING', 'RATE_ANOMALY', 'BOT_SIGNATURE');

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
CREATE INDEX "signals_createdAt_sensorId_idx" ON "signals"("createdAt", "sensorId");

-- CreateIndex
CREATE INDEX "signals_signalType_createdAt_idx" ON "signals"("signalType", "createdAt");

-- CreateIndex
CREATE INDEX "signals_tenantId_createdAt_idx" ON "signals"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "signals_anonFingerprint_createdAt_idx" ON "signals"("anonFingerprint", "createdAt");

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
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "config_templates_environment_idx" ON "config_templates"("environment");

-- CreateIndex
CREATE INDEX "config_templates_isActive_idx" ON "config_templates"("isActive");

-- CreateIndex
CREATE INDEX "config_templates_environment_isActive_idx" ON "config_templates"("environment", "isActive");

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

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "sensor_sync_state" ADD CONSTRAINT "sensor_sync_state_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_commands" ADD CONSTRAINT "fleet_commands_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_sync_state" ADD CONSTRAINT "rule_sync_state_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

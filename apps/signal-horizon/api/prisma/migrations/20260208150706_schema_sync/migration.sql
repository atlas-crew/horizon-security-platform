-- DropIndex
DROP INDEX "token_blacklist_jti_key";

-- AlterTable
ALTER TABLE "config_templates" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "preferenceChangedAt" TIMESTAMP(3),
ADD COLUMN     "preferenceChangedBy" TEXT,
ADD COLUMN     "preferenceVersion" TEXT NOT NULL DEFAULT '1.0';

-- AlterTable
ALTER TABLE "token_blacklist" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "tenant_consents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "tenant_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_requests" (
    "key" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("key","tenantId")
);

-- CreateIndex
CREATE INDEX "tenant_consents_tenantId_idx" ON "tenant_consents"("tenantId");

-- CreateIndex
CREATE INDEX "idempotency_requests_expiresAt_idx" ON "idempotency_requests"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_tenantId_name_key" ON "api_keys"("tenantId", "name");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "beam_rules_tenantId_name_key" ON "beam_rules"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_tenantId_name_key" ON "campaigns"("tenantId", "name");

-- CreateIndex
CREATE INDEX "config_templates_tenantId_idx" ON "config_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "config_templates_tenantId_name_key" ON "config_templates"("tenantId", "name");

-- CreateIndex
CREATE INDEX "fleet_commands_sensorId_queuedAt_idx" ON "fleet_commands"("sensorId", "queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "playbooks_tenantId_name_key" ON "playbooks"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tokens_tenantId_name_key" ON "registration_tokens"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sensor_api_keys_sensorId_name_key" ON "sensor_api_keys"("sensorId", "name");

-- CreateIndex
CREATE INDEX "sensors_tenantId_connectionState_idx" ON "sensors"("tenantId", "connectionState");

-- CreateIndex
CREATE INDEX "sensors_tenantId_lastHeartbeat_idx" ON "sensors"("tenantId", "lastHeartbeat" DESC);

-- CreateIndex
CREATE INDEX "signals_sourceIp_idx" ON "signals"("sourceIp");

-- CreateIndex
CREATE INDEX "signals_fingerprint_idx" ON "signals"("fingerprint");

-- CreateIndex
CREATE INDEX "signals_tenantId_sourceIp_idx" ON "signals"("tenantId", "sourceIp");

-- CreateIndex
CREATE INDEX "signals_tenantId_signalType_createdAt_idx" ON "signals"("tenantId", "signalType", "createdAt");

-- CreateIndex
CREATE INDEX "signals_tenantId_sensorId_createdAt_idx" ON "signals"("tenantId", "sensorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tenants_id_sharingPreference_idx" ON "tenants"("id", "sharingPreference");

-- CreateIndex
CREATE UNIQUE INDEX "token_blacklist_jti_tenantId_key" ON "token_blacklist"("jti", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "war_rooms_tenantId_name_key" ON "war_rooms"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "tenant_consents" ADD CONSTRAINT "tenant_consents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_requests" ADD CONSTRAINT "idempotency_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_templates" ADD CONSTRAINT "config_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_templates" ADD CONSTRAINT "policy_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_deployments" ADD CONSTRAINT "scheduled_deployments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_alerts" ADD CONSTRAINT "fleet_alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_alerts" ADD CONSTRAINT "fleet_alerts_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_tokens" ADD CONSTRAINT "registration_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

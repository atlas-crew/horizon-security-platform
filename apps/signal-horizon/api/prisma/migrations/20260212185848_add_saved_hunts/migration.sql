-- DropIndex
DROP INDEX "sensor_intel_actor_sensorId_idx";

-- DropIndex
DROP INDEX "sensor_intel_campaign_sensorId_idx";

-- DropIndex
DROP INDEX "sensor_intel_campaign_tenantId_lastActivityAt_idx";

-- DropIndex
DROP INDEX "sensor_intel_profile_sensorId_idx";

-- DropIndex
DROP INDEX "sensor_intel_profile_tenantId_updatedAt_idx";

-- DropIndex
DROP INDEX "sensor_intel_session_sensorId_idx";

-- DropIndex
DROP INDEX "sensor_payload_snapshot_sensorId_idx";

-- CreateTable
CREATE TABLE "saved_hunts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "query" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_hunts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_hunts_tenantId_idx" ON "saved_hunts"("tenantId");

-- CreateIndex
CREATE INDEX "saved_hunts_createdBy_idx" ON "saved_hunts"("createdBy");

-- AddForeignKey
ALTER TABLE "saved_hunts" ADD CONSTRAINT "saved_hunts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

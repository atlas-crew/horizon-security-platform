-- AlterEnum
ALTER TYPE "PropagationStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "blocklist_entries" ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- RenameIndex
ALTER INDEX "sensor_intel_actor_last_seen_idx" RENAME TO "sensor_intel_actor_tenantId_lastSeenAt_idx";

-- RenameIndex
ALTER INDEX "sensor_intel_actor_sensor_idx" RENAME TO "sensor_intel_actor_sensorId_idx";

-- RenameIndex
ALTER INDEX "sensor_intel_actor_uq" RENAME TO "sensor_intel_actor_tenantId_sensorId_actorId_key";

-- RenameIndex
ALTER INDEX "sensor_intel_campaign_last_activity_idx" RENAME TO "sensor_intel_campaign_tenantId_lastActivityAt_idx";

-- RenameIndex
ALTER INDEX "sensor_intel_campaign_sensor_idx" RENAME TO "sensor_intel_campaign_sensorId_idx";

-- RenameIndex
ALTER INDEX "sensor_intel_campaign_uq" RENAME TO "sensor_intel_campaign_tenantId_sensorId_campaignId_key";

-- RenameIndex
ALTER INDEX "sensor_intel_profile_sensor_idx" RENAME TO "sensor_intel_profile_sensorId_idx";

-- RenameIndex
ALTER INDEX "sensor_intel_profile_updated_idx" RENAME TO "sensor_intel_profile_tenantId_updatedAt_idx";

-- RenameIndex
ALTER INDEX "sensor_intel_profile_uq" RENAME TO "sensor_intel_profile_tenantId_sensorId_template_method_key";

-- RenameIndex
ALTER INDEX "sensor_intel_session_last_activity_idx" RENAME TO "sensor_intel_session_tenantId_lastActivityAt_idx";

-- RenameIndex
ALTER INDEX "sensor_intel_session_sensor_idx" RENAME TO "sensor_intel_session_sensorId_idx";

-- RenameIndex
ALTER INDEX "sensor_intel_session_uq" RENAME TO "sensor_intel_session_tenantId_sensorId_sessionId_key";

-- RenameIndex
ALTER INDEX "sensor_payload_snapshot_recent_idx" RENAME TO "sensor_payload_snapshot_tenantId_capturedAt_idx";

-- RenameIndex
ALTER INDEX "sensor_payload_snapshot_sensor_idx" RENAME TO "sensor_payload_snapshot_sensorId_idx";

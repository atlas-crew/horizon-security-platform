import type { PrismaClient } from '@prisma/client';

/**
 * Best-effort dev wipe in dependency-safe order.
 * Prefer deleteMany over TRUNCATE here to keep it safe across providers.
 */
export async function wipeAll(prisma: PrismaClient): Promise<void> {
  // Phase 2 tables
  await prisma.rolloutProgress.deleteMany({});
  await prisma.rollout.deleteMany({});
  await prisma.release.deleteMany({});

  // Beam / APEX
  await prisma.ruleEndpointBinding.deleteMany({});
  await prisma.ruleDeployment.deleteMany({});
  await prisma.customerRule.deleteMany({});
  await prisma.endpointSchemaChange.deleteMany({});
  await prisma.endpoint.deleteMany({});
  await prisma.blockDecision.deleteMany({});

  // Fleet ops / on-box
  await prisma.tunnelSession.deleteMany({});
  await prisma.fleetAlert.deleteMany({});
  await prisma.sensorUpdate.deleteMany({});
  await prisma.diagnosticBundle.deleteMany({});
  await prisma.sensorApiKey.deleteMany({});
  await prisma.scheduledDeployment.deleteMany({});
  await prisma.sensorPayloadSnapshot.deleteMany({});
  await prisma.sensorIntelProfile.deleteMany({});
  await prisma.sensorIntelCampaign.deleteMany({});
  await prisma.sensorIntelSession.deleteMany({});
  await prisma.sensorIntelActor.deleteMany({});
  await prisma.sensorPingoraConfig.deleteMany({});
  await prisma.ruleSyncState.deleteMany({});
  await prisma.fleetCommand.deleteMany({});
  await prisma.sensorSyncState.deleteMany({});

  // Fleet templates
  await prisma.policyTemplate.deleteMany({});
  await prisma.configTemplate.deleteMany({});

  // War room / playbooks
  await prisma.playbookRun.deleteMany({});
  await prisma.playbook.deleteMany({});
  await prisma.warRoomCampaign.deleteMany({});
  await prisma.warRoomActivity.deleteMany({});
  await prisma.warRoom.deleteMany({});

  // Intel core
  await prisma.campaignThreat.deleteMany({});
  await prisma.threatSignal.deleteMany({});
  await prisma.blocklistEntry.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.threat.deleteMany({});
  await prisma.signal.deleteMany({});

  // Security / auth
  await prisma.securityAuditLog.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.idempotencyRequest.deleteMany({});
  await prisma.tenantConsent.deleteMany({});
  await prisma.tokenBlacklist.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.userSession.deleteMany({});
  await prisma.tenantMember.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.sensor.deleteMany({});
  // Sensors have a FK to registration_tokens (restrict by default), so delete tokens after sensors.
  await prisma.registrationToken.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.user.deleteMany({});
}

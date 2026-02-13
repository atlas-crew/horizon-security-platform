/**
 * Multi-Tenant Credential Stuffing Scenario
 * 
 * Simulates a coordinated credential stuffing attack across multiple tenants
 * sharing the same JA4 browser fingerprint to verify the Hub's cross-tenant
 * correlation capabilities.
 */

import { PrismaClient, SignalType, Severity } from '@prisma/client';
import { pino } from 'pino';
import { Aggregator } from '../../src/services/aggregator/index.js';
import { Correlator } from '../../src/services/correlator/index.js';
import { Broadcaster } from '../../src/services/broadcaster/index.js';

async function runScenario() {
  const prisma = new PrismaClient();
  const logger = pino({ level: 'info' });
  
  console.log('
================================================================');
  console.log('🚀 SIGNAL HORIZON: MULTI-TENANT ATTACK SCENARIO');
  console.log('================================================================');
  console.log('Target: Cross-tenant JA4 Correlation (Credential Stuffing)');

  // 1. Get tenants with sharing enabled
  const tenants = await prisma.tenant.findMany({
    take: 3,
    where: { sharingPreference: 'CONTRIBUTE_AND_RECEIVE' }
  });

  if (tenants.length < 2) {
    console.error('❌ ERROR: Not enough tenants with sharing enabled. Run "just seed" first.');
    await prisma.$disconnect();
    return;
  }

  console.log(`
[1/4] Identified ${tenants.length} target tenants:`);
  for (const t of tenants) {
    console.log(`  - ${t.name} (${t.id})`);
  }

  // 2. Setup Internal Services
  const broadcaster = new Broadcaster(logger);
  const correlator = new Correlator(prisma, logger, broadcaster);
  const aggregator = new Aggregator(prisma, logger, correlator, {
    batchSize: 1, // Flush immediately for scenario test
    batchTimeoutMs: 100
  });

  // 3. Define the Attacker Signature (The "Neil" Pattern)
  // Real JA4 fingerprint for a specific browser version/config
  const attackerJa4 = 'ja4:771,4865-4866-4867,0303,000a-000b-0023-001d,0017-001b-0012,0';
  
  console.log(`
[2/4] Simulating attack signature:`);
  console.log(`  - JA4 Fingerprint: ${attackerJa4}`);
  console.log(`  - Attack Vector:   Credential Stuffing`);
  console.log(`  - Strategy:        Low-and-slow across multiple tenants`);

  for (const tenant of tenants) {
    const sensor = await prisma.sensor.findFirst({ where: { tenantId: tenant.id } });
    if (!sensor) {
      console.warn(`  ! Skipping ${tenant.name}: No sensor found`);
      continue;
    }

    console.log(`
[3/4] Launching attack on ${tenant.name}...`);

    // Simulate a series of signals from different IPs but SAME fingerprint
    for (let i = 0; i < 3; i++) {
      const sourceIp = `192.168.${100 + tenants.indexOf(tenant)}.${10 + i}`;
      
      console.log(`  -> Signal from ${sourceIp} (JA4 correlation pending)`);

      // Use aggregator.queueSignal to trigger the full pipeline (anonymization -> storage -> correlation)
      aggregator.queueSignal({
        tenantId: tenant.id,
        sensorId: sensor.id,
        signalType: SignalType.CREDENTIAL_STUFFING,
        severity: Severity.HIGH,
        confidence: 0.95,
        fingerprint: attackerJa4,
        sourceIp,
        metadata: {
          endpoint: '/api/v1/auth/login',
          method: 'POST',
          attemptCount: 150,
          failureRate: 0.98,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
      } as any);
    }
  }

  console.log('
[4/4] Finalizing correlation...');
  
  // Wait for async processing to complete
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Verify Results in Database
  const latestCampaign = await prisma.campaign.findFirst({
    where: { 
      isCrossTenant: true,
      name: { startsWith: 'Fleet Campaign' }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('
================================================================');
  console.log('📊 RESULTS');
  console.log('================================================================');

  if (latestCampaign && latestCampaign.tenantsAffected >= tenants.length) {
    console.log('✅ KILLER DIFFERENTIATOR VALIDATED!');
    console.log(`
Fleet Intelligence has successfully correlated 3 separate attacks`);
    console.log(`into a single campaign using anonymized JA4 signatures.`);
    
    console.log(`
CAMPAIGN SUMMARY:`);
    console.log(`- ID:         ${latestCampaign.id}`);
    console.log(`- Name:       ${latestCampaign.name}`);
    console.log(`- Tenants:    ${latestCampaign.tenantsAffected}`);
    console.log(`- Severity:   ${latestCampaign.severity}`);
    console.log(`- Confidence: ${Math.round(latestCampaign.confidence * 100)}%`);
    
    const metadata = latestCampaign.metadata as any;
    console.log(`- Anon JA4:   ${metadata?.anonFingerprint?.substring(0, 16)}...`);
  } else {
    console.log('❌ SCENARIO FAILED: Cross-tenant campaign not detected.');
    if (latestCampaign) {
      console.log(`Only ${latestCampaign.tenantsAffected} tenants affected (needed ${tenants.length})`);
    }
  }
  console.log('================================================================
');

  await prisma.$disconnect();
}

runScenario().catch(err => {
  console.error('💥 FATAL ERROR:', err);
  process.exit(1);
});

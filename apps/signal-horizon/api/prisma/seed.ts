/**
 * Signal Horizon - Comprehensive Seed Data
 *
 * Usage:
 *   pnpm -C apps/signal-horizon/api run db:seed
 *   pnpm -C apps/signal-horizon/api run db:seed -- --profile=medium --seed=42 --wipe=true
 *   SEED_CLICKHOUSE=true CLICKHOUSE_ENABLED=true pnpm -C apps/signal-horizon/api run db:seed -- --clickhouse=true
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { resolveSeedOptions } from './seed/args.js';
import { wipeAll } from './seed/wipe.js';
import { seedPostgres } from './seed/seed-postgres.js';
import { seedClickhouse } from './seed/seed-clickhouse.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  const opts = resolveSeedOptions();
  const prisma = new PrismaClient();

  logger.info({ opts }, 'Seed starting');

  if (opts.wipe) {
    logger.info('Wiping existing data (dev wipe)');
    await wipeAll(prisma);
  }

  logger.info('Seeding Postgres');
  const summary = await seedPostgres(prisma, opts);

  // Optional ClickHouse backfill (only if explicitly enabled)
  await seedClickhouse(logger, opts, summary);

  logger.info('Seed complete');
  for (const t of summary.tenants) {
    logger.info(
      {
        tenantId: t.tenantId,
        adminEmail: t.adminEmail,
        adminPassword: t.adminPassword,
        dashboardApiKey: t.dashboardApiKey,
        sensors: t.sensors.slice(0, 5),
        sensorBridge: t.sensorBridge,
      },
      'Seed tenant summary'
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});

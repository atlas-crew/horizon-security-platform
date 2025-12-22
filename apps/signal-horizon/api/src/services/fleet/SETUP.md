# Fleet Management Services - Setup Instructions

## Prerequisites

Before using the fleet management services, you need to:

1. **Set up the database connection**
2. **Run the Prisma migration**
3. **Regenerate the Prisma client**

## Step-by-Step Setup

### 1. Configure Database Connection

Create a `.env` file in `apps/signal-horizon/api/` with your database URL:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/signal_horizon"
```

Or use the example:

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 2. Run Database Migration

Apply the fleet management schema changes:

```bash
cd apps/signal-horizon/api

# Development (with migration name)
pnpm prisma migrate dev --name add_fleet_management

# Production
pnpm prisma migrate deploy
```

This will:
- Create the migration SQL file
- Apply the migration to your database
- Automatically run `prisma generate` to update the Prisma client

### 3. Verify Migration

Check that the new tables were created:

```sql
-- Expected tables:
-- config_templates
-- sensor_sync_state
-- fleet_commands
-- rule_sync_state
```

Query the database:

```bash
pnpm prisma studio
```

Or use psql:

```bash
psql $DATABASE_URL -c "\dt"
```

### 4. Verify TypeScript Compilation

After migration, TypeScript should compile without errors:

```bash
pnpm exec tsc --noEmit src/services/fleet/*.ts
```

If you see errors about missing Prisma types, run:

```bash
pnpm prisma generate
```

## Migration SQL Preview

The migration will create the following tables:

```sql
-- Configuration templates
CREATE TABLE "config_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'production',
  "config" JSONB NOT NULL,
  "hash" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0.0',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "config_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "config_templates_environment_idx" ON "config_templates"("environment");
CREATE INDEX "config_templates_is_active_idx" ON "config_templates"("is_active");

-- Sensor sync state
CREATE TABLE "sensor_sync_state" (
  "id" TEXT NOT NULL,
  "sensor_id" TEXT NOT NULL,
  "expected_config_hash" TEXT NOT NULL,
  "expected_rules_hash" TEXT NOT NULL,
  "expected_blocklist_hash" TEXT NOT NULL,
  "actual_config_hash" TEXT,
  "actual_rules_hash" TEXT,
  "actual_blocklist_hash" TEXT,
  "last_sync_attempt" TIMESTAMP(3),
  "last_sync_success" TIMESTAMP(3),
  "sync_errors" TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sensor_sync_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sensor_sync_state_sensor_id_key" ON "sensor_sync_state"("sensor_id");
CREATE INDEX "sensor_sync_state_sensor_id_idx" ON "sensor_sync_state"("sensor_id");

ALTER TABLE "sensor_sync_state" ADD CONSTRAINT "sensor_sync_state_sensor_id_fkey"
  FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fleet commands
CREATE TABLE "fleet_commands" (
  "id" TEXT NOT NULL,
  "sensor_id" TEXT NOT NULL,
  "command_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "result" JSONB,
  "error" TEXT,
  "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "timeout_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fleet_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fleet_commands_sensor_id_idx" ON "fleet_commands"("sensor_id");
CREATE INDEX "fleet_commands_status_idx" ON "fleet_commands"("status");
CREATE INDEX "fleet_commands_queued_at_idx" ON "fleet_commands"("queued_at");

ALTER TABLE "fleet_commands" ADD CONSTRAINT "fleet_commands_sensor_id_fkey"
  FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rule sync state
CREATE TABLE "rule_sync_state" (
  "id" TEXT NOT NULL,
  "sensor_id" TEXT NOT NULL,
  "rule_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "synced_at" TIMESTAMP(3),
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rule_sync_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rule_sync_state_sensor_id_rule_id_key" ON "rule_sync_state"("sensor_id", "rule_id");
CREATE INDEX "rule_sync_state_sensor_id_idx" ON "rule_sync_state"("sensor_id");
CREATE INDEX "rule_sync_state_rule_id_idx" ON "rule_sync_state"("rule_id");
CREATE INDEX "rule_sync_state_status_idx" ON "rule_sync_state"("status");

ALTER TABLE "rule_sync_state" ADD CONSTRAINT "rule_sync_state_sensor_id_fkey"
  FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## Rollback Instructions

If you need to rollback the migration:

```bash
# View migration history
pnpm prisma migrate status

# Rollback (requires manual intervention)
# Prisma doesn't have automatic rollback, so you'll need to:

# 1. Drop the tables manually
psql $DATABASE_URL << EOF
DROP TABLE IF EXISTS "rule_sync_state" CASCADE;
DROP TABLE IF EXISTS "fleet_commands" CASCADE;
DROP TABLE IF EXISTS "sensor_sync_state" CASCADE;
DROP TABLE IF EXISTS "config_templates" CASCADE;
EOF

# 2. Mark migration as rolled back in _prisma_migrations table
psql $DATABASE_URL -c "DELETE FROM _prisma_migrations WHERE migration_name LIKE '%add_fleet_management%';"

# 3. Delete migration files
rm -rf prisma/migrations/*add_fleet_management*
```

## Common Issues

### Issue: "Environment variable not found: DATABASE_URL"

**Solution**: Create a `.env` file with your database URL:
```bash
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/signal_horizon" > .env
```

### Issue: TypeScript errors about missing Prisma types

**Solution**: Regenerate the Prisma client:
```bash
pnpm prisma generate
```

### Issue: Migration fails with "relation already exists"

**Solution**: The tables already exist. Either:
1. Drop the tables and run migration again
2. Use `prisma db push` to sync schema without migrations
3. Mark the migration as applied: `pnpm prisma migrate resolve --applied add_fleet_management`

### Issue: "Database is not empty"

**Solution**: The migration requires an empty database or use `--skip-seed`:
```bash
pnpm prisma migrate dev --name add_fleet_management --skip-seed
```

## Testing the Setup

After successful migration, test the services:

```typescript
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { FleetAggregator, ConfigManager, FleetCommander, RuleDistributor } from './services/fleet';

const prisma = new PrismaClient();
const logger = pino();

// Test FleetAggregator
const aggregator = new FleetAggregator(logger);
console.log('FleetAggregator created successfully');

// Test FleetCommander
const commander = new FleetCommander(prisma, logger);
console.log('FleetCommander created successfully');

// Test ConfigManager
const configManager = new ConfigManager(prisma, logger);
configManager.setFleetCommander(commander);
console.log('ConfigManager created successfully');

// Test RuleDistributor
const distributor = new RuleDistributor(prisma, logger);
distributor.setFleetCommander(commander);
console.log('RuleDistributor created successfully');

// Test database connection
await prisma.configTemplate.findMany();
console.log('Database connection successful');

await prisma.$disconnect();
```

## Next Steps

After successful setup:

1. ✅ Integrate with WebSocket sensor gateway
2. ✅ Create REST API endpoints
3. ✅ Add unit tests
4. ✅ Add integration tests
5. ✅ Build dashboard UI
6. ✅ Set up monitoring and alerting

See [README.md](./README.md) for usage examples and API integration.

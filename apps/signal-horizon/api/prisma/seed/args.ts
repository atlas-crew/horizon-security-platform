export type SeedProfile = 'small' | 'medium' | 'large';

export interface SeedOptions {
  profile: SeedProfile;
  seed: number;
  wipe: boolean;
  // Postgres volumes
  tenants: number;
  usersPerTenant: number;
  sensorsPerTenant: number;
  endpointsPerSensor: number;
  rulesPerTenant: number;
  signalsPerSensor: number;
  recentDays: number;
  // ClickHouse backfill (optional)
  clickhouse: boolean;
  clickhouseDays: number;
  clickhouseSignalsPerSensorPerDay: number;
}

function parseBoolean(val: string | undefined, defaultValue: boolean): boolean {
  if (val == null) return defaultValue;
  const v = val.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return defaultValue;
}

function parseIntSafe(val: string | undefined, defaultValue: number): number {
  if (val == null) return defaultValue;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const raw = arg.slice(2);
    const eq = raw.indexOf('=');
    if (eq === -1) {
      out[raw] = true;
      continue;
    }
    const k = raw.slice(0, eq);
    const v = raw.slice(eq + 1);
    out[k] = v;
  }
  return out;
}

export function resolveSeedOptions(argv = process.argv.slice(2), env = process.env): SeedOptions {
  const args = parseArgs(argv);
  const profile = String((args.profile ?? env.SEED_PROFILE ?? 'small')).toLowerCase() as SeedProfile;

  const defaultsByProfile: Record<SeedProfile, Omit<SeedOptions, 'profile' | 'seed' | 'wipe' | 'clickhouse'>> = {
    small: {
      tenants: 3,
      usersPerTenant: 3,
      sensorsPerTenant: 4,
      endpointsPerSensor: 18,
      rulesPerTenant: 6,
      signalsPerSensor: 600,
      recentDays: 7,
      clickhouseDays: 30,
      clickhouseSignalsPerSensorPerDay: 80,
    },
    medium: {
      tenants: 6,
      usersPerTenant: 4,
      sensorsPerTenant: 10,
      endpointsPerSensor: 30,
      rulesPerTenant: 10,
      signalsPerSensor: 2000,
      recentDays: 14,
      clickhouseDays: 60,
      clickhouseSignalsPerSensorPerDay: 140,
    },
    large: {
      tenants: 12,
      usersPerTenant: 5,
      sensorsPerTenant: 25,
      endpointsPerSensor: 40,
      rulesPerTenant: 16,
      signalsPerSensor: 6000,
      recentDays: 21,
      clickhouseDays: 90,
      clickhouseSignalsPerSensorPerDay: 220,
    },
  };

  const base = defaultsByProfile[profile] ?? defaultsByProfile.small;
  const seed = parseIntSafe(String(args.seed ?? env.SEED_SEED ?? '1337'), 1337);
  const wipe = parseBoolean(String(args.wipe ?? env.SEED_WIPE ?? 'true'), true);
  const clickhouse = parseBoolean(String(args.clickhouse ?? env.SEED_CLICKHOUSE ?? 'false'), false);

  return {
    profile: (defaultsByProfile[profile] ? profile : 'small'),
    seed,
    wipe,
    clickhouse,
    tenants: parseIntSafe(String(args.tenants ?? env.SEED_TENANTS ?? ''), base.tenants),
    usersPerTenant: parseIntSafe(String(args.usersPerTenant ?? env.SEED_USERS_PER_TENANT ?? ''), base.usersPerTenant),
    sensorsPerTenant: parseIntSafe(String(args.sensorsPerTenant ?? env.SEED_SENSORS_PER_TENANT ?? ''), base.sensorsPerTenant),
    endpointsPerSensor: parseIntSafe(String(args.endpointsPerSensor ?? env.SEED_ENDPOINTS_PER_SENSOR ?? ''), base.endpointsPerSensor),
    rulesPerTenant: parseIntSafe(String(args.rulesPerTenant ?? env.SEED_RULES_PER_TENANT ?? ''), base.rulesPerTenant),
    signalsPerSensor: parseIntSafe(String(args.signalsPerSensor ?? env.SEED_SIGNALS_PER_SENSOR ?? ''), base.signalsPerSensor),
    recentDays: parseIntSafe(String(args.recentDays ?? env.SEED_RECENT_DAYS ?? ''), base.recentDays),
    clickhouseDays: parseIntSafe(String(args.clickhouseDays ?? env.SEED_CLICKHOUSE_DAYS ?? ''), base.clickhouseDays),
    clickhouseSignalsPerSensorPerDay: parseIntSafe(
      String(args.clickhouseSignalsPerSensorPerDay ?? env.SEED_CLICKHOUSE_SIGNALS_PER_SENSOR_PER_DAY ?? ''),
      base.clickhouseSignalsPerSensorPerDay
    ),
  };
}


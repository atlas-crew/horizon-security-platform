import path from 'node:path';

export type UpgradeMatchType =
  | 'sensor'
  | 'dashboard'
  | 'tunnel-sensor'
  | 'tunnel-user'
  | 'tunnel-unknown';

export interface UpgradeMatch {
  type: UpgradeMatchType;
  path: string;
}

interface UpgradePathConfig {
  sensorPath: string;
  dashboardPath: string;
}

const TUNNEL_SENSOR_PREFIX = '/ws/tunnel/sensor';
const TUNNEL_USER_PREFIX = '/ws/tunnel/user';
const INVALID_ENCODED_TOKENS = ['%2f', '%5c', '%2e', '%00'];

const stripQuery = (value: string): string => value.split('?')[0].split('#')[0];

const trimTrailingSlash = (value: string): string =>
  value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;

const hasInvalidEncoding = (value: string): boolean => {
  const lower = value.toLowerCase();
  return INVALID_ENCODED_TOKENS.some((token) => lower.includes(token));
};

const normalizeConfigPath = (value: string): string => {
  const clean = trimTrailingSlash(stripQuery(value.trim()));
  return path.posix.normalize(clean);
};

const normalizeUpgradePath = (rawUrl: string | undefined): string | null => {
  if (!rawUrl) {
    return null;
  }

  if (!rawUrl.startsWith('/') || rawUrl.startsWith('//')) {
    return null;
  }

  if (rawUrl.includes('\\') || rawUrl.includes('\u0000')) {
    return null;
  }

  const pathOnly = trimTrailingSlash(stripQuery(rawUrl));

  if (hasInvalidEncoding(pathOnly)) {
    return null;
  }

  const normalized = path.posix.normalize(pathOnly);
  if (normalized !== pathOnly) {
    return null;
  }

  return normalized;
};

export const matchUpgradePath = (
  rawUrl: string | undefined,
  config: UpgradePathConfig
): UpgradeMatch | null => {
  const candidate = normalizeUpgradePath(rawUrl);
  if (!candidate) {
    return null;
  }

  const sensorPath = normalizeConfigPath(config.sensorPath);
  const dashboardPath = normalizeConfigPath(config.dashboardPath);

  if (candidate === sensorPath) {
    return { type: 'sensor', path: candidate };
  }

  if (candidate === dashboardPath) {
    return { type: 'dashboard', path: candidate };
  }

  if (candidate === TUNNEL_SENSOR_PREFIX || candidate.startsWith(`${TUNNEL_SENSOR_PREFIX}/`)) {
    return { type: 'tunnel-sensor', path: candidate };
  }

  if (candidate === TUNNEL_USER_PREFIX || candidate.startsWith(`${TUNNEL_USER_PREFIX}/`)) {
    return { type: 'tunnel-user', path: candidate };
  }

  if (candidate.startsWith('/ws/tunnel/')) {
    return { type: 'tunnel-unknown', path: candidate };
  }

  return null;
};

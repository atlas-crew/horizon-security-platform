export const API_ROOT_PREFIX = '/api';
export const API_V1_PREFIX = '/api/v1';
export const HEALTH_PATH = '/health';
export const READY_PATH = '/ready';
export const METRICS_PATH = '/metrics';
export const TELEMETRY_PREFIX = '/telemetry';
export const SENSOR_REPORT_PREFIX = '/_sensor';
export const WS_PREFIX = '/ws';

export const APP_SHELL_RESERVED_PREFIXES = [
  API_ROOT_PREFIX,
  TELEMETRY_PREFIX,
  WS_PREFIX,
  SENSOR_REPORT_PREFIX,
] as const;

export const APP_SHELL_RESERVED_PATHS = [HEALTH_PATH, READY_PATH, METRICS_PATH] as const;

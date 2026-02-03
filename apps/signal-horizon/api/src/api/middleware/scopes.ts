/**
 * Scope Registry and Aliases
 *
 * Defines all API permission scopes and backward-compatible aliases.
 * Aliases allow existing API keys with broad scopes to access new
 * specific endpoints without requiring key rotation.
 */

/**
 * All available permission scopes with descriptions.
 * Format: 'resource:action' where action is typically read/write/execute/manage/delete
 */
export const SCOPES = {
  // Hunt - Signal timeline and saved queries
  'hunt:read': 'View signal timeline and saved queries',
  'hunt:write': 'Create and modify saved queries',
  'hunt:execute': 'Execute saved queries',
  'hunt:export': 'Export hunt results',

  // Analytics (Beam dashboard)
  'analytics:read': 'View analytics dashboards',
  'analytics:health': 'View system health metrics',

  // Tunnel - Remote sensor access
  'tunnel:read': 'View tunnel status and sessions',
  'tunnel:shell': 'Open shell sessions to sensors',
  'tunnel:dashboard': 'Open dashboard proxy sessions',
  'tunnel:manage': 'Manage tunnel sessions',

  // Playbooks
  'playbook:read': 'View playbooks',
  'playbook:create': 'Create new playbooks',
  'playbook:update': 'Modify existing playbooks',
  'playbook:execute': 'Execute playbooks',
  'playbook:delete': 'Delete playbooks',

  // War Rooms
  'warroom:read': 'View war rooms',
  'warroom:create': 'Create war rooms',
  'warroom:update': 'Modify war room settings',
  'warroom:manage': 'Manage membership and blocks',
  'warroom:execute': 'Execute actions',

  // Threats
  'threats:read': 'View threat data',
  'threats:feedback': 'Provide threat feedback',

  // Campaigns
  'campaigns:read': 'View campaigns',
  'campaigns:update': 'Modify campaigns',

  // Credentials
  'credentials:read': 'View API keys',
  'credentials:manage': 'Create/rotate/revoke credentials',

  // Audit
  'audit:read': 'View audit logs',

  // Sensors
  'sensor:read': 'View sensor data and status',
  'sensor:control': 'Control sensor operations',

  // Fleet (existing scopes)
  'fleet:read': 'Read fleet data',
  'fleet:write': 'Modify fleet configuration',
  'fleet:admin': 'Full fleet administrative access',

  // Dashboard (existing scopes)
  'dashboard:read': 'Read dashboard data',
  'dashboard:write': 'Modify dashboard settings',

  // Config
  'config:read': 'Read configuration',
  'config:write': 'Modify configuration',

  // Rules
  'rules:read': 'View WAF rules',
  'rules:write': 'Modify WAF rules',

  // Signal
  'signal:read': 'Read signals',
  'signal:write': 'Write signals',

  // Command
  'command:execute': 'Execute fleet commands',
} as const;

export type Scope = keyof typeof SCOPES;

/**
 * Scope aliases for backward compatibility.
 *
 * Existing API keys with these broad scopes will automatically have access
 * to the new specific scopes listed in the array.
 *
 * Example: An API key with 'dashboard:read' will also have access to
 * 'analytics:read', 'threats:read', etc.
 */
export const SCOPE_ALIASES: Record<string, readonly string[]> = {
  // Dashboard read includes analytics, threats, war rooms, hunts, playbooks, campaigns
  'dashboard:read': [
    'analytics:read',
    'analytics:health',
    'threats:read',
    'warroom:read',
    'hunt:read',
    'playbook:read',
    'campaigns:read',
  ],

  // Dashboard write includes war room and playbook management
  'dashboard:write': [
    'warroom:create',
    'warroom:update',
    'playbook:create',
    'playbook:execute',
    'threats:feedback',
    'hunt:write',
    'hunt:execute',
  ],

  // Fleet read includes tunnel and credential viewing
  'fleet:read': [
    'tunnel:read',
    'credentials:read',
    'sensor:read',
  ],

  // Fleet write includes tunnel management
  'fleet:write': [
    'tunnel:manage',
    'credentials:manage',
    'sensor:control',
  ],

  // Fleet admin includes everything sensitive
  'fleet:admin': [
    'tunnel:shell',
    'tunnel:dashboard',
    'audit:read',
    'playbook:delete',
    'hunt:export',
    'warroom:manage',
    'warroom:execute',
  ],

  // Signal read includes hunt read
  'signal:read': [
    'hunt:read',
  ],

  // Signal write includes hunt write
  'signal:write': [
    'hunt:write',
    'hunt:execute',
  ],
} as const;

/**
 * Expand scopes by including all scopes that aliases grant.
 * Used by requireScope() to check if user has access through aliases.
 *
 * @param scopes - The scopes from the API key
 * @returns Expanded set of scopes including aliased scopes
 */
export function expandScopes(scopes: string[]): Set<string> {
  const expanded = new Set<string>(scopes);

  for (const scope of scopes) {
    const aliases = SCOPE_ALIASES[scope];
    if (aliases) {
      for (const aliasedScope of aliases) {
        expanded.add(aliasedScope);
      }
    }
  }

  return expanded;
}

/**
 * Check if the given scopes include the required scope (with alias expansion).
 *
 * @param userScopes - The scopes from the API key
 * @param requiredScope - The scope needed for the operation
 * @returns true if user has access (directly or through aliases)
 */
export function hasScope(userScopes: string[], requiredScope: string): boolean {
  // Direct match
  if (userScopes.includes(requiredScope)) {
    return true;
  }

  // Check aliases
  for (const userScope of userScopes) {
    const aliases = SCOPE_ALIASES[userScope];
    if (aliases && aliases.includes(requiredScope)) {
      return true;
    }
  }

  return false;
}

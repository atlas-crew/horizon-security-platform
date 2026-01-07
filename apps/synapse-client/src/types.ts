/**
 * Re-export types from @edge-lab/synapse-api
 * This file exists for backward compatibility
 *
 * @deprecated Import directly from '@edge-lab/synapse-api' instead
 */

export type {
  SynapseClientOptions,
  HealthResponse,
  SensorStatus,
  Entity,
  EntityRuleMatch,
  Block,
  EntitiesResponse,
  BlocksResponse,
  ReleaseResponse,
  ReleaseAllResponse,
  WafConfig,
  SystemConfig,
  ConfigResponse,
  ConfigUpdateResponse,
  MatchCondition,
  Rule,
  RuleStats,
  RulesResponse,
  RuleDefinition,
  AddRuleResponse,
  RemoveRuleResponse,
  ClearRulesResponse,
  ReloadRulesResponse,
  EvaluateRequest,
  EvaluateResult,
  Actor,
  ActorsResponse,
  ActorStats,
  SetFingerprintResponse,
} from '@edge-lab/synapse-api';

export { SynapseError } from '@edge-lab/synapse-api';

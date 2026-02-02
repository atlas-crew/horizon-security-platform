//! Synapse facade for the WAF engine.
//!
//! Provides a high-level API matching the libsynapse Synapse struct
//! for seamless migration.

use super::{Engine, Request, RiskConfig, Verdict, WafError};
use crate::profiler::EndpointProfile;

/// Main WAF detection engine facade.
///
/// This struct provides the same API as libsynapse::Synapse,
/// enabling a drop-in replacement.
///
/// # Example
///
/// ```ignore
/// use synapse_pingora::waf::{Synapse, Request, Action};
///
/// let mut synapse = Synapse::new();
/// synapse.load_rules(rules_json).unwrap();
///
/// let verdict = synapse.analyze(&Request {
///     method: "GET",
///     path: "/api/users?id=1' OR '1'='1",
///     ..Default::default()
/// });
///
/// assert_eq!(verdict.action, Action::Block);
/// ```
pub struct Synapse {
    engine: Engine,
}

impl Default for Synapse {
    fn default() -> Self {
        Self::new()
    }
}

impl Synapse {
    /// Create a new Synapse instance with no rules loaded.
    pub fn new() -> Self {
        Self {
            engine: Engine::empty(),
        }
    }

    /// Load rules from JSON.
    ///
    /// Returns the number of rules loaded on success.
    pub fn load_rules(&mut self, json: &[u8]) -> Result<usize, WafError> {
        self.engine.load_rules(json)
    }

    /// Analyze a request and return a verdict.
    pub fn analyze(&self, req: &Request) -> Verdict {
        self.engine.analyze(req)
    }

    /// Record response status code for profiling.
    ///
    /// Note: This is a no-op in the current implementation.
    /// Profiling is handled by the separate ProfileStore.
    pub fn record_response_status(&self, _path: &str, _status: u16) {
        // No-op - profiling is handled by ProfileStore
    }

    /// Get all learned profiles.
    ///
    /// Note: This returns an empty vector in the current implementation.
    /// Use the ProfileStore directly for profile management.
    pub fn get_profiles(&self) -> Vec<EndpointProfile> {
        // The Engine doesn't manage profiles directly.
        // Use synapse_pingora::profiler::ProfileStore instead.
        Vec::new()
    }

    /// Load profiles into the engine.
    ///
    /// Note: This is a no-op in the current implementation.
    /// Use the ProfileStore directly for profile management.
    pub fn load_profiles(&self, _profiles: Vec<EndpointProfile>) {
        // No-op - use ProfileStore directly
    }

    /// Get the number of loaded rules.
    pub fn rule_count(&self) -> usize {
        self.engine.rule_count()
    }

    /// Get current risk configuration.
    pub fn risk_config(&self) -> RiskConfig {
        // Return default config as Engine doesn't currently store this
        RiskConfig::default()
    }

    /// Set risk configuration.
    ///
    /// Note: This is a no-op in the current implementation.
    /// Risk config should be applied at the entity/actor level.
    pub fn set_risk_config(&self, _config: RiskConfig) {
        // No-op - risk config is managed externally
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_synapse() {
        let synapse = Synapse::new();
        assert_eq!(synapse.rule_count(), 0);
    }

    #[test]
    fn test_load_rules() {
        let mut synapse = Synapse::new();
        let rules = r#"[
            {
                "id": 1,
                "description": "SQL injection",
                "risk": 10.0,
                "blocking": true,
                "matches": [
                    {"type": "uri", "match": {"type": "contains", "match": "' OR '"}}
                ]
            }
        ]"#;
        let count = synapse.load_rules(rules.as_bytes()).unwrap();
        assert_eq!(count, 1);
        assert_eq!(synapse.rule_count(), 1);
    }

    #[test]
    fn test_default_synapse() {
        let synapse = Synapse::default();
        assert_eq!(synapse.rule_count(), 0);
    }
}

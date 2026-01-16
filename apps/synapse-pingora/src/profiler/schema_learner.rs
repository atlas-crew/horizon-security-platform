//! Schema learning engine for API endpoints.
//!
//! Automatically learns JSON schema structure from request/response bodies:
//! - Extracts field types and constraints
//! - Builds schema maps per endpoint
//! - Validates requests against learned schemas
//!
//! ## Performance
//! - Learn from request: ~5us typical
//! - Validate request: ~3us typical
//! - Thread-safe via DashMap

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use dashmap::DashMap;
use serde::{Deserialize, Serialize};

use crate::profiler::patterns::detect_pattern;
use crate::profiler::schema_types::{
    EndpointSchema, FieldSchema, FieldType, SchemaViolation, ValidationResult,
};

// ============================================================================
// Configuration
// ============================================================================

/// Configuration for the schema learner.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaLearnerConfig {
    /// Maximum number of endpoint schemas to track
    pub max_schemas: usize,

    /// Minimum samples before validation is active
    pub min_samples_for_validation: u32,

    /// Maximum depth for nested object learning
    pub max_nesting_depth: usize,

    /// Maximum fields per schema (memory protection)
    pub max_fields_per_schema: usize,

    /// String length tolerance multiplier for validation
    /// (actual max allowed = learned_max * multiplier)
    pub string_length_tolerance: f64,

    /// Number value tolerance multiplier for validation
    /// (actual max allowed = learned_max * multiplier)
    pub number_value_tolerance: f64,

    /// Required field threshold (fields seen in > threshold% of requests)
    pub required_field_threshold: f64,
}

impl Default for SchemaLearnerConfig {
    fn default() -> Self {
        Self {
            max_schemas: 5000,
            min_samples_for_validation: 10,
            max_nesting_depth: 10,
            max_fields_per_schema: 100,
            string_length_tolerance: 2.0,
            number_value_tolerance: 2.0,
            required_field_threshold: 0.9,
        }
    }
}

// ============================================================================
// SchemaLearner
// ============================================================================

/// Thread-safe schema learner for API endpoints.
///
/// Uses DashMap for lock-free concurrent access to endpoint schemas.
/// Implements LRU eviction when max_schemas is exceeded.
pub struct SchemaLearner {
    /// Endpoint schemas indexed by template path
    schemas: DashMap<String, EndpointSchema>,

    /// Configuration
    config: SchemaLearnerConfig,
}

impl Default for SchemaLearner {
    fn default() -> Self {
        Self::new()
    }
}

impl SchemaLearner {
    /// Create a new schema learner with default configuration.
    pub fn new() -> Self {
        Self::with_config(SchemaLearnerConfig::default())
    }

    /// Create a new schema learner with custom configuration.
    pub fn with_config(config: SchemaLearnerConfig) -> Self {
        Self {
            schemas: DashMap::with_capacity(config.max_schemas),
            config,
        }
    }

    /// Get current configuration.
    pub fn config(&self) -> &SchemaLearnerConfig {
        &self.config
    }

    /// Get number of tracked schemas.
    pub fn len(&self) -> usize {
        self.schemas.len()
    }

    /// Check if empty.
    pub fn is_empty(&self) -> bool {
        self.schemas.is_empty()
    }

    /// Get current timestamp in milliseconds.
    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }

    // ========================================================================
    // Learning
    // ========================================================================

    /// Learn schema from a request body.
    ///
    /// Updates the endpoint schema with field types and constraints learned
    /// from the JSON body.
    pub fn learn_from_request(&self, template: &str, request_body: &serde_json::Value) {
        self.learn_internal(template, request_body, SchemaTarget::Request);
    }

    /// Learn schema from a response body.
    pub fn learn_from_response(&self, template: &str, response_body: &serde_json::Value) {
        self.learn_internal(template, response_body, SchemaTarget::Response);
    }

    /// Learn from both request and response.
    pub fn learn_from_pair(
        &self,
        template: &str,
        request_body: Option<&serde_json::Value>,
        response_body: Option<&serde_json::Value>,
    ) {
        let now = Self::now_ms();

        // Ensure schema exists and update sample count
        self.ensure_schema(template, now);

        if let Some(req) = request_body {
            if req.is_object() {
                self.update_schema_fields(template, req, SchemaTarget::Request, "", 0);
            }
        }

        if let Some(resp) = response_body {
            if resp.is_object() {
                self.update_schema_fields(template, resp, SchemaTarget::Response, "", 0);
            }
        }

        // Increment sample count
        if let Some(mut schema) = self.schemas.get_mut(template) {
            schema.sample_count += 1;
            schema.last_updated_ms = now;
        }
    }

    /// Internal learning implementation.
    fn learn_internal(&self, template: &str, body: &serde_json::Value, target: SchemaTarget) {
        if !body.is_object() {
            return;
        }

        let now = Self::now_ms();
        self.ensure_schema(template, now);
        self.update_schema_fields(template, body, target, "", 0);

        // Update sample count only for request bodies (avoid double counting)
        if matches!(target, SchemaTarget::Request) {
            if let Some(mut schema) = self.schemas.get_mut(template) {
                schema.sample_count += 1;
                schema.last_updated_ms = now;
            }
        }
    }

    /// Ensure a schema exists for the template.
    fn ensure_schema(&self, template: &str, now: u64) {
        if self.schemas.contains_key(template) {
            return;
        }

        // LRU eviction if at capacity
        if self.schemas.len() >= self.config.max_schemas {
            self.evict_oldest();
        }

        self.schemas
            .insert(template.to_string(), EndpointSchema::new(template.to_string(), now));
    }

    /// Evict the oldest schema (by last_updated_ms).
    fn evict_oldest(&self) {
        let oldest = self
            .schemas
            .iter()
            .min_by_key(|entry| entry.value().last_updated_ms)
            .map(|entry| entry.key().clone());

        if let Some(key) = oldest {
            self.schemas.remove(&key);
        }
    }

    /// Update schema fields from JSON value.
    /// Optimized to collect nested objects in a single pass, avoiding double iteration.
    fn update_schema_fields(
        &self,
        template: &str,
        value: &serde_json::Value,
        target: SchemaTarget,
        prefix: &str,
        depth: usize,
    ) {
        // Guard against deep nesting
        if depth > self.config.max_nesting_depth {
            return;
        }

        let obj = match value.as_object() {
            Some(o) => o,
            None => return,
        };

        // Collect nested objects in the same pass (avoiding double iteration)
        let mut nested_objects: Vec<(String, &serde_json::Value)> = Vec::new();

        {
            let mut schema_guard = match self.schemas.get_mut(template) {
                Some(s) => s,
                None => return,
            };

            let schema_map = match target {
                SchemaTarget::Request => &mut schema_guard.request_schema,
                SchemaTarget::Response => &mut schema_guard.response_schema,
            };

            // Memory protection
            if schema_map.len() >= self.config.max_fields_per_schema {
                return;
            }

            for (key, val) in obj {
                let field_name = if prefix.is_empty() {
                    key.clone()
                } else {
                    format!("{}.{}", prefix, key)
                };

                let field_type = FieldType::from_json_value(val);

                // Get or create field schema
                let field_schema = schema_map
                    .entry(field_name.clone())
                    .or_insert_with(|| FieldSchema::new(field_name.clone()));

                // Record type
                field_schema.record_type(field_type);

                // Update constraints based on type
                match val {
                    serde_json::Value::String(s) => {
                        let pattern = detect_pattern(s);
                        field_schema.update_string_constraints(s.len() as u32, pattern);
                    }
                    serde_json::Value::Number(n) => {
                        if let Some(f) = n.as_f64() {
                            field_schema.update_number_constraints(f);
                        }
                    }
                    serde_json::Value::Array(arr) => {
                        for item in arr {
                            let item_type = FieldType::from_json_value(item);
                            field_schema.add_array_item_type(item_type);
                        }
                    }
                    serde_json::Value::Object(_) => {
                        // Initialize nested object schema if needed
                        if field_schema.object_schema.is_none() {
                            field_schema.object_schema = Some(HashMap::new());
                        }
                        // Collect for recursion (single pass optimization)
                        nested_objects.push((field_name, val));
                    }
                    _ => {}
                }
            }
            // schema_guard dropped here at end of block
        }

        // Recurse into nested objects (guard already dropped)
        for (field_name, val) in nested_objects {
            self.update_schema_fields(template, val, target, &field_name, depth + 1);
        }
    }

    // ========================================================================
    // Validation
    // ========================================================================

    /// Validate a request body against the learned schema.
    ///
    /// Returns a list of violations. Empty list means validation passed.
    /// Returns empty if schema doesn't exist or has insufficient samples.
    pub fn validate_request(
        &self,
        template: &str,
        request_body: &serde_json::Value,
    ) -> ValidationResult {
        self.validate_internal(template, request_body, SchemaTarget::Request)
    }

    /// Validate a response body against the learned schema.
    pub fn validate_response(
        &self,
        template: &str,
        response_body: &serde_json::Value,
    ) -> ValidationResult {
        self.validate_internal(template, response_body, SchemaTarget::Response)
    }

    /// Internal validation implementation.
    fn validate_internal(
        &self,
        template: &str,
        body: &serde_json::Value,
        target: SchemaTarget,
    ) -> ValidationResult {
        let mut result = ValidationResult::new();

        let schema = match self.schemas.get(template) {
            Some(s) => s,
            None => return result, // No schema = no validation
        };

        // Skip validation if insufficient samples
        if schema.sample_count < self.config.min_samples_for_validation {
            return result;
        }

        let schema_map = match target {
            SchemaTarget::Request => &schema.request_schema,
            SchemaTarget::Response => &schema.response_schema,
        };

        self.validate_against_schema(
            schema_map,
            body,
            "",
            &mut result,
            schema.sample_count,
        );

        result
    }

    /// Validate data against a schema map.
    fn validate_against_schema(
        &self,
        schema_map: &HashMap<String, FieldSchema>,
        data: &serde_json::Value,
        prefix: &str,
        result: &mut ValidationResult,
        sample_count: u32,
    ) {
        let obj = match data.as_object() {
            Some(o) => o,
            None => return,
        };

        // Check for unexpected fields
        for (key, val) in obj {
            let field_name = if prefix.is_empty() {
                key.clone()
            } else {
                format!("{}.{}", prefix, key)
            };

            let field_schema = match schema_map.get(&field_name) {
                Some(s) => s,
                None => {
                    result.add(SchemaViolation::unexpected_field(&field_name));
                    continue;
                }
            };

            let actual_type = FieldType::from_json_value(val);

            // Type mismatch check
            let dominant_type = field_schema.dominant_type();
            if actual_type != dominant_type
                && !(val.is_null() && field_schema.nullable)
            {
                result.add(SchemaViolation::type_mismatch(
                    &field_name,
                    dominant_type,
                    actual_type,
                ));
            }

            // String constraint checks
            if let serde_json::Value::String(s) = val {
                self.validate_string_field(&field_name, s, field_schema, result);
            }

            // Number constraint checks
            if let serde_json::Value::Number(n) = val {
                if let Some(f) = n.as_f64() {
                    self.validate_number_field(&field_name, f, field_schema, result);
                }
            }

            // Recurse into nested objects
            if val.is_object() {
                if let Some(nested_schema) = &field_schema.object_schema {
                    self.validate_against_schema(
                        nested_schema,
                        val,
                        &field_name,
                        result,
                        sample_count,
                    );
                }
            }
        }

        // Check for missing required fields (seen in >90% of samples)
        let threshold = (sample_count as f64 * self.config.required_field_threshold) as u32;
        for (field_name, field_schema) in schema_map {
            // Only check top-level fields from this prefix
            let expected_prefix = if prefix.is_empty() {
                !field_name.contains('.')
            } else {
                field_name.starts_with(prefix)
                    && field_name[prefix.len()..].chars().filter(|&c| c == '.').count() == 1
            };

            if expected_prefix && field_schema.seen_count >= threshold {
                let key = field_name.rsplit('.').next().unwrap_or(field_name);
                if !obj.contains_key(key) {
                    result.add(SchemaViolation::missing_field(field_name));
                }
            }
        }
    }

    /// Validate string field constraints.
    fn validate_string_field(
        &self,
        field_name: &str,
        value: &str,
        schema: &FieldSchema,
        result: &mut ValidationResult,
    ) {
        let len = value.len() as u32;

        // Length too short
        if let Some(min) = schema.min_length {
            if len < min {
                result.add(SchemaViolation::string_too_short(field_name, min, len));
            }
        }

        // Length too long (with tolerance)
        if let Some(max) = schema.max_length {
            let allowed_max = (max as f64 * self.config.string_length_tolerance) as u32;
            if len > allowed_max {
                result.add(SchemaViolation::string_too_long(field_name, allowed_max, len));
            }
        }

        // Pattern mismatch
        if let Some(expected_pattern) = schema.pattern {
            let actual_pattern = detect_pattern(value);
            if actual_pattern != Some(expected_pattern) {
                result.add(SchemaViolation::pattern_mismatch(
                    field_name,
                    expected_pattern,
                    actual_pattern,
                ));
            }
        }
    }

    /// Validate number field constraints.
    fn validate_number_field(
        &self,
        field_name: &str,
        value: f64,
        schema: &FieldSchema,
        result: &mut ValidationResult,
    ) {
        // Value too small (with tolerance)
        if let Some(min) = schema.min_value {
            let allowed_min = min * (1.0 / self.config.number_value_tolerance);
            if value < allowed_min {
                result.add(SchemaViolation::number_too_small(field_name, allowed_min, value));
            }
        }

        // Value too large (with tolerance)
        if let Some(max) = schema.max_value {
            let allowed_max = max * self.config.number_value_tolerance;
            if value > allowed_max {
                result.add(SchemaViolation::number_too_large(field_name, allowed_max, value));
            }
        }
    }

    // ========================================================================
    // Schema Access
    // ========================================================================

    /// Get schema for an endpoint.
    pub fn get_schema(&self, template: &str) -> Option<EndpointSchema> {
        self.schemas.get(template).map(|s| s.value().clone())
    }

    /// Get all schemas.
    pub fn get_all_schemas(&self) -> Vec<EndpointSchema> {
        self.schemas
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Get statistics.
    pub fn get_stats(&self) -> SchemaLearnerStats {
        let schemas: Vec<_> = self.schemas.iter().collect();
        let total_samples: u32 = schemas.iter().map(|s| s.sample_count).sum();
        let total_fields: usize = schemas
            .iter()
            .map(|s| s.request_schema.len() + s.response_schema.len())
            .sum();

        SchemaLearnerStats {
            total_schemas: schemas.len(),
            total_samples,
            avg_fields_per_endpoint: if schemas.is_empty() {
                0.0
            } else {
                total_fields as f64 / schemas.len() as f64
            },
        }
    }

    // ========================================================================
    // Persistence
    // ========================================================================

    /// Export all schemas for persistence.
    pub fn export(&self) -> Vec<EndpointSchema> {
        self.get_all_schemas()
    }

    /// Import schemas from persistence.
    pub fn import(&self, schemas: Vec<EndpointSchema>) {
        self.schemas.clear();
        for schema in schemas {
            self.schemas.insert(schema.template.clone(), schema);
        }
    }

    /// Clear all schemas.
    pub fn clear(&self) {
        self.schemas.clear();
    }
}

// ============================================================================
// Helper Types
// ============================================================================

/// Target schema (request or response).
#[derive(Debug, Clone, Copy)]
enum SchemaTarget {
    Request,
    Response,
}

/// Statistics about the schema learner.
#[derive(Debug, Clone, Serialize)]
pub struct SchemaLearnerStats {
    /// Total number of endpoint schemas
    pub total_schemas: usize,
    /// Total samples across all schemas
    pub total_samples: u32,
    /// Average fields per endpoint
    pub avg_fields_per_endpoint: f64,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profiler::schema_types::{PatternType, ViolationType};
    use serde_json::json;

    #[test]
    fn test_learn_from_request() {
        let learner = SchemaLearner::new();

        let body = json!({
            "username": "john_doe",
            "email": "john@example.com",
            "age": 30
        });

        learner.learn_from_request("/api/users", &body);

        let schema = learner.get_schema("/api/users").unwrap();
        assert_eq!(schema.sample_count, 1);
        assert!(schema.request_schema.contains_key("username"));
        assert!(schema.request_schema.contains_key("email"));
        assert!(schema.request_schema.contains_key("age"));
    }

    #[test]
    fn test_learn_type_tracking() {
        let learner = SchemaLearner::new();

        // Learn multiple requests with same field types
        for i in 0..10 {
            let body = json!({
                "id": i,
                "name": format!("user_{}", i)
            });
            learner.learn_from_request("/api/users", &body);
        }

        let schema = learner.get_schema("/api/users").unwrap();
        let id_schema = schema.request_schema.get("id").unwrap();
        let name_schema = schema.request_schema.get("name").unwrap();

        assert_eq!(id_schema.dominant_type(), FieldType::Number);
        assert_eq!(name_schema.dominant_type(), FieldType::String);
        assert_eq!(id_schema.seen_count, 10);
    }

    #[test]
    fn test_learn_string_constraints() {
        let learner = SchemaLearner::new();

        let bodies = vec![
            json!({"name": "ab"}),     // 2 chars
            json!({"name": "abcdef"}), // 6 chars
            json!({"name": "abcd"}),   // 4 chars
        ];

        for body in bodies {
            learner.learn_from_request("/api/test", &body);
        }

        let schema = learner.get_schema("/api/test").unwrap();
        let name_schema = schema.request_schema.get("name").unwrap();

        assert_eq!(name_schema.min_length, Some(2));
        assert_eq!(name_schema.max_length, Some(6));
    }

    #[test]
    fn test_learn_pattern_detection() {
        let learner = SchemaLearner::new();

        let body = json!({
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "user@example.com"
        });

        learner.learn_from_request("/api/users", &body);

        let schema = learner.get_schema("/api/users").unwrap();
        let id_schema = schema.request_schema.get("id").unwrap();
        let email_schema = schema.request_schema.get("email").unwrap();

        assert_eq!(id_schema.pattern, Some(PatternType::Uuid));
        assert_eq!(email_schema.pattern, Some(PatternType::Email));
    }

    #[test]
    fn test_learn_nested_objects() {
        let learner = SchemaLearner::new();

        let body = json!({
            "user": {
                "name": "John",
                "address": {
                    "city": "NYC"
                }
            }
        });

        learner.learn_from_request("/api/data", &body);

        let schema = learner.get_schema("/api/data").unwrap();
        assert!(schema.request_schema.contains_key("user"));
        assert!(schema.request_schema.contains_key("user.name"));
        assert!(schema.request_schema.contains_key("user.address"));
        assert!(schema.request_schema.contains_key("user.address.city"));
    }

    #[test]
    fn test_validate_unexpected_field() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            min_samples_for_validation: 5,
            ..Default::default()
        });

        // Train with known fields
        for _ in 0..10 {
            learner.learn_from_request("/api/users", &json!({"name": "test"}));
        }

        // Validate with unexpected field
        let result = learner.validate_request("/api/users", &json!({"name": "test", "malicious": "value"}));

        assert!(!result.is_valid());
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::UnexpectedField));
    }

    #[test]
    fn test_validate_type_mismatch() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            min_samples_for_validation: 5,
            ..Default::default()
        });

        // Train with number type
        for i in 0..10 {
            learner.learn_from_request("/api/users", &json!({"id": i}));
        }

        // Validate with string type
        let result = learner.validate_request("/api/users", &json!({"id": "not_a_number"}));

        assert!(!result.is_valid());
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::TypeMismatch));
    }

    #[test]
    fn test_validate_string_too_long() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            min_samples_for_validation: 5,
            string_length_tolerance: 2.0,
            ..Default::default()
        });

        // Train with short strings
        for _ in 0..10 {
            learner.learn_from_request("/api/users", &json!({"name": "john"})); // 4 chars
        }

        // Validate with very long string (> 4 * 2 = 8 chars)
        let long_name = "a".repeat(20);
        let result = learner.validate_request("/api/users", &json!({"name": long_name}));

        assert!(!result.is_valid());
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::StringTooLong));
    }

    #[test]
    fn test_validate_pattern_mismatch() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            min_samples_for_validation: 5,
            ..Default::default()
        });

        // Train with UUID pattern
        for _ in 0..10 {
            learner.learn_from_request(
                "/api/users",
                &json!({"id": "550e8400-e29b-41d4-a716-446655440000"}),
            );
        }

        // Validate with non-UUID
        let result = learner.validate_request("/api/users", &json!({"id": "not-a-uuid-value"}));

        assert!(!result.is_valid());
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::PatternMismatch));
    }

    #[test]
    fn test_validate_insufficient_samples() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            min_samples_for_validation: 10,
            ..Default::default()
        });

        // Train with only 5 samples
        for _ in 0..5 {
            learner.learn_from_request("/api/users", &json!({"name": "test"}));
        }

        // Validation should pass (no enforcement) because insufficient samples
        let result = learner.validate_request("/api/users", &json!({"malicious": "field"}));
        assert!(result.is_valid());
    }

    #[test]
    fn test_lru_eviction() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            max_schemas: 3,
            ..Default::default()
        });

        // Add 4 schemas (exceeds max of 3)
        learner.learn_from_request("/api/users", &json!({"a": 1}));
        std::thread::sleep(std::time::Duration::from_millis(10));
        learner.learn_from_request("/api/orders", &json!({"b": 2}));
        std::thread::sleep(std::time::Duration::from_millis(10));
        learner.learn_from_request("/api/products", &json!({"c": 3}));
        std::thread::sleep(std::time::Duration::from_millis(10));
        learner.learn_from_request("/api/inventory", &json!({"d": 4}));

        // Should have evicted oldest (users)
        assert_eq!(learner.len(), 3);
        assert!(learner.get_schema("/api/users").is_none());
        assert!(learner.get_schema("/api/orders").is_some());
    }

    #[test]
    fn test_stats() {
        let learner = SchemaLearner::new();

        for i in 0..10 {
            learner.learn_from_request("/api/users", &json!({"id": i, "name": "test"}));
        }
        for i in 0..5 {
            learner.learn_from_request("/api/orders", &json!({"order_id": i}));
        }

        let stats = learner.get_stats();
        assert_eq!(stats.total_schemas, 2);
        assert_eq!(stats.total_samples, 15);
        assert!(stats.avg_fields_per_endpoint > 0.0);
    }

    #[test]
    fn test_export_import() {
        let learner = SchemaLearner::new();

        learner.learn_from_request("/api/users", &json!({"id": 1, "name": "test"}));
        learner.learn_from_request("/api/orders", &json!({"order_id": 100}));

        let exported = learner.export();
        assert_eq!(exported.len(), 2);

        // Import into new learner
        let learner2 = SchemaLearner::new();
        learner2.import(exported);

        assert_eq!(learner2.len(), 2);
        assert!(learner2.get_schema("/api/users").is_some());
        assert!(learner2.get_schema("/api/orders").is_some());
    }

    #[test]
    fn test_nullable_fields() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            min_samples_for_validation: 5,
            ..Default::default()
        });

        // Train with mix of null and non-null
        for i in 0..10 {
            let body = if i % 2 == 0 {
                json!({"name": "test"})
            } else {
                json!({"name": null})
            };
            learner.learn_from_request("/api/users", &body);
        }

        let schema = learner.get_schema("/api/users").unwrap();
        let name_schema = schema.request_schema.get("name").unwrap();
        assert!(name_schema.nullable);

        // Validate null value (should pass because field is nullable)
        let result = learner.validate_request("/api/users", &json!({"name": null}));
        // Type mismatch should not fire for nullable fields with null value
        assert!(!result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::TypeMismatch && v.field == "name"));
    }

    #[test]
    fn test_array_item_types() {
        let learner = SchemaLearner::new();

        let body = json!({
            "tags": ["tag1", "tag2"],
            "numbers": [1, 2, 3]
        });

        learner.learn_from_request("/api/items", &body);

        let schema = learner.get_schema("/api/items").unwrap();
        let tags_schema = schema.request_schema.get("tags").unwrap();
        let numbers_schema = schema.request_schema.get("numbers").unwrap();

        assert!(tags_schema
            .array_item_types
            .as_ref()
            .unwrap()
            .contains(&FieldType::String));
        assert!(numbers_schema
            .array_item_types
            .as_ref()
            .unwrap()
            .contains(&FieldType::Number));
    }

    #[test]
    fn test_validate_missing_required_field() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            min_samples_for_validation: 5,
            required_field_threshold: 0.9,
            ..Default::default()
        });

        // Train with consistent fields - name and id present in all samples
        for i in 0..10 {
            learner.learn_from_request("/api/users", &json!({"id": i, "name": "test"}));
        }

        // Validate with missing required field "name"
        let result = learner.validate_request("/api/users", &json!({"id": 1}));

        assert!(!result.is_valid());
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::MissingField && v.field == "name"));
    }

    #[test]
    fn test_validate_number_constraints() {
        let learner = SchemaLearner::with_config(SchemaLearnerConfig {
            min_samples_for_validation: 5,
            number_value_tolerance: 2.0,
            ..Default::default()
        });

        // Train with numbers in range 10-100
        for i in 0..10 {
            learner.learn_from_request("/api/items", &json!({"price": 10 + i * 10}));
        }

        // Value too large (> 100 * 2 = 200)
        let result = learner.validate_request("/api/items", &json!({"price": 500}));
        assert!(!result.is_valid());
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::NumberTooLarge));

        // Value too small (< 10 * 0.5 = 5)
        let result = learner.validate_request("/api/items", &json!({"price": 1}));
        assert!(!result.is_valid());
        assert!(result
            .violations
            .iter()
            .any(|v| v.violation_type == ViolationType::NumberTooSmall));
    }
}

//! Comprehensive tests for SchemaLearner.
//!
//! Tests cover:
//! - Configuration and initialization
//! - Learning from request/response bodies
//! - Type inference and tracking
//! - String and number constraint learning
//! - Pattern detection (UUID, email, JWT, etc.)
//! - Nested object learning with depth limits
//! - Schema validation with violations
//! - LRU eviction behavior
//! - Concurrent access patterns
//! - Export/import persistence
//! - Edge cases and error conditions

use std::sync::Arc;
use std::thread;

use serde_json::json;
use synapse_pingora::profiler::schema_types::{
    EndpointSchema, FieldSchema, FieldType, PatternType, ViolationType,
};
use synapse_pingora::profiler::{SchemaLearner, SchemaLearnerConfig, SchemaLearnerStats};

// ============================================================================
// Configuration Tests
// ============================================================================

#[test]
fn test_schema_learner_default_config() {
    let learner = SchemaLearner::new();
    let config = learner.config();

    assert_eq!(config.max_schemas, 5000);
    assert_eq!(config.min_samples_for_validation, 10);
    assert_eq!(config.max_nesting_depth, 10);
    assert_eq!(config.max_fields_per_schema, 100);
    assert!((config.string_length_tolerance - 1.5).abs() < f64::EPSILON);
    assert!((config.number_value_tolerance - 1.5).abs() < f64::EPSILON);
    assert!((config.required_field_threshold - 0.9).abs() < f64::EPSILON);
}

#[test]
fn test_schema_learner_custom_config() {
    let config = SchemaLearnerConfig {
        max_schemas: 100,
        min_samples_for_validation: 5,
        max_nesting_depth: 3,
        max_fields_per_schema: 20,
        string_length_tolerance: 1.5,
        number_value_tolerance: 1.5,
        required_field_threshold: 0.8,
    };
    let learner = SchemaLearner::with_config(config.clone());

    assert_eq!(learner.config().max_schemas, 100);
    assert_eq!(learner.config().min_samples_for_validation, 5);
    assert_eq!(learner.config().max_nesting_depth, 3);
}

#[test]
fn test_schema_learner_initial_state() {
    let learner = SchemaLearner::new();

    assert!(learner.is_empty());
    assert_eq!(learner.len(), 0);
    assert!(learner.get_schema("/api/nonexistent").is_none());
    assert!(learner.get_all_schemas().is_empty());
}

// ============================================================================
// Basic Learning Tests
// ============================================================================

#[test]
fn test_learn_from_empty_object() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/empty", &json!({}));

    let schema = learner.get_schema("/api/empty").unwrap();
    assert_eq!(schema.sample_count, 1);
    assert!(schema.request_schema.is_empty());
}

#[test]
fn test_learn_from_non_object_ignored() {
    let learner = SchemaLearner::new();

    // Arrays and primitives should be ignored
    learner.learn_from_request("/api/array", &json!([1, 2, 3]));
    learner.learn_from_request("/api/string", &json!("just a string"));
    learner.learn_from_request("/api/number", &json!(42));
    learner.learn_from_request("/api/null", &json!(null));

    assert!(learner.is_empty());
}

#[test]
fn test_learn_single_field_types() {
    let learner = SchemaLearner::new();

    let body = json!({
        "string_field": "hello",
        "number_field": 42,
        "float_field": 3.14,
        "bool_field": true,
        "null_field": null,
        "array_field": [1, 2, 3],
        "object_field": {"nested": "value"}
    });

    learner.learn_from_request("/api/types", &body);

    let schema = learner.get_schema("/api/types").unwrap();

    assert_eq!(
        schema
            .request_schema
            .get("string_field")
            .unwrap()
            .dominant_type(),
        FieldType::String
    );
    assert_eq!(
        schema
            .request_schema
            .get("number_field")
            .unwrap()
            .dominant_type(),
        FieldType::Number
    );
    assert_eq!(
        schema
            .request_schema
            .get("float_field")
            .unwrap()
            .dominant_type(),
        FieldType::Number
    );
    assert_eq!(
        schema
            .request_schema
            .get("bool_field")
            .unwrap()
            .dominant_type(),
        FieldType::Boolean
    );
    assert_eq!(
        schema
            .request_schema
            .get("null_field")
            .unwrap()
            .dominant_type(),
        FieldType::Null
    );
    assert_eq!(
        schema
            .request_schema
            .get("array_field")
            .unwrap()
            .dominant_type(),
        FieldType::Array
    );
    assert_eq!(
        schema
            .request_schema
            .get("object_field")
            .unwrap()
            .dominant_type(),
        FieldType::Object
    );
}

#[test]
fn test_learn_response_separately() {
    let learner = SchemaLearner::new();

    let request = json!({"username": "john"});
    let response = json!({"user_id": 123, "created_at": "2024-01-01"});

    learner.learn_from_request("/api/users", &request);
    learner.learn_from_response("/api/users", &response);

    let schema = learner.get_schema("/api/users").unwrap();

    // Request schema should have username
    assert!(schema.request_schema.contains_key("username"));
    assert!(!schema.request_schema.contains_key("user_id"));

    // Response schema should have user_id and created_at
    assert!(schema.response_schema.contains_key("user_id"));
    assert!(schema.response_schema.contains_key("created_at"));
    assert!(!schema.response_schema.contains_key("username"));
}

#[test]
fn test_learn_from_pair() {
    let learner = SchemaLearner::new();

    let request = json!({"query": "search term"});
    let response = json!({"results": [1, 2, 3], "total": 100});

    learner.learn_from_pair("/api/search", Some(&request), Some(&response));

    let schema = learner.get_schema("/api/search").unwrap();
    assert_eq!(schema.sample_count, 1);
    assert!(schema.request_schema.contains_key("query"));
    assert!(schema.response_schema.contains_key("results"));
    assert!(schema.response_schema.contains_key("total"));
}

#[test]
fn test_learn_from_pair_request_only() {
    let learner = SchemaLearner::new();

    let request = json!({"data": "value"});

    learner.learn_from_pair("/api/endpoint", Some(&request), None);

    let schema = learner.get_schema("/api/endpoint").unwrap();
    assert!(schema.request_schema.contains_key("data"));
    assert!(schema.response_schema.is_empty());
}

// ============================================================================
// String Constraint Learning Tests
// ============================================================================

#[test]
fn test_learn_string_min_max_length() {
    let learner = SchemaLearner::new();

    // Learn strings of varying lengths
    learner.learn_from_request("/api/test", &json!({"name": "ab"})); // 2 chars
    learner.learn_from_request("/api/test", &json!({"name": "abcdefgh"})); // 8 chars
    learner.learn_from_request("/api/test", &json!({"name": "abcd"})); // 4 chars

    let schema = learner.get_schema("/api/test").unwrap();
    let name_schema = schema.request_schema.get("name").unwrap();

    assert_eq!(name_schema.min_length, Some(2));
    assert_eq!(name_schema.max_length, Some(8));
}

#[test]
fn test_learn_empty_string() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"field": ""}));

    let schema = learner.get_schema("/api/test").unwrap();
    let field_schema = schema.request_schema.get("field").unwrap();

    assert_eq!(field_schema.min_length, Some(0));
    assert_eq!(field_schema.max_length, Some(0));
}

#[test]
fn test_learn_unicode_string_length() {
    let learner = SchemaLearner::new();

    // Unicode characters: each emoji is multiple bytes but we count chars
    learner.learn_from_request("/api/test", &json!({"text": "hello"})); // 5 chars

    let schema = learner.get_schema("/api/test").unwrap();
    let text_schema = schema.request_schema.get("text").unwrap();

    // Length should be character count, not byte count
    assert_eq!(text_schema.max_length, Some(5));
}

// ============================================================================
// Number Constraint Learning Tests
// ============================================================================

#[test]
fn test_learn_number_min_max() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"value": 10}));
    learner.learn_from_request("/api/test", &json!({"value": 50}));
    learner.learn_from_request("/api/test", &json!({"value": 100}));

    let schema = learner.get_schema("/api/test").unwrap();
    let value_schema = schema.request_schema.get("value").unwrap();

    assert_eq!(value_schema.min_value, Some(10.0));
    assert_eq!(value_schema.max_value, Some(100.0));
}

#[test]
fn test_learn_negative_numbers() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"value": -100}));
    learner.learn_from_request("/api/test", &json!({"value": -50}));
    learner.learn_from_request("/api/test", &json!({"value": 0}));

    let schema = learner.get_schema("/api/test").unwrap();
    let value_schema = schema.request_schema.get("value").unwrap();

    assert_eq!(value_schema.min_value, Some(-100.0));
    assert_eq!(value_schema.max_value, Some(0.0));
}

#[test]
fn test_learn_floating_point() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"price": 9.99}));
    learner.learn_from_request("/api/test", &json!({"price": 19.99}));
    learner.learn_from_request("/api/test", &json!({"price": 29.99}));

    let schema = learner.get_schema("/api/test").unwrap();
    let price_schema = schema.request_schema.get("price").unwrap();

    assert!((price_schema.min_value.unwrap() - 9.99).abs() < 0.001);
    assert!((price_schema.max_value.unwrap() - 29.99).abs() < 0.001);
}

// ============================================================================
// Pattern Detection Tests
// ============================================================================

#[test]
fn test_learn_uuid_pattern() {
    let learner = SchemaLearner::new();

    learner.learn_from_request(
        "/api/test",
        &json!({"id": "550e8400-e29b-41d4-a716-446655440000"}),
    );

    let schema = learner.get_schema("/api/test").unwrap();
    let id_schema = schema.request_schema.get("id").unwrap();

    assert_eq!(id_schema.pattern, Some(PatternType::Uuid));
}

#[test]
fn test_learn_email_pattern() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"email": "user@example.com"}));

    let schema = learner.get_schema("/api/test").unwrap();
    let email_schema = schema.request_schema.get("email").unwrap();

    assert_eq!(email_schema.pattern, Some(PatternType::Email));
}

#[test]
fn test_learn_jwt_pattern() {
    let learner = SchemaLearner::new();

    // Standard JWT format: header.payload.signature (base64 encoded)
    let jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    learner.learn_from_request("/api/test", &json!({"token": jwt}));

    let schema = learner.get_schema("/api/test").unwrap();
    let token_schema = schema.request_schema.get("token").unwrap();

    assert_eq!(token_schema.pattern, Some(PatternType::Jwt));
}

#[test]
fn test_learn_ipv4_pattern() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"ip": "192.168.1.1"}));

    let schema = learner.get_schema("/api/test").unwrap();
    let ip_schema = schema.request_schema.get("ip").unwrap();

    assert_eq!(ip_schema.pattern, Some(PatternType::Ipv4));
}

#[test]
fn test_learn_ipv6_pattern() {
    let learner = SchemaLearner::new();

    learner.learn_from_request(
        "/api/test",
        &json!({"ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334"}),
    );

    let schema = learner.get_schema("/api/test").unwrap();
    let ip_schema = schema.request_schema.get("ip").unwrap();

    assert_eq!(ip_schema.pattern, Some(PatternType::Ipv6));
}

#[test]
fn test_learn_url_pattern() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"website": "https://example.com/path"}));

    let schema = learner.get_schema("/api/test").unwrap();
    let url_schema = schema.request_schema.get("website").unwrap();

    assert_eq!(url_schema.pattern, Some(PatternType::Url));
}

#[test]
fn test_learn_iso_date_pattern() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"created": "2024-01-15T10:30:00Z"}));

    let schema = learner.get_schema("/api/test").unwrap();
    let date_schema = schema.request_schema.get("created").unwrap();

    assert_eq!(date_schema.pattern, Some(PatternType::IsoDate));
}

// ============================================================================
// Nested Object Learning Tests
// ============================================================================

#[test]
fn test_learn_single_level_nesting() {
    let learner = SchemaLearner::new();

    let body = json!({
        "user": {
            "name": "John",
            "age": 30
        }
    });

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();

    assert!(schema.request_schema.contains_key("user"));
    assert!(schema.request_schema.contains_key("user.name"));
    assert!(schema.request_schema.contains_key("user.age"));
}

#[test]
fn test_learn_deep_nesting() {
    let learner = SchemaLearner::new();

    let body = json!({
        "level1": {
            "level2": {
                "level3": {
                    "level4": {
                        "value": "deep"
                    }
                }
            }
        }
    });

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();

    assert!(schema
        .request_schema
        .contains_key("level1.level2.level3.level4.value"));
}

#[test]
fn test_max_nesting_depth_enforced() {
    let config = SchemaLearnerConfig {
        max_nesting_depth: 2,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    let body = json!({
        "l1": {
            "l2": {
                "l3": {
                    "l4": "too deep"
                }
            }
        }
    });

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();

    // Should stop at depth 2
    assert!(schema.request_schema.contains_key("l1"));
    assert!(schema.request_schema.contains_key("l1.l2"));
    // l3 and beyond should not be tracked (depth > 2)
    assert!(!schema.request_schema.contains_key("l1.l2.l3"));
    assert!(!schema.request_schema.contains_key("l1.l2.l3.l4"));
}

// ============================================================================
// Array Learning Tests
// ============================================================================

#[test]
fn test_learn_homogeneous_array() {
    let learner = SchemaLearner::new();

    let body = json!({
        "numbers": [1, 2, 3, 4, 5],
        "strings": ["a", "b", "c"]
    });

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();
    let numbers_schema = schema.request_schema.get("numbers").unwrap();
    let strings_schema = schema.request_schema.get("strings").unwrap();

    assert!(numbers_schema
        .array_item_types
        .as_ref()
        .unwrap()
        .contains(&FieldType::Number));
    assert!(strings_schema
        .array_item_types
        .as_ref()
        .unwrap()
        .contains(&FieldType::String));
}

#[test]
fn test_learn_heterogeneous_array() {
    let learner = SchemaLearner::new();

    let body = json!({
        "mixed": [1, "two", true, null]
    });

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();
    let mixed_schema = schema.request_schema.get("mixed").unwrap();

    let item_types = mixed_schema.array_item_types.as_ref().unwrap();
    assert!(item_types.contains(&FieldType::Number));
    assert!(item_types.contains(&FieldType::String));
    assert!(item_types.contains(&FieldType::Boolean));
    assert!(item_types.contains(&FieldType::Null));
}

#[test]
fn test_learn_empty_array() {
    let learner = SchemaLearner::new();

    let body = json!({
        "empty": []
    });

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();
    let empty_schema = schema.request_schema.get("empty").unwrap();

    assert_eq!(empty_schema.dominant_type(), FieldType::Array);
    // Empty array should have no item types recorded
    assert!(
        empty_schema.array_item_types.is_none()
            || empty_schema.array_item_types.as_ref().unwrap().is_empty()
    );
}

// ============================================================================
// Nullable Field Tests
// ============================================================================

#[test]
fn test_learn_nullable_field() {
    let learner = SchemaLearner::new();

    // Alternate between value and null
    for i in 0..10 {
        if i % 2 == 0 {
            learner.learn_from_request("/api/test", &json!({"field": "value"}));
        } else {
            learner.learn_from_request("/api/test", &json!({"field": null}));
        }
    }

    let schema = learner.get_schema("/api/test").unwrap();
    let field_schema = schema.request_schema.get("field").unwrap();

    assert!(field_schema.nullable);
}

#[test]
fn test_learn_always_null_field() {
    let learner = SchemaLearner::new();

    for _ in 0..5 {
        learner.learn_from_request("/api/test", &json!({"field": null}));
    }

    let schema = learner.get_schema("/api/test").unwrap();
    let field_schema = schema.request_schema.get("field").unwrap();

    assert_eq!(field_schema.dominant_type(), FieldType::Null);
    assert!(field_schema.nullable);
}

// ============================================================================
// Validation Tests
// ============================================================================

#[test]
fn test_validate_no_schema_returns_valid() {
    let learner = SchemaLearner::new();

    let result = learner.validate_request("/api/unknown", &json!({"any": "data"}));

    assert!(result.is_valid());
    assert!(result.violations.is_empty());
}

#[test]
fn test_validate_insufficient_samples_returns_valid() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 10,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Only learn 5 samples (less than threshold of 10)
    for _ in 0..5 {
        learner.learn_from_request("/api/test", &json!({"field": "value"}));
    }

    // Should pass validation because not enough samples
    let result = learner.validate_request("/api/test", &json!({"unexpected": "field"}));
    assert!(result.is_valid());
}

#[test]
fn test_validate_unexpected_field() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn known fields
    for _ in 0..10 {
        learner.learn_from_request("/api/test", &json!({"name": "test", "age": 25}));
    }

    // Validate with unexpected field
    let result = learner.validate_request(
        "/api/test",
        &json!({"name": "test", "age": 25, "malicious": "payload"}),
    );

    assert!(!result.is_valid());
    assert!(result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::UnexpectedField && v.field == "malicious" }));
}

#[test]
fn test_validate_type_mismatch() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn number type
    for i in 0..10 {
        learner.learn_from_request("/api/test", &json!({"id": i}));
    }

    // Validate with string type
    let result = learner.validate_request("/api/test", &json!({"id": "not_a_number"}));

    assert!(!result.is_valid());
    assert!(result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::TypeMismatch && v.field == "id" }));
}

#[test]
fn test_validate_string_too_long() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        string_length_tolerance: 2.0, // Allow up to 2x learned max
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn strings of max 10 chars
    for _ in 0..10 {
        learner.learn_from_request("/api/test", &json!({"name": "0123456789"}));
        // 10 chars
    }

    // String of 25 chars > 10 * 2 = 20 allowed
    let long_name = "a".repeat(25);
    let result = learner.validate_request("/api/test", &json!({"name": long_name}));

    assert!(!result.is_valid());
    assert!(result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::StringTooLong && v.field == "name" }));
}

#[test]
fn test_validate_string_within_tolerance() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        string_length_tolerance: 2.0,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn strings of max 10 chars
    for _ in 0..10 {
        learner.learn_from_request("/api/test", &json!({"name": "0123456789"}));
        // 10 chars
    }

    // String of 15 chars <= 10 * 2 = 20 allowed (within tolerance)
    let name = "a".repeat(15);
    let result = learner.validate_request("/api/test", &json!({"name": name}));

    // Should NOT have StringTooLong violation
    assert!(!result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::StringTooLong }));
}

#[test]
fn test_validate_number_too_large() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        number_value_tolerance: 2.0,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn numbers up to 100
    for i in 0..10 {
        learner.learn_from_request("/api/test", &json!({"value": 10 + i * 10}));
        // 10-100
    }

    // Value of 300 > 100 * 2 = 200 allowed
    let result = learner.validate_request("/api/test", &json!({"value": 300}));

    assert!(!result.is_valid());
    assert!(result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::NumberTooLarge && v.field == "value" }));
}

#[test]
fn test_validate_number_too_small() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        number_value_tolerance: 2.0, // min_allowed = min * (1/2) = min * 0.5
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn numbers starting at 100
    for i in 0..10 {
        learner.learn_from_request("/api/test", &json!({"value": 100 + i * 10}));
        // 100-190
    }

    // Value of 10 < 100 * 0.5 = 50 allowed min
    let result = learner.validate_request("/api/test", &json!({"value": 10}));

    assert!(!result.is_valid());
    assert!(result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::NumberTooSmall && v.field == "value" }));
}

#[test]
fn test_validate_pattern_mismatch() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn UUID pattern
    for _ in 0..10 {
        learner.learn_from_request(
            "/api/test",
            &json!({"id": "550e8400-e29b-41d4-a716-446655440000"}),
        );
    }

    // Validate with non-UUID
    let result = learner.validate_request("/api/test", &json!({"id": "not-a-uuid-12345"}));

    assert!(!result.is_valid());
    assert!(result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::PatternMismatch && v.field == "id" }));
}

#[test]
fn test_validate_missing_required_field() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        required_field_threshold: 0.9, // Fields in >90% of samples are required
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn with required fields present in all samples
    for i in 0..10 {
        learner.learn_from_request(
            "/api/test",
            &json!({"id": i, "name": "user", "email": "test@example.com"}),
        );
    }

    // Validate without required field "name"
    let result =
        learner.validate_request("/api/test", &json!({"id": 1, "email": "test@example.com"}));

    assert!(!result.is_valid());
    assert!(result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::MissingField && v.field == "name" }));
}

#[test]
fn test_validate_nullable_field_accepts_null() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Learn with mix of values and nulls
    for i in 0..10 {
        if i % 2 == 0 {
            learner.learn_from_request("/api/test", &json!({"field": "value"}));
        } else {
            learner.learn_from_request("/api/test", &json!({"field": null}));
        }
    }

    // Validate with null (should not trigger type mismatch)
    let result = learner.validate_request("/api/test", &json!({"field": null}));

    // Should not have TypeMismatch for the nullable field
    assert!(!result
        .violations
        .iter()
        .any(|v| { v.violation_type == ViolationType::TypeMismatch && v.field == "field" }));
}

// ============================================================================
// LRU Eviction Tests
// ============================================================================

#[test]
fn test_lru_eviction_at_capacity() {
    let config = SchemaLearnerConfig {
        max_schemas: 3,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Add schemas with delays to ensure different timestamps
    learner.learn_from_request("/api/first", &json!({"a": 1}));
    std::thread::sleep(std::time::Duration::from_millis(10));

    learner.learn_from_request("/api/second", &json!({"b": 2}));
    std::thread::sleep(std::time::Duration::from_millis(10));

    learner.learn_from_request("/api/third", &json!({"c": 3}));
    std::thread::sleep(std::time::Duration::from_millis(10));

    // This should evict the oldest (first)
    learner.learn_from_request("/api/fourth", &json!({"d": 4}));

    assert_eq!(learner.len(), 3);
    assert!(learner.get_schema("/api/first").is_none()); // Evicted
    assert!(learner.get_schema("/api/second").is_some());
    assert!(learner.get_schema("/api/third").is_some());
    assert!(learner.get_schema("/api/fourth").is_some());
}

#[test]
fn test_lru_update_prevents_eviction() {
    let config = SchemaLearnerConfig {
        max_schemas: 3,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    learner.learn_from_request("/api/first", &json!({"a": 1}));
    std::thread::sleep(std::time::Duration::from_millis(10));

    learner.learn_from_request("/api/second", &json!({"b": 2}));
    std::thread::sleep(std::time::Duration::from_millis(10));

    learner.learn_from_request("/api/third", &json!({"c": 3}));
    std::thread::sleep(std::time::Duration::from_millis(10));

    // Update first to make it recent
    learner.learn_from_request("/api/first", &json!({"a": 100}));
    std::thread::sleep(std::time::Duration::from_millis(10));

    // This should evict second (now oldest)
    learner.learn_from_request("/api/fourth", &json!({"d": 4}));

    assert_eq!(learner.len(), 3);
    assert!(learner.get_schema("/api/first").is_some()); // Updated, not evicted
    assert!(learner.get_schema("/api/second").is_none()); // Evicted
    assert!(learner.get_schema("/api/third").is_some());
    assert!(learner.get_schema("/api/fourth").is_some());
}

// ============================================================================
// Memory Protection Tests
// ============================================================================

#[test]
fn test_max_fields_per_schema() {
    let config = SchemaLearnerConfig {
        max_fields_per_schema: 5,
        ..Default::default()
    };
    let learner = SchemaLearner::with_config(config);

    // Try to add more than 5 fields
    let body = json!({
        "field1": 1,
        "field2": 2,
        "field3": 3,
        "field4": 4,
        "field5": 5,
        "field6": 6,
        "field7": 7,
        "field8": 8
    });

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();

    // Should be capped at max_fields_per_schema
    assert!(schema.request_schema.len() <= 5);
}

// ============================================================================
// Statistics Tests
// ============================================================================

#[test]
fn test_stats_empty_learner() {
    let learner = SchemaLearner::new();
    let stats = learner.get_stats();

    assert_eq!(stats.total_schemas, 0);
    assert_eq!(stats.total_samples, 0);
    assert!((stats.avg_fields_per_endpoint - 0.0).abs() < f64::EPSILON);
}

#[test]
fn test_stats_with_data() {
    let learner = SchemaLearner::new();

    // Add schema with 3 fields, 5 samples
    for _ in 0..5 {
        learner.learn_from_request(
            "/api/users",
            &json!({"id": 1, "name": "test", "email": "t@t.com"}),
        );
    }

    // Add schema with 2 fields, 3 samples
    for _ in 0..3 {
        learner.learn_from_request("/api/orders", &json!({"order_id": 1, "total": 100}));
    }

    let stats = learner.get_stats();

    assert_eq!(stats.total_schemas, 2);
    assert_eq!(stats.total_samples, 8); // 5 + 3
    assert!(stats.avg_fields_per_endpoint > 0.0);
}

// ============================================================================
// Export/Import Tests
// ============================================================================

#[test]
fn test_export_empty() {
    let learner = SchemaLearner::new();
    let exported = learner.export();

    assert!(exported.is_empty());
}

#[test]
fn test_export_import_round_trip() {
    let learner1 = SchemaLearner::new();

    // Add some schemas
    for _ in 0..5 {
        learner1.learn_from_request("/api/users", &json!({"id": 1, "name": "test"}));
    }
    for _ in 0..3 {
        learner1.learn_from_request("/api/orders", &json!({"order_id": 100}));
    }

    // Export
    let exported = learner1.export();
    assert_eq!(exported.len(), 2);

    // Import into new learner
    let learner2 = SchemaLearner::new();
    learner2.import(exported);

    assert_eq!(learner2.len(), 2);

    // Verify schemas match
    let schema1 = learner1.get_schema("/api/users").unwrap();
    let schema2 = learner2.get_schema("/api/users").unwrap();

    assert_eq!(schema1.sample_count, schema2.sample_count);
    assert_eq!(schema1.template, schema2.template);
}

#[test]
fn test_import_clears_existing() {
    let learner = SchemaLearner::new();

    // Add initial schema
    learner.learn_from_request("/api/existing", &json!({"field": 1}));
    assert!(learner.get_schema("/api/existing").is_some());

    // Import new schemas
    let learner2 = SchemaLearner::new();
    learner2.learn_from_request("/api/imported", &json!({"data": "value"}));
    let exported = learner2.export();

    learner.import(exported);

    // Existing schema should be gone
    assert!(learner.get_schema("/api/existing").is_none());
    // Imported schema should be present
    assert!(learner.get_schema("/api/imported").is_some());
}

#[test]
fn test_clear() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/a", &json!({"x": 1}));
    learner.learn_from_request("/api/b", &json!({"y": 2}));

    assert_eq!(learner.len(), 2);

    learner.clear();

    assert!(learner.is_empty());
    assert_eq!(learner.len(), 0);
}

// ============================================================================
// Concurrent Access Tests
// ============================================================================

#[test]
fn test_concurrent_learning() {
    let learner = Arc::new(SchemaLearner::new());
    let mut handles = vec![];

    // Spawn multiple threads learning concurrently
    for thread_id in 0..4 {
        let learner_clone = Arc::clone(&learner);
        let handle = thread::spawn(move || {
            for i in 0..100 {
                let template = format!("/api/endpoint_{}", thread_id);
                let body = json!({
                    "thread": thread_id,
                    "iteration": i,
                    "data": format!("value_{}", i)
                });
                learner_clone.learn_from_request(&template, &body);
            }
        });
        handles.push(handle);
    }

    // Wait for all threads
    for handle in handles {
        handle.join().unwrap();
    }

    // Should have 4 endpoints, each with 100 samples
    assert_eq!(learner.len(), 4);

    for thread_id in 0..4 {
        let template = format!("/api/endpoint_{}", thread_id);
        let schema = learner.get_schema(&template).unwrap();
        assert_eq!(schema.sample_count, 100);
    }
}

#[test]
fn test_concurrent_learning_same_endpoint() {
    let learner = Arc::new(SchemaLearner::new());
    let mut handles = vec![];

    // Multiple threads learning same endpoint
    for thread_id in 0..4 {
        let learner_clone = Arc::clone(&learner);
        let handle = thread::spawn(move || {
            for i in 0..50 {
                let body = json!({
                    "thread": thread_id,
                    "value": i
                });
                learner_clone.learn_from_request("/api/shared", &body);
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    // Should have 1 endpoint with 200 total samples (4 threads * 50)
    assert_eq!(learner.len(), 1);

    let schema = learner.get_schema("/api/shared").unwrap();
    assert_eq!(schema.sample_count, 200);
}

#[test]
fn test_concurrent_validation() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        ..Default::default()
    };
    let learner = Arc::new(SchemaLearner::with_config(config));

    // First, learn a schema
    for i in 0..20 {
        learner.learn_from_request("/api/test", &json!({"id": i, "name": "user"}));
    }

    let mut handles = vec![];

    // Concurrent validation
    // Note: Use values within tolerance range (learned 0-19, tolerance 1.5 = max 28.5)
    for _ in 0..4 {
        let learner_clone = Arc::clone(&learner);
        let handle = thread::spawn(move || {
            for i in 0..20 {
                let body = json!({"id": i, "name": "test"});
                let result = learner_clone.validate_request("/api/test", &body);
                // Valid requests should pass
                assert!(result.is_valid());
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }
}

#[test]
fn test_concurrent_learn_and_validate() {
    let config = SchemaLearnerConfig {
        min_samples_for_validation: 5,
        ..Default::default()
    };
    let learner = Arc::new(SchemaLearner::with_config(config));

    // Pre-learn some samples
    for i in 0..10 {
        learner.learn_from_request("/api/test", &json!({"id": i, "data": "value"}));
    }

    let mut handles = vec![];

    // Learning threads
    for thread_id in 0..2 {
        let learner_clone = Arc::clone(&learner);
        let handle = thread::spawn(move || {
            for i in 0..50 {
                let body = json!({"id": thread_id * 1000 + i, "data": "new"});
                learner_clone.learn_from_request("/api/test", &body);
            }
        });
        handles.push(handle);
    }

    // Validation threads (concurrent with learning)
    for _ in 0..2 {
        let learner_clone = Arc::clone(&learner);
        let handle = thread::spawn(move || {
            for i in 0..50 {
                let body = json!({"id": i, "data": "test"});
                let _ = learner_clone.validate_request("/api/test", &body);
                // Just ensure no panics during concurrent access
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    // Verify final state
    let schema = learner.get_schema("/api/test").unwrap();
    assert!(schema.sample_count >= 110); // 10 initial + 100 from threads
}

// ============================================================================
// Edge Cases
// ============================================================================

#[test]
fn test_special_characters_in_field_names() {
    let learner = SchemaLearner::new();

    let body = json!({
        "field-with-dashes": 1,
        "field_with_underscores": 2,
        "field.with.dots": 3,
        "field:with:colons": 4,
        "123numeric_start": 5
    });

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();

    assert!(schema.request_schema.contains_key("field-with-dashes"));
    assert!(schema.request_schema.contains_key("field_with_underscores"));
    // Note: dots in field names may conflict with nesting notation
}

#[test]
fn test_very_long_string_values() {
    let learner = SchemaLearner::new();

    let long_string = "a".repeat(10_000);
    let body = json!({"content": long_string});

    learner.learn_from_request("/api/test", &body);

    let schema = learner.get_schema("/api/test").unwrap();
    let content_schema = schema.request_schema.get("content").unwrap();

    assert_eq!(content_schema.max_length, Some(10_000));
}

#[test]
fn test_extreme_number_values() {
    let learner = SchemaLearner::new();

    learner.learn_from_request("/api/test", &json!({"value": f64::MAX / 2.0}));
    learner.learn_from_request("/api/test", &json!({"value": f64::MIN / 2.0}));

    let schema = learner.get_schema("/api/test").unwrap();
    let value_schema = schema.request_schema.get("value").unwrap();

    assert!(value_schema.min_value.is_some());
    assert!(value_schema.max_value.is_some());
}

#[test]
fn test_mixed_type_field_over_time() {
    let learner = SchemaLearner::new();

    // Same field with different types over time
    learner.learn_from_request("/api/test", &json!({"field": 123})); // Number
    learner.learn_from_request("/api/test", &json!({"field": "str"})); // String
    learner.learn_from_request("/api/test", &json!({"field": true})); // Boolean
    learner.learn_from_request("/api/test", &json!({"field": 456})); // Number
    learner.learn_from_request("/api/test", &json!({"field": 789})); // Number

    let schema = learner.get_schema("/api/test").unwrap();
    let field_schema = schema.request_schema.get("field").unwrap();

    // Dominant type should be Number (3 out of 5)
    assert_eq!(field_schema.dominant_type(), FieldType::Number);
}

#[test]
fn test_response_sample_count_not_double_incremented() {
    let learner = SchemaLearner::new();

    // Learn from response only (not request)
    for _ in 0..5 {
        learner.learn_from_response("/api/test", &json!({"result": "ok"}));
    }

    let schema = learner.get_schema("/api/test").unwrap();

    // Response-only learning shouldn't increment sample_count (per implementation)
    // Sample count is only incremented for request bodies to avoid double counting
    assert_eq!(schema.sample_count, 0);
}

#[test]
fn test_learn_from_pair_increments_once() {
    let learner = SchemaLearner::new();

    learner.learn_from_pair(
        "/api/test",
        Some(&json!({"request": "data"})),
        Some(&json!({"response": "data"})),
    );

    let schema = learner.get_schema("/api/test").unwrap();

    // Should only increment once even with both request and response
    assert_eq!(schema.sample_count, 1);
}

//! Profiler module test organization.
//!
//! Comprehensive test suite for the profiler subsystem achieving 90%+ coverage.
//!
//! ## Test Modules
//!
//! - `distribution_test` - Tests for Distribution and PercentilesTracker (Welford's, P-square)
//! - `rate_tracker_test` - Tests for RateTracker circular buffer
//! - `signals_test` - Tests for AnomalySignal types and severity
//! - `endpoint_profile_test` - Tests for EndpointProfile baseline tracking
//! - `profile_store_test` - Tests for ProfileStore with LRU eviction
//! - `schema_learner_test` - Tests for SchemaLearner JSON schema inference
//! - `integration_test` - End-to-end integration tests

// Include submodules from the profiler/ directory
#[path = "profiler/distribution_test.rs"]
mod distribution_test;

#[path = "profiler/rate_tracker_test.rs"]
mod rate_tracker_test;

#[path = "profiler/signals_test.rs"]
mod signals_test;

#[path = "profiler/endpoint_profile_test.rs"]
mod endpoint_profile_test;

#[path = "profiler/profile_store_test.rs"]
mod profile_store_test;

#[path = "profiler/schema_learner_test.rs"]
mod schema_learner_test;

#[path = "profiler/integration_test.rs"]
mod integration_test;

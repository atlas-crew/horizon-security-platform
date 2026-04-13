---
id: TASK-74
title: Migrate synapse-pingora to library + thin bin crate split
status: To Do
assignee: []
created_date: '2026-04-12 22:59'
labels:
  - waf
  - synapse-pingora
  - review-finding
  - refactor
  - future-work
milestone: m-6
dependencies: []
references:
  - apps/synapse-pingora/src/main.rs
  - apps/synapse-pingora/src/lib.rs
  - apps/synapse-pingora/tests/filter_chain_integration.rs
  - apps/synapse-pingora/Cargo.toml
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rust-pro (#8) and test-automator (#21) both identified the `#[path = "../src/main.rs"] mod synapse_main;` pattern in `tests/filter_chain_integration.rs` as a workaround that should be replaced by a proper library + binary crate split.

## Current state

`apps/synapse-pingora` has a lib target (`src/lib.rs`, name `synapse_pingora`) and a bin target (`src/main.rs`, name `synapse-waf`). The lib contains most of the subsystems (waf, correlation, trends, dlp, etc.). The bin contains `SynapseProxy`, `ProxyDependencies`, `DetectionEngine`, and the Pingora `ProxyHttp` trait implementation — about 6000 lines of code that integration tests want to exercise.

Integration tests need to construct `SynapseProxy`, but `SynapseProxy` lives in the bin crate and normal `use` imports don't reach bin code. The current workaround is `#[path = "../src/main.rs"] mod synapse_main;` in `filter_chain_integration.rs`, which re-compiles main.rs as a submodule of the integration test binary.

## Problems with current approach

1. **Compile time**: main.rs gets compiled twice per test run — once as the bin, once as a module in each integration test binary. For a 6000-line file with the full Pingora dependency tree, this is measurable.

2. **`pub(crate)` semantic confusion**: visibility is relative to the crate including main.rs, which differs between bin and test compilation contexts. The TASK-40 `pub(crate)` bumps on `create_default_cookie_config` / `create_progression_config` work via this weirdness, but the resulting visibility is neither truly crate-private (because the test crate also sees them) nor truly public (because external consumers don't).

3. **cfg flag drift**: if main.rs has conditional compilation based on cfg flags, the test copy may pick up different flags than the bin copy, causing subtle behavior differences between what tests exercise and what ships.

## Fix

Extract the content of main.rs into the library:

1. Move `SynapseProxy`, `ProxyDependencies`, `DetectionEngine`, `RequestContext`, and all helpers into `src/lib.rs` or a new `src/proxy.rs` module.
2. Reduce `src/main.rs` to a thin `fn main() { synapse_pingora::proxy::run() }` shell (20-50 lines).
3. Integration tests use `use synapse_pingora::proxy::*;` normally.
4. Remove the `#[path]` trick from `tests/filter_chain_integration.rs`.
5. Revert the `pub(crate)` bumps (or keep them — they now correctly mean "visible within the library crate").

## Scope

This is a significant refactor — roughly half a day to a day of work depending on how much implicit coupling exists between main.rs and the library. No runtime behavior change. All 205 tests should continue to pass after migration.

## Priority

Low. The current workaround works. This is cleanup for test runtime and code clarity, not a correctness or performance issue. File as future work and tackle when someone has a spare half-day.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 src/main.rs is reduced to a thin binary entry point (< 100 lines)
- [ ] #2 SynapseProxy, ProxyDependencies, DetectionEngine, and all helpers previously in main.rs now live in the library crate under a proxy module or similar
- [ ] #3 tests/filter_chain_integration.rs uses normal use synapse_pingora::proxy::* imports, no #[path] trick
- [ ] #4 pub(crate) bumps introduced in TASK-40 are revisited — they may become pub within the library or pub(crate) (test module in library)
- [ ] #5 All 205+ tests continue to pass after migration
- [ ] #6 Compile time for integration tests measurably decreases (since main.rs is no longer compiled twice per test run)
<!-- AC:END -->

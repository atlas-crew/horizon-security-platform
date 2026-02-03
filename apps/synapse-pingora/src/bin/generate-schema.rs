//! Generate JSON Schema for synapse-pingora configuration.
//!
//! Run with: `cargo run --bin generate-schema > config.schema.json`

use schemars::schema_for;
use synapse_pingora::config::ConfigFile;

fn main() {
    let schema = schema_for!(ConfigFile);
    println!("{}", serde_json::to_string_pretty(&schema).unwrap());
}

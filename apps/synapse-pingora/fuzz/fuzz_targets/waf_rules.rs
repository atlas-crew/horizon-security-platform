#![no_main]

use libfuzzer_sys::fuzz_target;
use synapse_pingora::waf::{Engine, Header, Request};

const MAX_RULE_BYTES: usize = 64 * 1024;

fuzz_target!(|data: &[u8]| {
    if data.len() > MAX_RULE_BYTES {
        return;
    }

    let mut engine = Engine::empty();
    if engine.load_rules(data).is_ok() {
        let request = Request {
            method: "GET",
            path: "/fuzz?query=1",
            query: Some("query=1"),
            headers: vec![Header::new("User-Agent", "fuzzer")],
            body: Some(b"payload"),
            client_ip: "127.0.0.1",
            is_static: false,
        };
        let _ = engine.analyze(&request);
    }
});

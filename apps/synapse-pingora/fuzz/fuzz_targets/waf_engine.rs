#![no_main]

use libfuzzer_sys::fuzz_target;
use synapse_pingora::waf::{Engine, Header, Request};

fn clamp_string(input: &[u8], max_len: usize, fallback: &str) -> String {
    let mut value = String::from_utf8_lossy(input).to_string();
    value = value.trim().to_string();
    if value.is_empty() {
        return fallback.to_string();
    }
    value.chars().take(max_len).collect()
}

fn build_request(data: &[u8]) -> (Request<'_>, Vec<String>, Vec<(String, String)>, Vec<u8>) {
    let mut parts = data.splitn(6, |b| *b == 0);
    let method_raw = parts.next().unwrap_or_default();
    let path_raw = parts.next().unwrap_or_default();
    let query_raw = parts.next().unwrap_or_default();
    let headers_raw = parts.next().unwrap_or_default();
    let client_ip_raw = parts.next().unwrap_or_default();
    let body_raw = parts.next().unwrap_or_default();

    let method = clamp_string(method_raw, 16, "GET");
    let mut path = clamp_string(path_raw, 2048, "/");
    if !path.starts_with('/') {
        path.insert(0, '/');
    }
    let query = clamp_string(query_raw, 1024, "");
    let client_ip = clamp_string(client_ip_raw, 64, "127.0.0.1");

    let mut header_pairs = Vec::new();
    for line in headers_raw.split(|b| *b == b'\n').take(16) {
        if line.is_empty() {
            continue;
        }
        let mut kv = line.splitn(2, |b| *b == b':');
        let name = clamp_string(kv.next().unwrap_or_default(), 64, "x");
        let value = clamp_string(kv.next().unwrap_or_default(), 256, "");
        header_pairs.push((name, value));
    }

    let mut header_storage = Vec::new();
    header_storage.push(method.clone());
    header_storage.push(path.clone());
    header_storage.push(query.clone());
    header_storage.push(client_ip.clone());
    for (name, value) in &header_pairs {
        header_storage.push(name.clone());
        header_storage.push(value.clone());
    }

    let headers: Vec<Header<'_>> = header_pairs
        .iter()
        .map(|(name, value)| Header::new(name, value))
        .collect();

    let body = body_raw.to_vec();
    let body_ref = if body.is_empty() { None } else { Some(body.as_slice()) };

    let request = Request {
        method: &header_storage[0],
        path: &header_storage[1],
        query: if header_storage[2].is_empty() {
            None
        } else {
            Some(&header_storage[2])
        },
        headers,
        body: body_ref,
        client_ip: &header_storage[3],
        is_static: false,
    };

    (request, header_storage, header_pairs, body)
}

fuzz_target!(|data: &[u8]| {
    if data.is_empty() {
        return;
    }

    let split = (data[0] as usize).min(data.len());
    let (rule_bytes, request_bytes) = data.split_at(split);

    let mut engine = Engine::empty();
    let _ = engine.load_rules(rule_bytes);

    let (request, _storage, _pairs, _body) = build_request(request_bytes);
    let _ = engine.analyze_safe(&request);
});

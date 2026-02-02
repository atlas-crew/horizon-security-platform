#![no_main]

use libfuzzer_sys::fuzz_target;
use std::sync::OnceLock;
use synapse_pingora::dlp::{DlpConfig, DlpScanner};

const MAX_SCAN_BYTES: usize = 256 * 1024;

static SCANNER: OnceLock<DlpScanner> = OnceLock::new();

fuzz_target!(|data: &[u8]| {
    if data.len() > MAX_SCAN_BYTES {
        return;
    }

    let scanner = SCANNER.get_or_init(|| DlpScanner::new(DlpConfig::default()));
    let _ = scanner.scan_bytes(data);
});

# Benchmark Report - January 2026

## Executive Summary

Recent benchmarks using realistic payloads have revealed a significant bimodal performance characteristic in the Synapse-Pingora detection engine. While the system meets or exceeds performance targets for "fast-path" light traffic, it exhibits non-linear latency scaling when processing heavy, complex requests.

*   **Light Traffic (<1KB):** ✅ **~13-22 µs** (Meets aggressive targets)
*   **Heavy Traffic (14KB+):** ⚠️ **~233 µs** (6-10x slower than baseline)

## Key Findings

### 1. Bimodal Performance Profile
The engine's decision latency is highly dependent on payload size and complexity. The previously advertised "17-28µs" range is accurate *only* for small payloads (e.g., login credentials, simple API queries).

| Traffic Type | Payload Size | Headers | Query Params | Latency (Avg) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Simple GET** | 0 bytes | 2 | 0 | **~5.9 µs** | ✅ Excellent |
| **Login (JSON)** | ~120 bytes | 1 | 0 | **~13.2 µs** | ✅ Excellent |
| **Search (Query)** | 0 bytes | 1 | 2 | **~12.7 µs** | ✅ Excellent |
| **Attack (SQLi)** | ~20 bytes | 1 | 1 | **~18 µs** | ✅ Good |
| **Baseline Complex** | 0 bytes | 2 | 3 | **~37 µs** | ⚠️ Acceptable |
| **Heavy Complex** | **14.4 KB** | **22** | **10** | **~233 µs** | ❌ **High Latency** |

### 2. Variance Drivers
Latency variance is driven by two primary factors:
1.  **Regex Complexity:** Even small increases in attack payload string length (e.g., 8 chars to 16 chars) can increase detection time by **~40%** (12µs → 17µs).
2.  **Body Scanning:** The jump from ~37µs (complex headers, no body) to ~233µs (heavy body) indicates that **body inspection is the primary bottleneck**. Scanning a 14KB JSON body against the rule set consumes ~85% of the total processing time for that request.

### 3. "10µs Target" Reality
The architectural goal of sub-10µs latency is achievable only for:
*   Static asset requests (~4.2 µs)
*   Simple GET requests without extensive query parameters (~5.9 µs)

For any request requiring deep inspection (WAF), the baseline is **15-20µs**, scaling up to **200µs+** for large payloads.

## Recommendations

1.  **Documentation Update:** Update all performance claims to reflect the bimodal reality. Avoid blanket "sub-30µs" claims.
    *   *Revised Claim:* "Sub-20µs fast-path latency; <300µs for deep inspection of heavy payloads."
2.  **Optimization Targets:**
    *   **Body Inspection limits:** Investigate capping body inspection size or optimizing the scanner to fail-fast.
    *   **Regex Optimization:** Review "expensive" rules that might be triggering excessive backtracking on large bodies.
3.  **Architectural Safeguards:** Ensure timeouts are configured to handle the ~250µs worst-case scenario to prevent tail latency degradation under load.

## Methodology
Benchmarks were conducted on **2026-01-08** using:
*   **Engine:** `synapse-pingora` v0.1.0 (with `libsynapse`)
*   **Hardware:** macOS (Darwin) Environment
*   **Payloads:**
    *   *Normal:* Extracted from `apps/load-testing` (User logins, orders).
    *   *Heavy:* Generated 14KB JSON body with nested objects, 22 headers, 10 query params.

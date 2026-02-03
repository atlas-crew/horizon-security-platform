# Rule Authoring & Deployment Flow

This guide describes the end-to-end process for creating, testing, and deploying security rules across the Signal Horizon fleet.

## Overview

The rule lifecycle follows a **3-tier architecture**:

1.  **Authoring (Control Plane)**: Rules are created in Signal Horizon (GUI, Sigma Import) or Risk-Server (Local Prototyping).
2.  **Distribution (Orchestration)**: Signal Horizon calculates rule deltas and pushes `FleetCommand` payloads to relevant sensors.
3.  **Enforcement (Data Plane)**: `synapse-pingora` sensors receive the rules, update their in-memory engine (hot-reload), and enforce them at line speed.

## 1. Authoring Environments

### A. Signal Horizon (Fleet Management)
*Primary environment for production rules.*

- **Custom Rules UI**: Create JSON-based WAF rules via the `RuleBuilder` interface (`/rules/new`).
- **Sigma Import**: Import industry-standard Sigma (YAML) rules.
    - **Feature**: `SigmaImportModal` transpiles Sigma YAML -> ClickHouse SQL (for hunting) AND Synapse JSON (for WAF blocking).
    - **Usage**:
        1. Navigate to **Threat Hunting** -> **Import Sigma**.
        2. Paste Sigma YAML.
        3. Review generated SQL/JSON.
        4. Save as a new Detection Rule.

### B. Risk-Server (Local Prototyping)
*Best for debugging and regex testing.*

- **Dashboard UI**: The legacy `risk-server` dashboard (`http://localhost:3000`) allows direct editing of a single sensor's `rules.json`.
- **Use Case**: Testing a complex regex against live traffic on a staging sensor before fleet-wide deployment.

## 2. Rule Structure (`libsynapse`)

All rules, regardless of authoring source, are compiled into the `libsynapse` JSON format shared by `risk-server` and `synapse-pingora`.

```json
{
  "id": 200100,
  "risk": 50,
  "classification": "InfoDisclosure",
  "matches": [
    {
      "match": {
        "match": "web-inf",
        "type": "contains"
      },
      "type": "uri"
    }
  ]
}
```

## 3. Deployment Flow

1.  **Commit**: User saves a rule in Signal Horizon.
2.  **Distribute**:
    - The `RuleDistributor` service identifies target sensors (by Tenant, Tag, or Region).
    - It generates a `push_rules` fleet command.
3.  **Push**:
    - Command sent via WebSocket (`/ws/tunnel`).
4.  **Enforce**:
    - `synapse-pingora` receives the payload.
    - It acquires a write lock on the `Synapse` engine.
    - Rules are hot-swapped (zero downtime).
    - New traffic is immediately evaluated against the new rules.

## 4. Verification

*   **Drift Analysis**: Check the **Drift** tab in a Sensor's detail page to ensure its active ruleset matches the fleet policy.
*   **Test Command**: Use **Service Controls** -> **Test** to validate the configuration without restarting the process.

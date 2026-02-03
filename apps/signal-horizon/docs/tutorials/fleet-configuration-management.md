# Fleet-Wide Configuration Management (Signal Horizon)

This tutorial shows how to create configuration templates and push them to a
fleet of sensors using the Signal Horizon API.

## Objectives

- Create a reusable config template.
- Push the template to a sensor subset or the full fleet.
- Track command status to confirm delivery.

## Prerequisites

- API key with `config:read` and `config:write` scopes.
- Sensor IDs for the target fleet.

Set your environment variables:

```bash
export SH_API_BASE="https://your-signal-horizon.com"
export SH_API_KEY="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Step 1: Create a Config Template

```bash
curl -s "$SH_API_BASE/api/v1/fleet/config/templates" \
  -H "Authorization: Bearer $SH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "prod-default",
    "description": "Baseline prod policy",
    "environment": "production",
    "config": {
      "server": { "waf_enabled": true, "waf_threshold": 70 },
      "rate_limit": { "enabled": true, "rps": 10000 },
      "dlp": { "enabled": true, "max_body_inspection_bytes": 8192 }
    }
  }' | jq .
```

Checkpoint:
- Response includes a `ConfigTemplate` with an `id`.

## Step 2: Push the Template to Sensors

```bash
export TEMPLATE_ID="<template-id>"

curl -s "$SH_API_BASE/api/v1/fleet/config/push" \
  -H "Authorization: Bearer $SH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "'"$TEMPLATE_ID"'",
    "sensorIds": ["sensor-prod-01", "sensor-prod-02", "sensor-prod-03"]
  }' | jq .
```

Checkpoint:
- Response returns `commands` with one or more command IDs.

## Step 3: Track Command Status

```bash
export COMMAND_ID="<command-id>"

curl -s "$SH_API_BASE/api/v1/fleet/commands/$COMMAND_ID" \
  -H "Authorization: Bearer $SH_API_KEY" \
  -H "Accept: application/json" | jq .
```

Look for `status: success` or `status: failed` to verify delivery.

## Step 4: Update and Re-Push

Modify the template and push again:

```bash
curl -s -X PUT "$SH_API_BASE/api/v1/fleet/config/templates/$TEMPLATE_ID" \
  -H "Authorization: Bearer $SH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "prod-default",
    "description": "Baseline prod policy (tuned)",
    "environment": "production",
    "config": {
      "server": { "waf_enabled": true, "waf_threshold": 75 }
    }
  }' | jq .
```

## Troubleshooting

- **403 Forbidden**: Ensure the API key includes `config:write`.
- **Commands stuck**: Check sensor connectivity and `/api/v1/fleet/status`.
- **Invalid config**: Validate against the sensor config reference before pushing.

## Next Steps

- Review the full API reference in `docs/api.md`.
- Pair config pushes with rule distribution workflows.

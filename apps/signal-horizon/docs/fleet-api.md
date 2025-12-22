# Fleet Management API

This file is a focused entry point for fleet management endpoints. For full request/response schemas and shared model definitions, see `docs/api.md` (section: Fleet Management).

## Base Path

- REST base: `/api/v1/fleet`
- Auth: `Authorization: Bearer <api-key>`
- Required scopes: `fleet:read`, `fleet:write`, `config:read`, `config:write`

## Endpoint Index

### Fleet Overview

- `GET /api/v1/fleet` - Fleet-wide aggregated metrics
- `GET /api/v1/fleet/alerts` - Sensors requiring attention + recent failed commands

### Sensors

- `GET /api/v1/fleet/sensors` - List sensors (supports `status`, `limit`, `offset`)
- `GET /api/v1/fleet/sensors/:sensorId` - Sensor details + recent commands

### Config Templates

- `GET /api/v1/fleet/config/templates`
- `POST /api/v1/fleet/config/templates`
- `GET /api/v1/fleet/config/templates/:id`
- `PUT /api/v1/fleet/config/templates/:id`
- `DELETE /api/v1/fleet/config/templates/:id`
- `POST /api/v1/fleet/config/push` - Push template to sensors

### Commands

- `GET /api/v1/fleet/commands`
- `POST /api/v1/fleet/commands`
- `GET /api/v1/fleet/commands/:commandId`
- `POST /api/v1/fleet/commands/:commandId/cancel`

### Rules

- `GET /api/v1/fleet/rules/status`
- `POST /api/v1/fleet/rules/push`
- `POST /api/v1/fleet/rules/retry/:sensorId`

## Notes

- Fleet endpoints are tenant-scoped; fleet admins can access broader data where supported.
- Some services may return HTTP 503 if the corresponding service is not wired.


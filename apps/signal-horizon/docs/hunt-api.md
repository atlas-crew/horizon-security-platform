# Hunt API

This document is a focused entry point for hunt endpoints. For full request/response schemas and shared model definitions, see `docs/api.md` (section: Hunt).

## Base Path

- REST base: `/api/v1/hunt`
- Auth: `Authorization: Bearer <api-key>`
- Scope: API key required (no explicit scope check)

## Endpoint Index

### Status

- `GET /api/v1/hunt/status` - Indicates if historical hunting (ClickHouse) is enabled

### Queries

- `POST /api/v1/hunt/query` - Timeline search with routing
- `GET /api/v1/hunt/timeline/:campaignId` - Campaign timeline (ClickHouse)
- `GET /api/v1/hunt/stats/hourly` - Hourly aggregates (ClickHouse)
- `POST /api/v1/hunt/ip-activity` - IP activity summary

### Saved Queries (in-memory)

- `GET /api/v1/hunt/saved-queries`
- `POST /api/v1/hunt/saved-queries`
- `GET /api/v1/hunt/saved-queries/:id`
- `POST /api/v1/hunt/saved-queries/:id/run`
- `DELETE /api/v1/hunt/saved-queries/:id`

## Rate Limits

- Hunt queries: 100 requests/minute
- Saved queries: 30 requests/minute
- Heavy aggregations: 10 requests/minute

## Notes

- ClickHouse-backed endpoints return HTTP 503 if ClickHouse is disabled.
- Saved queries are stored in memory and reset on restart.


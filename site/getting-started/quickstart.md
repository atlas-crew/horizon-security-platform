---
title: Quick Start
---

# Quick Start

Get the full development environment running on your local machine.

## Prerequisites

Ensure you have the tools listed in [System Requirements](./requirements). At minimum: Node.js 20+, pnpm, Rust nightly, PostgreSQL, and `just`.

## 1. Clone and Install

```sh
git clone https://github.com/atlas-crew/edge-protection.git
cd edge-protection
pnpm install
```

::: tip Rust dependencies
Synapse's Rust dependencies are fetched during the first build. The initial `cargo build` may take several minutes.
:::

## 2. Database Setup

Ensure PostgreSQL is running, then apply the schema:

```sh
just db-migrate
```

Copy the environment template and adjust if needed:

```sh
cp apps/signal-horizon/api/.env.example apps/signal-horizon/api/.env
```

For ClickHouse (optional):

```sh
just ch-start
just ch-init
```

## 3. Start All Services

```sh
just dev
```

This launches:

| Service | URL |
| --- | --- |
| Horizon API | `http://localhost:3100` |
| Horizon UI | `http://localhost:5180` |
| Synapse (proxy) | `http://localhost:6190` |
| Synapse (admin) | `http://localhost:6191` |

Start services individually with `just dev-horizon` or `just dev-synapse`.

## 4. Verify

```sh
# Horizon health
curl -s http://localhost:3100/health | jq .

# Synapse health
curl -s http://localhost:6191/status | jq .
```

Open `http://localhost:5180` for the Horizon dashboard.

## 5. Send Test Traffic

```sh
# Clean request — passes through
curl -i http://localhost:6190/

# SQLi test — blocked (HTTP 403)
curl -i "http://localhost:6190/?id=1'%20OR%201=1--"
```

## Troubleshooting

**Port conflicts** — check `.env` (Horizon) or `config.yaml` (Synapse) for port overrides.

**Rust build failures** — ensure nightly toolchain: `rustup default nightly && rustup update`.

**Database errors** — verify PostgreSQL is running: `pg_isready -h localhost -p 5432`.

## Next Steps

- [Architecture](../architecture/) — how the components fit together
- [Configuration](../configuration/) — configure rules, features, and thresholds
- [Deployment](../deployment/) — production deployment guides

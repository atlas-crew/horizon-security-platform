---
title: Deployment Overview
---

# Deployment

Choose a deployment model based on your needs.

| If you need… | Deploy… | Guide |
| --- | --- | --- |
| A fast WAF, nothing else | Synapse standalone | [Synapse Standalone](./synapse-standalone) |
| Fleet management + analytics | Full Horizon platform | [Deploy Horizon](./horizon) |
| Container orchestration | Kubernetes | [Kubernetes](./kubernetes) |
| Simple containerized setup | Docker Compose | [Docker](./docker) |
| Maximum control | Bare metal / VM | [Deploy Horizon](./horizon) or [Synapse Standalone](./synapse-standalone) |

## Architecture at a Glance

```mermaid
graph TD
    subgraph Edge ["Edge Locations"]
        S1["Synapse<br/>Site A"]
        S2["Synapse<br/>Site B"]
        S3["Synapse<br/>Site C"]
    end

    subgraph Hub ["Horizon Hub"]
        API["Horizon API<br/>:3100"]
        UI["Horizon UI<br/>:5180"]
    end

    subgraph Data ["Storage"]
        PG[(PostgreSQL)]
        CH[(ClickHouse)]
        RD[(Redis)]
    end

    S1 & S2 & S3 -->|"signals (WS)"| API
    API -->|"commands (WS)"| S1 & S2 & S3
    API --> PG & CH & RD
    UI --> API
```

::: info Synapse standalone
When running Synapse without Horizon, the sensor operates independently with a local YAML configuration. No hub connection required.
:::

## Before You Deploy

Review the [Production Checklist](./production) to ensure your environment is hardened, monitored, and ready for traffic.

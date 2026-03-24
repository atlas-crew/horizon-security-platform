---
title: Architecture Overview
---

# Architecture

The Horizon platform consists of two primary systems: Synapse WAF engines deployed at the edge and the Horizon hub providing centralized intelligence.

## Platform Overview

```mermaid
graph LR
    subgraph Edge ["Edge Locations"]
        S1["Synapse<br/>US East"]
        S2["Synapse<br/>EU West"]
        S3["Synapse<br/>AP South"]
    end

    subgraph Hub ["Horizon Hub"]
        GW["WS Gateway"]
        API["API Server"]
        AGG["Aggregator"]
        COR["Correlator"]
        BC["Broadcaster"]
    end

    subgraph Storage
        PG[(PostgreSQL)]
        CH[(ClickHouse)]
    end

    subgraph Consumers
        UI["Horizon UI"]
        CLI["Synapse CLI"]
    end

    S1 & S2 & S3 -->|signals| GW
    GW --> AGG
    AGG --> PG
    AGG -.->|async| CH
    AGG --> COR
    COR --> BC
    BC -->|real-time push| UI
    API --> PG & CH
    API --> UI & CLI
    GW -->|commands| S1 & S2 & S3
```

## Design Principles

- **Defense in depth** — WAF, DLP, bot detection, behavioral profiling, and session tracking in a single request pipeline
- **Tenant isolation** — all data scoped by tenant ID; cross-tenant correlation uses anonymized SHA-256 fingerprints
- **Real-time correlation** — signals flow from edge to hub in seconds; dashboards update in real time via WebSocket pub/sub
- **Graceful degradation** — Synapse operates independently if the hub is unreachable; ClickHouse failures don't block signal ingestion

## Components

| Component | Role | Details |
| --- | --- | --- |
| **Synapse** | Edge WAF engine | Pure Rust on Pingora. 237 rules, ~10 μs clean GET. [Details →](./synapse) |
| **Horizon API** | Fleet intelligence hub | Signal ingest, correlation, fleet management. [Details →](./horizon) |
| **Horizon UI** | Admin dashboard | Three modules: Synapse (defense), Bridge (deployment), Beam (observability) |
| **PostgreSQL** | Source of truth | Signals, tenants, rules, config, fleet state |
| **ClickHouse** | Historical analytics | Time-series queries, signal aggregation, retention |
| **Redis** | Cache + pub/sub | Session sharing, multi-instance coordination |

## Data Flow

Signals flow from client requests through the Synapse detection pipeline to the Horizon hub. See [Data Flow & Telemetry](./data-flow) for the complete pipeline.

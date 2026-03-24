---
title: Configuration Overview
---

# Configuration

Horizon and Synapse use different configuration mechanisms.

| Component | Mechanism | Hot-Reload |
| --- | --- | --- |
| **Horizon** | Environment variables (`.env` file) | Requires restart |
| **Synapse** | YAML configuration file | Yes — ~240 μs atomic swap |

## Quick Links

| Page | Content |
| --- | --- |
| [Horizon Configuration](./horizon) | Full environment variable reference |
| [Synapse Configuration](./synapse) | Full YAML configuration reference |
| [Feature Toggles](./features) | Enable/disable WAF categories, DLP, telemetry, and more |

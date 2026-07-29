# ADR 0005: Screen Controller

## Context

Widgets must not orchestrate data loading, permissions, or complete/save.

## Decision

OMS (and future pages) use a Screen Controller: resolve AssetRef from snapshot → load entity data → build UIContext → render UI Runtime → Payload Collector → workflow complete API.

## Consequences

Single load path; widgets stay pure; complete payload is merged.

## Alternatives

Each widget fetches and posts (rejected — duplication and races).

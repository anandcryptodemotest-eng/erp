# ADR 0003: UI Runtime

## Context

Task UI must not grow into per-action React panels (STEP_UI_REGISTRY). Screens must reuse widgets ERP-wide.

## Decision

Introduce UI Runtime: Layout Engine, Widget Registry (manifests), Theme Engine, UI Event Bus, Payload Collector, and UIRuntime SDK. Screen Controller builds UIContext; widgets only use SDK + context.

## Consequences

Composable screens; portable widgets; Order Details can reuse the same runtime later.

## Alternatives

Generic vs Custom only (insufficient long-term); widgets fetch APIs directly (rejected — coupling).

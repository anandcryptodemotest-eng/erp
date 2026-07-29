# ADR 0002: Snapshot

## Context

Published metadata must not change running Sales Orders mid-flight.

## Decision

On workflow start, pin the published WorkflowDefinition plus all referenced FORM/screen bodies into `WorkflowInstance.snapshot` (`pinnedAssets`).

## Consequences

Deterministic execution; later form publishes only affect new instances.

## Alternatives

Always read catalog at task open (rejected — mutable UX); pin workflow only (rejected — form edits would still leak).

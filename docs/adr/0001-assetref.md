# ADR 0001: AssetRef

## Context

Workflows need to reference independently versioned forms/screens without embedding blobs or resolving "latest" at runtime.

## Decision

Use `AssetRef { type, id, version: number }`. Designer may pick Latest; publish and snapshot start resolve to a concrete version. Runtime never resolves latest.

## Consequences

Shared forms across workflows; immutable in-flight UI; Migration path to RULE/MENU/etc. without activity-model change.

## Alternatives

Embedded form JSON per activity (rejected — duplication); `version: "latest"` at runtime (rejected — non-deterministic).

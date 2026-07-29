# ADR 0006: Metadata Lifecycle

## Context

Forms, workflows (and later rules/menus) need a consistent publish model.

## Decision

Draft → Validate → Preview → Publish → Version → Archive. Runtime consumes only PUBLISHED assets. Typed tables per asset kind in Phase 1 (`WorkflowTemplateVersion`, `WorkflowFormVersion`); unified MetadataAsset table deferred.

## Consequences

Independent versioning; dependency index on workflow publish; clean extraction path later.

## Alternatives

Embed everything in workflow JSON (rejected long-term); unified polymorphic table immediately (deferred — schema evolution risk).

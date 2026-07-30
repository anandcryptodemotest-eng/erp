# ADR 0012: Form Audience & Visibility

**Status:** Approved (Frozen decision; Phase 2 implements audiences only)  
**Gate level:** L1 Extension / L0 Implementation for audiences  
**Depends on:** ADR 0010, ADR 0006 Metadata Lifecycle

## Context

Forms must be selectable per Host without duplicating catalogues or using a single exclusive `channel` field.

## Decision

### Audiences (v1.x / Phase 2)

Forms declare:

```yaml
audiences:
  - CUSTOMER
  # may also include ADMIN when shared
```

- `FormDefinition.audiences?: string[]`
- Empty / missing ⇒ treat as `["ADMIN"]` (legacy Admin OMS forms).
- Hosts load published forms whose audiences include that Host id.

### Visibility expressions (later — not Phase 2)

```yaml
audiences:
  - CUSTOMER
visibility:
  roles: [PREMIUM]
  permissions: [CHECKOUT]
```

Do not implement visibility filtering until a follow-up L0/L1 change; keep the schema reserved in docs.

## Consequences

- Form Designer can filter by Host.
- Same Form Designer publishes Admin and Customer screens.
- Forms remain metadata-only and runtime-independent.

## Related

- [0010 Multi-Host Runtime](./0010-multi-host-runtime.md)
- [0006 Metadata Lifecycle](./0006-metadata-lifecycle.md)

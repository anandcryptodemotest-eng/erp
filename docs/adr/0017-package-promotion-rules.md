# ADR 0017: Package Promotion Rules

**Status:** Approved (Frozen — TrustWood ERP Platform v1.0)  
**Depends on:** ADR 0014, ADR 0015

## Context

Enterprise platforms die from **framework inflation**: abstractions invented before two real consumers exist.

## Decision

### Ladder

```text
Primitive  →  Pattern  →  Framework
```

Examples:

- `Button` → `ActionGroup` → (used inside) Workspace Framework  
- `WorkspaceLayout` chrome → Workspace Framework → `WorkspaceKernel` (only after ≥2 desks)  
- `DataTable` → repeated list pain → **Data Experience Framework**

### Promote only when all are true

1. **≥2 real consumers** (not hypothetical)
2. **Stable API** (call sites not thrashing weekly)
3. **Repeated implementation** (copy-paste already happened or is imminent)
4. **No domain coupling** (package must not import apps or own business entities)

### Do not create a framework

Unless the four checks above pass. Prefer:

```text
Build → Observe → Extract → Promote
```

over

```text
Design → Design → Design → Design
```

### Anti-patterns

- New `*Framework` folder for a single screen
- Domain rules inside `@erp/ui` / shell / process packages
- Parallel shells after AdminShell exists

## Consequences

- ADR 0014 promotion principle is the governance model for all catalog entries in ADR 0015.
- Further architecture docs only when implementation reveals a genuine gap.

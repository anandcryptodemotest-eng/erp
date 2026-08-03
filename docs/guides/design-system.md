# Design system — Platform UI Foundation v1.0

Foundation-first shared presentation layer for all ERP surfaces.

## Architecture

```text
Foundation  →  Brand Themes  →  Density Modes
packages/ui consumes the same structure in every app.
```

## Package layout

```text
packages/ui/
├── tokens/       foundation + themes + density (tokens.css) + .erp-canvas
├── shell/        AdminShell + admin-shell.css (TrustWood ERP Platform v1.0)
├── primitives/   Button, Skeleton, ActionGroup, …
├── layout/       BottomNav, Container
├── commerce/     ProductCard, Gallery, Price, Chip, …
├── admin/        DataTable, KPI, PageHeader, AdminShell re-exports
├── studio/       Studio Kernel + renderers
├── workspace/    WorkspaceLayout chrome
├── field/        RouteCard, DeliveryStatus, SignaturePad
├── charts/       reserved (ChartSlot placeholder)
├── icons/        Lucide only
├── motion/       shared transition helpers
└── index.ts
```

See ADR 0015 (platform catalog), ADR 0017 (promotion / do-not-create).

## Ownership

| Owner | Owns |
|-------|------|
| `@erp/ui` | Foundation, components, themes structure |
| Apps | Composition, domain hooks, APIs |

**Do not** put catalog/cart/auth logic in `@erp/ui`.

## Maturity

| Level | Meaning |
|-------|---------|
| Stable | Safe across apps |
| Beta | May tighten API |
| Internal | Experimental |

See `MATURITY` export.

## Icons

**Lucide only** for UI chrome. Do not mix Heroicons / Material.

## Motion

Shared tokens: fast `150ms` · standard `220ms` · slow `320ms`.  
Helpers: `motion.fade`, `motion.rise`, `motion.press`, `motion.dialog`.  
Respect `prefers-reduced-motion`.

## UI frameworks (ERP Platform v1.0)

Classify the screen first — see [ADR 0014](../adr/0014-erp-ui-framework-classification.md):

| Pattern | Use for |
|---------|---------|
| **Studio** | Multi-step authoring (`@erp/ui` studio kernel + injected renderer) |
| **Form Page** | Medium dedicated forms |
| **Modal Form** | Lightweight CRUD on lists |
| **Workspace** | Lists / queues / dashboards (framework stub) |

Studio kernel is headless; hosts inject `DesktopRenderer` or `MobileRenderer`. Do not force Studio onto Brand-style CRUD.

## Related docs

- [themes.md](./themes.md) — brand themes + density matrix  
- [app-guidelines.md](./app-guidelines.md) — PWA, Capacitor, safe areas  
- [ADR 0014 — UI Framework Classification](../adr/0014-erp-ui-framework-classification.md)  


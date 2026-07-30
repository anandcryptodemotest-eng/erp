# ADR 0009: Platform v1.1 — UI Composition

**Status:** Approved (Architecture Complete)  
**Gate level:** L1 Extension / L0 Implementation  
**Does not change:** Platform v1.0 Workflow Runtime, Snapshot, AssetRef, or Widget runtime methods

## Context

Platform v1.0 shipped a thin UI Runtime and four OMS widgets. Expanding the catalogue without clear layers risks turning the widget registry into an application framework (lifecycle hooks, host chrome as widgets, field controls as widgets).

## Decision

Treat UI composition as **four never-mixed layers**, keep the **minimal Widget contract**, make **Field Types first-class**, measure success by **capability (~15–20 field types, ≈25 widgets)**, and require a **governance decision tree** before any new registered widget.

## Architectural Principles

- **Metadata over code**
- **Configuration over customization**
- **Thin widgets**
- **Business logic outside UI**
- **Context-driven rendering**
- **Reuse before extension**
- **Backward compatibility first**

## Four-layer model

| Layer | Responsibility | In Form Designer? |
|-------|----------------|-------------------|
| **Field Types** | Input controls that extend FormFields | Field editor only |
| **Widgets** | Reusable business / workflow / visualisation blocks | Layout picker only |
| **Layout Components** | Pure composition (Tabs, Card, Accordion, Grid, Divider) | Not as business widgets |
| **Host Services** | Toast, Spinner, Modal, Permissions, Theme, Localization, Feature Flags | Never |

Layer rules:

- Field types are **not** widgets.
- Layout is **not** registered as business widgets.
- Host chrome is **never** in the designer picker.
- Widgets **never** call REST; Screen Controller → `UIContext`.
- Workflow engine remains orchestrator.

## Explicit dependency direction

Allowed flow (one-way only):

```
Field Types → Widgets → Screen Definition → Screen Controller → UIContext
```

Widgets consume `UIContext` / `UIRuntime` only; they do not import controllers or domain services.

**Dependencies are one-way.**

- Widgets never depend on Screen Controllers.
- Field Types never depend on Widgets.
- Host Services never depend on Workflow Screens.

## Widget contract (frozen)

```ts
interface Widget {
  render(runtime, props): ReactNode;
  validate(runtime, props): ValidationResult;
  collectPayload(runtime, props): Record<string, unknown>;
}
```

Cross-widget communication: `runtime.events` only (`subscribe` / `publish`).

### Widget Lifecycle Policy

The Widget interface is **intentionally frozen**.

Lifecycle callbacks (`onInit`, `onLoad`, `onDestroy`, `onSave`, `onBeforeSave`, `onEvent`, etc.) are **prohibited**.

Future platform evolution must favour `runtime.events`, `UIContext`, and Screen Controller rather than expanding Widget APIs.

## Field Types as first-class assets

New input controls (currency, percentage, date, email, checkbox, …) **extend `FormFieldType` / FormFields**, not the widget registry. Target ~15–20 field types.

## Success metrics

| Asset class | Target |
|-------------|--------|
| Field Types | ~15–20 |
| Business Widgets | ~15 |
| Workflow Widgets | ~5 |
| Visualisation Widgets | ~5 |
| **Total registered widgets** | **≈25** |

## Extension decision tree

```
Need new capability?
        │
        ▼
Field Type? ──yes──► Extend FormFields
        │ no
        ▼
Existing Widget? ──yes──► Configure Widget
        │ no
        ▼
Screen Controller / UIContext? ──yes──► Extend Context
        │ no
        ▼
Reusable across workflows? ──yes──► Create registered Widget
        │ no
        ▼
Keep workflow-specific
```

## Platform versioning policy

| Version | Allowed changes |
|---------|-----------------|
| **v1.x** | New widgets, new field types, new designer capabilities, Capability Manifest (metadata only) |
| **v2.0** | Widget contract changes, Workflow Runtime changes, Snapshot model changes, AssetRef changes |

## ADR cross-reference

| ADR | Topic | Relationship |
|-----|-------|--------------|
| [0003](./0003-ui-runtime.md) | UI Runtime | Uses runtime (`render` / events / theme) |
| [0004](./0004-extension-registry.md) | Extension Registry | Registers widgets |
| [0005](./0005-screen-controller.md) | Screen Controller | Supplies `UIContext` |
| **0009** | **UI Composition** | **Defines composition model & governance** |

## Explicit non-goals

- Do not register Spinner / Toast / PermissionGuard / FeatureFlag / Divider / Tabs as widgets.
- Do not proliferate widget lifecycle hooks.
- Do not alter Workflow Runtime / Snapshot / AssetRef.
- Do not aim for a large specialised widget catalogue.
- Do not modify this ADR further once frozen — use new ADRs instead (0010–0018).

## Related Platform v1.2 ADRs (do not fold into 0009)

| ADR | Subject |
|-----|---------|
| [0010](./0010-multi-host-runtime.md) | Multi-Host Runtime |
| [0011](./0011-host-api-contract.md) | Host API Contract |
| [0012](./0012-form-audience-visibility.md) | Form Audience & Visibility |
| [0013](./0013-theme-design-tokens.md) | Theme & Design Tokens |

Further v1.x ADRs (field type framework, capability manifest, mobile offline, etc.) remain separate.

## Consequences

- Contributors know where a capability belongs (field vs widget vs layout vs host).
- Platform stays maintainable while scaling OMS → procurement → warehouse → manufacturing.
- Composition growth stays in v1.x; breaking runtime contracts require v2.0 + ADR.

## Related

- [create-widget.md](../guides/create-widget.md)
- [architecture-gates.md](../guides/architecture-gates.md)
- [PLATFORM-ARCHITECTURE-v1.md](../PLATFORM-ARCHITECTURE-v1.md)

# Create a widget

**ADR:** [0009 UI Composition](../adr/0009-ui-composition.md)

## Governance gate (answer in order)

Before introducing a new registered widget:

1. Can this be achieved with an **existing field type**? → Extend FormFields.
2. Can this be **configured on an existing widget**? → Change props / layout.
3. Can the **Screen Controller** provide the required data via `UIContext`? → Extend context.
4. Does this solve a **reusable business capability across multiple workflows**? → Only then create a widget.

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

## Implementation steps

1. Implement `Widget` (`render` / `validate` / `collectPayload`) using only `UIRuntime`.
2. Export a `WidgetManifest` (`id`, `category`, `displayName`, `icon`, flags).
3. Call `registerWidget({ manifest, factory })` at app bootstrap (e.g. `oms-widgets.tsx` / `phase2-widgets.tsx`).
4. Do **not** import sales/inventory API clients inside the widget.
5. Do **not** add lifecycle hooks (`onInit`, `onLoad`, `onDestroy`, …) — use `runtime.events` instead.
6. Add the widget id to the Form Designer allowlist if it should appear in Configuration → Forms.

## Layers (never mix)

| Layer | Examples |
|-------|----------|
| Field Types | date, currency, checkbox — extend FormFields |
| Widgets | ProductList, FileUpload, Timeline |
| Layout | Tabs, Card, Divider — not registered as widgets |
| Host | Toast, Spinner, Permissions — never in Form Designer |

See `@erp/ui-runtime` and Platform Architecture v1.0 / ADR 0009.

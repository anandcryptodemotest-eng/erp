# ADR 0015: TrustWood ERP Platform Catalog & Admin Brand (v1.0)

**Status:** Approved (Frozen — TrustWood ERP Platform v1.0)  
**Depends on:** ADR 0013, ADR 0014

## Context

Platform Admin and Tenant Admin evolved separate themes, shells, and Process Studio UIs. That duplicated chrome and weakened product identity.

## Decision

### One brand

Both admin hosts use **`data-theme="trustwood"`** and the same typography (Fraunces + Outfit), tokens, spacing, and components.

Differentiation is **navigation, permissions, labels, and context** (tenant picker / org)—not a second visual identity.

### Four layers

```text
Business Applications  →  UI Frameworks  →  Design System (tokens, shell, nav)  →  Domain Services
```

### Platform catalog (v1.0)

```text
Design Tokens · UI Primitives · App Shell · Navigation Framework
Studio · Workspace · Form · Modal · Data Experience (lists/filters/views — deepen later)
Process Designer · Process Forms
Notification · Dashboard · AI · Mobile Renderers (later)
Domain Services
```

**Rename:** former “Table Framework” → **Data Experience Framework**.

### Shared AdminShell

Hosts consume `@erp/ui` `AdminShell` + config `NavItem[]` / `NavGroup[]`. No per-app private sidebar implementations for new work.

### Shared Process Designer

Workflow canvas lives in `@erp/process-designer`; Platform and Tenant are thin hosts (api + routes + auth).

### Governance

Build → Observe → Extract → Promote. Do **not** author further architecture ADRs unless implementation reveals a genuine gap (see ADR 0017).

## Consequences

- `data-theme="platform"` dark operator theme is deprecated for admin hosts (tokens remapped to TrustWood).
- Immediate ROI: AdminShell + Process Designer share.
- Mobile remains Kernel → Renderer; no mobile work until web shell/studio stabilize.

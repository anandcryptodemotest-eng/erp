# ADR 0014: ERP UI Framework Classification & Studio / Workspace

**Status:** Approved (Frozen — ERP Platform v1.0)  
**Gate level:** L1 Extension  
**Depends on:** ADR 0013, ADR 0009

## Context

Admin and multi-host UIs need a clear rule for which shell to use. Without a taxonomy, teams force multi-step Studio chrome onto trivial CRUD or reinvent authoring per module.

## Decision

### UI taxonomy

```text
ERP Platform
├── Studio Framework     — multi-step authoring (Product first consumer)
├── Workspace Framework  — operational queues & tasks (Sales Desk first consumer)
├── Form Framework       — medium dedicated forms (PageHeader + Card + RHF/Zod)
└── Modal Framework      — lightweight CRUD on lists
```

| Screen type | Pattern |
|-------------|---------|
| Multi-step creation / rich edit | Studio |
| Queues, claim/work/complete desks | Workspace |
| Medium forms (dedicated page) | Form Page |
| Lightweight CRUD on a list | Modal Form |

**Decision rule:** IF drafts OR step progress OR live summary/preview OR multi-section authoring → Studio. ELSE IF queue + detail + task operations → Workspace. ELSE IF few fields from a list → Modal. ELSE IF medium dedicated route → Form Page.

**Anti-pattern:** Studio for “Brand name → Review → Create”. Use Modal Form.  
**Anti-pattern:** Studio for Sales Desk / warehouse queues. Use Workspace.

### Promotion principle

A framework is deepened only after **at least two real consumers** validate the abstraction.

- Studio → Product first; deepen when e.g. PO create adopts it  
- Workspace → Sales Desk first; introduce `WorkspaceKernel` when e.g. Warehouse adopts it  
- Form / Data → wait for repetition  

### Studio: Kernel vs Renderer

```text
Business (Domain, steps, schemas)
        ↓
Studio Kernel (headless)
        ↓
StudioRenderer (injected by host)
```

- **Platform ≠ Renderer.**
- Kernel owns validation, workflow, navigation rules, draft, preview, submit, events.
- Renderer owns rail / progress / summary chrome / footer / grid / spacing only.
- Step components own business fields only. **Hard rule:** one step set — never `*.web` / `*.mobile` forks.

### Workspace v0.1 (chrome only)

```text
WorkspaceLayout → Toolbar / FilterBar / QueuePanel / DetailPanel / TaskPanel / BottomBar
Lifecycle: Queue → Claim → Work → Complete → Refresh
```

No `WorkspaceProvider` / Kernel in v0.1.

### Ownership

| Layer | Owns | Must not own |
|-------|------|--------------|
| Studio Renderer / Workspace chrome | Layout, slots | Domain APIs, Zod workflow rules |
| Studio Kernel | Authoring workflow, drafts, events | Three-column / mobile sheet layout |
| Domain (Product / Sales Desk) | Business entities & APIs | Inventing a second shell |
| CommercialLineEditor | Line product/qty/UOM/price/discount/tax | Document status, convert, tasks |

## Consequences

- Product is the first Studio consumer; Sales Desk is the first Workspace consumer.
- Route naming: Sales Desk → `/sales-desk` (`/oms` compat redirect); backend remains `apps/sales`.
- Future Warehouse / Purchasing / Returns reuse Workspace chrome.
- Roadmap: WorkspaceKernel after second consumer; ADR 0015 Extension Guidelines.

## Related

- [0013 Theme & Design Tokens](./0013-theme-design-tokens.md)
- [0009 UI Composition](./0009-ui-composition.md)
- Guide: `packages/ui/src/workspace/README.md`, `packages/ui/src/studio/README.md`

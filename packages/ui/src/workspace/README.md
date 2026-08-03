# Workspace Framework (ERP Platform v1.0)

Peer of the **Studio Framework**. Operational queues, assignment, and task execution belong here.

**First consumer:** Sales Desk (`SalesDeskWorkspace`).

## Ownership contract

| Layer | Owns | Must not own |
|-------|------|--------------|
| **Workspace Framework** | Chrome: layout, toolbar, filter bar shell, queue/detail/task slots, bottom bar | Domain APIs, convert, pricing, workflow rules |
| **Domain (e.g. Sales Desk)** | SREQ, SO, workflow tasks, convert, pricing, ScreenController content | Inventing a second layout shell |
| **CommercialLineEditor** | Product, qty, UOM, price, discount, tax on commercial lines | Document status, convert, task lifecycle |

## Lifecycle

```text
Queue → Claim → Work → Complete → Refresh
```

(Contrast Studio: Draft → Preview → Create.)

## v0.1 primitives

`WorkspaceLayout` · `WorkspaceToolbar` · `WorkspaceFilterBar` · `QueuePanel` · `DetailPanel` · `TaskPanel` · `WorkspaceBottomBar`

**Not in v0.1:** `WorkspaceProvider`, Kernel, selection/filter engines, event bus. Introduce when a **second** consumer (e.g. Warehouse) validates the need.

## Promotion principle

A framework is deepened only after **at least two real consumers** validate the abstraction.

- Studio → Product first, PO create later  
- Workspace → Sales Desk first, Warehouse later  

See [ADR 0014](../../../docs/adr/0014-erp-ui-framework-classification.md).

**Do not** use Studio for queue/task desks.

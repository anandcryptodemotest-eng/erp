# ADR 0010: Multi-Host Runtime

**Status:** Approved (Frozen — Platform v1.2)  
**Gate level:** L2 / L3 Platform Principles  
**Does not change:** Widget contract (ADR 0009), UI Runtime methods (ADR 0003), Workflow Runtime / Snapshot / AssetRef

## Context

Platform v1.0–v1.1 delivered a shared UI Runtime used primarily by Admin OMS. Expanding to Customer, Warehouse, Driver, and other apps without a Host abstraction risks forking the runtime per application.

## Decision

Adopt **Platform → Runtime → Host → Business Application**.

- The **Runtime** is host-agnostic, widget-agnostic, and workflow-agnostic.
- A **Host** is the unit of composition for each business application (Admin, Customer, Warehouse, …).
- Hosts supply Screen Controller, permissions, navigation, theme, and optional services.
- The runtime never knows which host is rendering.

## Ownership boundary

| Runtime owns | Host owns |
|--------------|-----------|
| Rendering, validation, payload collection | Permissions, navigation, theme, auth |
| Widget execution, layout rendering | Host services / APIs |
| | UIContext assembly via Screen Controller |

## Invariants (v1.x)

- Runtime does not assemble UIContext.
- Hosts never modify runtime behaviour.
- New applications = new Hosts, not new runtimes.

## Consequences

- Admin OMS becomes the Admin Host implementation.
- Customer Portal, Warehouse, Driver, Vendor, POS, Kiosk, etc. reuse the same runtime and widget library.
- Architecture Compliance Reviews gate proposals that would reopen this contract (see `docs/architecture/compliance-review.md`).

## Related

- [0011 Host API Contract](./0011-host-api-contract.md)
- [0005 Screen Controller](./0005-screen-controller.md)
- [0009 UI Composition](./0009-ui-composition.md)
- [Host Experience Principle](../architecture/host-experience-principle.md) (guide: when a Host should use the shared runtime)

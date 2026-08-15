# ADR 0020: Service SRP Catalog

**Date:** 2026-08-14  
**Status:** Accepted  
**Depends on:** ADR 0015, ADR 0016, ADR 0017 (Communication), ADR 0019

## Context

Sankalp is a multi-process ERP with one Postgres per domain service and a hybrid Gateway. Two failure modes appear if ownership is not written down:

1. **Gateway dump** — new tables land in `erp_gateway` because it is the public entry point.
2. **Microservice diagram** — Notification, Communication, Documents, Workflow, Tax each become `apps/*` so the box chart looks complete.

Neither matches how the product actually changes. Sales owns demand; Accounting owns money; Inventory owns stock. Platform behavior (identity, notification, chat) is different from business truth.

## Decision

**Architecture follows product workload and ownership, not microservice count.**

The normative catalog is [`docs/architecture/SERVICE-SRP.md`](../architecture/SERVICE-SRP.md). Agents follow [`.cursor/rules/service-srp.mdc`](../../.cursor/rules/service-srp.mdc).

### Three kinds of thing

- **Domain service** — owns business truth and its database (Sales, Inventory, Accounting, Procurement, Delivery, HR).
- **Gateway capability** — owns platform behavior. Gateway may **temporarily host** a capability that does not yet justify an independent lifecycle. The capability must still have an explicit ownership boundary and a stable contract. Gateway is not a miscellaneous service.
- **Shared package** — reusable types and pure functions. No business rows (`@erp/tax-india`, `@erp/notifications`, `@erp/documents`, `@erp/auth`, `@erp/ui`).

### New table → owning service

Customer/SalesOrder → Sales. Product/Stock → Inventory. Invoice/Payment → Accounting. Vendor/PO → Procurement. Employee → HR. Delivery assignment → Delivery. Tenant/User/OTP/inbox → Gateway.

### Introducing `apps/<name>`

A service **may** be introduced when it has distinct capability/data ownership **and** a justified independent lifecycle. Failure isolation and multiple consumers **strengthen** the case; they are **not** mandatory (a service may start with one client).

Do not add a backlog item whose only purpose is extraction.

### Cross-domain access

A domain service may expose APIs to other services. It must **never** depend on another domain’s database. Access is contracts only (`ServiceClient`).

### Channels

Browser and future mobile enter through nginx → Gateway. They never call `:3001`–`:3006`.

### Notification (continuation of ADR 0019)

Outbound Notification stays Gateway-hosted. Callers use `@erp/notifications`. OTP stays on Gateway. Extract to `:3012` behind the BFF only when template library + DLT SMS + WhatsApp utility templates + AR dunning + queue/retry/history are a real workload.

### Communication registry

`ModuleId "communication"` is a nav/license key. Chat APIs live on Gateway. Port **3008** is POS, not a Communication microservice. Do not scaffold `apps/communication`.

## Consequences

- **Positive:** Prevents Gateway-monolith drift and premature service explosion.
- **Positive:** Callers of Notification/Communication stay stable if hosting moves later.
- **Negative:** Gateway remains hybrid. Acceptable; capabilities stay named and contracted.
- **Follow-up:** Living catalog in SERVICE-SRP.md; change ownership there plus this ADR if a service is extracted.

# Implementation Roadmap

| Phase | Scope |
|-------|--------|
| 1 (done) | Shared runtime + Admin OMS Host |
| 2 (done) | Host adapter, form audiences, Customer Host checkout + tracking |
| 2.x | Expand Customer Host **workflows** per [host-experience-principle.md](./host-experience-principle.md) |
| 3 | Warehouse Host |
| 4 | Driver / Vendor / other hosts |

v1.x growth = Hosts, field types, widgets, forms — not Runtime / Widget / Host contract changes.

## Customer Host workflow backlog

Commerce screens (Home, Search, PDP, Cart, Wishlist, merchandising) remain **typically** hand-crafted. Expand metadata-driven workflows incrementally:

| Horizon | Screens |
|---------|---------|
| **Done** | Checkout, order tracking, **address management**, **profile update** |
| **Near-term** | — |
| **Next** | Cancellation, return / exchange, warranty, service request |
| **Later (B2B)** | Quote request, RFQ, business onboarding |

Pattern: published FORM (`audiences: [CUSTOMER]`) + Customer Screen Controller (formId → API dispatch) + Host chrome for lists/navigation. Apply the [decision matrix](./host-experience-principle.md) and [Host Experience Review](./compliance-review.md) before each screen.

Shared forms: `customer-checkout`, `customer-tracking`, `customer-profile`, `customer-address` (create/edit mode; reused on Profile and Checkout).

## Governance-aligned backlog

Owned by [tenant-operating-model.md](./tenant-operating-model.md) — implementation only, no new ADRs:

| Item | Status |
|------|--------|
| Tenant Administration UI (General, Branding, Modules, Users, Branches, Security, Portal, Integrations) | **Done** — `/admin/administration` |
| Process Studio IA (hub + Workflows / Forms live; Rules, Notifications, Numbering, Templates soon) | **Done** — `/admin/configuration` hub |
| Permission sets for Process Owner / Catalog Manager (nav + builtin roles) | **Done** |
| RBAC hardening on workflow/form publish + product create | **Done** |
| Delegated admin hierarchy | Future only |

# Host Experience Principle

**Status:** Approved (Frozen — Architecture Guide)  
**Document type:** Product / architecture guidance — **not an ADR**  
**Answers:** When should a Host use the shared UI Runtime?  
**Does not answer:** How the runtime works (see ADRs 0003, 0005, 0009–0013)

This guide complements the frozen Multi-Host architecture without changing Runtime, Widget, or Host contracts.

---

## Principle

Customer **commerce experiences** are primarily optimised for **user experience, performance, and merchandising**, and are therefore **typically** implemented as hand-crafted application screens.

Customer **business workflows** are primarily optimised for **configurability, consistency, and process evolution**, and are therefore **typically** implemented using the shared UI Runtime, Form Catalogue, and Widget library.

These are optimisation goals, not absolute bans. Use the decision matrix below for exceptions.

---

## Decision matrix

Apply during design reviews when introducing a new screen:

| Question | If Yes | Preferred approach |
|----------|--------|-------------------|
| Is this primarily about product discovery or conversion? | Yes | Hand-crafted React |
| Is UX differentiation a competitive advantage? | Yes | Hand-crafted React |
| Is the screen driven by a business process? | Yes | Form + Widgets |
| Will business users request layout changes? | Yes | Form + Widgets |
| Will multiple hosts reuse the screen? | Yes | Form + Widgets |

Prefer the matrix over memorising screen lists. Illustrative examples:

**Typically hand-crafted:** Home, category listing, search, filters, product detail (PDP), cart, wishlist, recommendations.

**Typically Form + Widgets:** Checkout, order confirmation, order tracking, return / exchange, warranty claim, service request, cancellation, profile forms, address management, quote / RFQ, B2B onboarding.

Keep Home, Search, PDP, Cart, Wishlist, and merchandising features outside the widget runtime unless there is a specific business reason.

---

## Default bias

When a new screen is introduced, prefer the **simplest implementation that satisfies current requirements**. Use the decision matrix to determine whether the screen belongs in the shared runtime. **Avoid introducing metadata solely for consistency** if the feature is unlikely to benefit from configurability or cross-host reuse.

This prevents teams from overusing the runtime simply because it exists.

---

## Host balance

Hosts may choose a different balance between hand-crafted experiences and metadata-driven workflows according to their **primary purpose**. For example, a consumer storefront is commerce-centric, while a procurement portal is workflow-centric.

A Customer Retail Host and a B2B Procurement Host can legitimately differ in the share of hand-crafted versus metadata-driven UI without architectural inconsistency — both use the same Runtime and Host contracts.

---

## Governance

| Layer | Role |
|-------|------|
| ADRs | Architectural decisions and contracts (stable) |
| Architecture guides (this doc) | How to apply those decisions (evolvable) |
| [Compliance review](./compliance-review.md) | Checklist including Host Experience Review |

See also: [platform-overview.md](./platform-overview.md), [implementation-roadmap.md](./implementation-roadmap.md), [ADR 0010 Multi-Host Runtime](../adr/0010-multi-host-runtime.md).

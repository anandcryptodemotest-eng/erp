# Tenant Operating Model

**Status:** Approved (Frozen — Architecture & Operations Guide)  
**Document type:** Platform governance — **not an ADR**  
**Answers:** Who owns platform operations, tenant configuration, business configuration, master data, and execution?  
**Does not change:** Runtime, Widget, Host, or Form contracts (see ADRs 0009–0013)

This guide complements the frozen Multi-Host architecture and the [Host Experience Principle](./host-experience-principle.md). It documents **operational ownership** rather than technical design.

Canonical reference for ownership and governance across the platform.

---

## Documentation separation of concerns

| Document | Purpose |
|----------|---------|
| ADRs (0009–0013) | Define platform architecture and contracts |
| [Host Experience Principle](./host-experience-principle.md) | Explain where metadata-driven UI should be used |
| **Tenant Operating Model (this doc)** | Define ownership, governance, and responsibilities |
| [Compliance Review](./compliance-review.md) | Verify implementations follow agreed principles |

That keeps architectural decisions, application guidance, and operational governance independent.

---

## Four ownership layers

Separate **tenant identity** from **business configuration**:

```text
Platform
    ↓
Tenant Configuration
    ↓
Business Configuration
    ↓
Business Operations
```

| Layer | Owner | Responsibility | Examples |
|-------|--------|----------------|----------|
| **Platform** | Platform Admin | Operate the SaaS; own default process design | Create tenants, licenses, health; Process Studio for any tenant; TenantCapability grants |
| **Tenant Configuration** | Tenant Admin | Configure the organisation | Users, branding, currency, timezone, portal slug, branches, security (module licenses: Platform-only writes) |
| **Business Configuration** | Platform (default) or Tenant Process Studio when capability granted | Configure how work and catalog behave | Workflow templates, forms; products / categories / brands (Catalog Manager) |
| **Business Operations** | Operations roles | Execute work | Complete sales / dispatch / delivery tasks |

**Key rules:**
- Workflows are **business configuration**, not tenant identity.
- Platform owns process design by default. Tenant Process Studio requires `TenantCapability` (`processStudio`) **and** a matching ModuleLicense.
- See [process-studio.md](../guides/process-studio.md). Future: Platform Default Library → Tenant Copy → customizations.

---

## Platform ownership

**Platform Admin UI:** Implemented as separate app [`apps/platform`](../../apps/platform) (not tenant `SUPER_ADMIN`). See [platform-admin.md](../guides/platform-admin.md).

Platform Admin operates the multi-tenant SaaS:

- Provision and deactivate tenants
- Module licenses and TenantCapability grants
- Process Studio (workflows/forms) for a selected tenant — platform JWT, no impersonation
- Break-glass access and platform health
- Cross-tenant operational concerns

Platform ownership does **not** include day-to-day catalog editing or executing a tenant’s sales workflow tasks.

---

## Tenant ownership (Tenant Configuration)

Tenant Admin configures the **organisation**:

- Users and invitations
- Branding
- Currency, timezone, and related settings (not operational capabilities)
- Portal slug / customer host binding
- Branches
- Security policies at the organisation level

Module license **writes** and Process Studio enablement are Platform Admin responsibilities. Tenant Administration shows licensed modules as read-only.

**UI:** Administration → Organization → General, Branding, Modules (read-only), Users, Branches, Security, Portal, Integrations.

---

## Business ownership

### Business Configuration

**Default owner:** Platform Admin via Process Studio (target tenant selected).

**Tenant Process Studio** (when `TenantCapability.processStudio` is enabled and licensed): Tenant Admin / Process Owner may draft → validate → publish for their tenant.

**Catalog Manager** configures master data:

- Products, categories, brands, attributes, list prices

### Business Operations

**Operations** roles (e.g. Sales Executive, Pricing, Dispatch, Delivery) **execute** assigned workflow tasks. They do not publish workflow templates or become accidental master-data administrators unless explicitly granted those capabilities.

**Customer** uses the portal only (own profile, addresses, orders / requests).

---

## Recommended role hierarchy

| Role | Owns |
|------|------|
| **Platform Admin** | Entire platform |
| **Tenant Admin** | Organisation (Tenant Configuration) |
| **Process Owner** | Business workflows, forms, rules, notifications, numbering |
| **Catalog Manager** | Products and master data |
| **Operations** | Execute assigned work |
| **Customer** | Portal access |

### Prefer permission sets over enum proliferation

Do **not** continuously expand hard-coded role enums (`PRODUCT_ADMIN`, `PROJECT_ADMIN`, `WORKFLOW_ADMIN`, …). Prefer:

```text
Role → Permissions → Navigation → Capabilities
```

“Catalog Manager” and “Process Owner” should be **named permission sets** (for example via tenant custom roles / `oms.roles` plus navigation modules), with a small set of built-in JWT role strings only where needed today (`ADMIN`, `MANAGER`, operational task roles, `CUSTOMER`, …).

---

## Runtime ownership

The UI Runtime and workflow engine execute **immutable snapshots** of published configuration:

- Latest **PUBLISHED** workflow / form versions are resolved per `tenantId` at start
- Runtime **pins** definition and form assets onto the business entity (e.g. sales order / request)
- Later publishes evolve configuration without rewriting in-flight work

See workflow / form catalogue docs and ADRs for technical detail. This guide only asserts the governance implication: **Process Owner** changes configuration; **Runtime** preserves reproducibility and auditability for **Operations**.

---

## Workflow lifecycle

```text
Draft → Validate → Publish → Snapshot → Execute
```

| Stage | Owner |
|-------|--------|
| Draft / Validate / Publish | Process Owner |
| Snapshot (at start) | Runtime |
| Execute tasks | Operations |

**Who defines the workflow?** Process Owner (not Operations, not Catalog Manager).  
**Who executes it?** Operations.  
**Seeds** (e.g. `SO_STANDARD`) are starter packs only—each tenant publishes its own tenant-scoped copy (`WorkflowTemplateVersion` / `WorkflowFormVersion`).

---

## Catalog lifecycle

| Stage | Owner |
|-------|--------|
| Create / update products, categories, brands, attributes | Catalog Manager (Tenant Admin may also) |
| Use products on orders / requests | Operations (line selection within process rules) |
| Customer browse / cart | Customer Host (commerce; see Host Experience Principle) |

Operations proposing a line on an order is not the same as owning the catalog.

---

## User lifecycle

1. Platform or self-register creates / joins a **Tenant**
2. Tenant Admin invites users and assigns roles / permission sets
3. Navigation modules expose Administration vs Process Studio vs operational workbenches
4. Process Owner and Catalog Manager receive configuration capabilities without requiring new enum roles
5. Operations users receive task-capable roles only
6. Customers register into the tenant portal (`CUSTOMER`) and never receive admin nav

---

## Example organisational model

| Person | Role / permission set | Typical actions |
|--------|----------------------|-----------------|
| SaaS operator | Platform Admin | Create tenant “Trust Wood” |
| Owner / IT lead | Tenant Admin | License Sales + Inventory; invite staff; set portal slug |
| Ops manager | Process Owner | Publish SO workflow v7; edit `customer-checkout` form |
| Merchandiser | Catalog Manager | Add plywood SKUs and categories |
| Desk staff | Operations (`SALES_EXECUTIVE`) | Complete Sales Review on an open request |
| Buyer | Customer | Checkout and track request in portal |

Early-stage tenants may combine Tenant Admin + Process Owner + Catalog Manager on one person; the **model** still keeps the responsibilities distinct so they can be split later.

---

## Information architecture (future)

### Administration (Tenant Configuration)

- Administration → Tenant → General  
- Branding  
- Modules  
- Users  
- Branches  
- Security  
- Portal  
- Integrations  

### Configuration / Process Studio (Business Configuration)

- Configuration → Workflows  
- Forms  
- Rules  
- Notifications  
- Numbering  
- Templates  

Today’s `/admin/workflows` and `/admin/configuration/forms` are the seed of Process Studio. Renaming and expanding that IA is roadmap work, not a governance change.

---

## Future: delegated administration (plan only)

Do **not** implement as part of this freeze. The model already supports evolution via permission sets and custom roles:

```text
Tenant Admin
    ↓
Business Unit Admin
    ↓
Branch Manager
    ↓
Operations
```

No new ADR is required until contracts must change.

---

## Explicitly deferred (implementation roadmap)

Completed in-app for v1.x governance backlog:

- Tenant Administration UI (`/admin/administration`)
- Process Studio hub naming (`/admin/configuration`)
- `PROCESS_OWNER` / `CATALOG_MANAGER` permission-set roles + nav
- API RBAC on workflow/form mutate+publish and product create

Still deferred:

- Full Process Studio assets (Rules, Notifications, Numbering, Templates)
- Portal settings driving customer env automatically
- Delegated multi-level admin hierarchy
- Broader permission-set model beyond named roles (claims matrix)

---

## Governance

| Layer | Role |
|-------|------|
| ADRs | Architectural decisions and contracts (stable) |
| Architecture guides (Host Experience, **this doc**) | How to apply contracts; who owns what (evolvable) |
| [Compliance review](./compliance-review.md) | Checklists including Tenant Operating Model Review |

See also: [platform-overview.md](./platform-overview.md), [implementation-roadmap.md](./implementation-roadmap.md), [ADR 0010 Multi-Host Runtime](../adr/0010-multi-host-runtime.md).

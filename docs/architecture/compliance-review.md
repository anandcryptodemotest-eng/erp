# Architecture Compliance Review

Before implementing a proposal that touches UI / Host / Forms, answer:

## Platform contract checks

| Check | Pass condition |
|-------|----------------|
| Runtime | Avoids changing the runtime contract? |
| Widget | Avoids expanding the widget interface? |
| Host | Can be implemented through host capabilities? |
| Screen Controller | UIContext still assembled only here? |
| Form | Metadata rather than code? |
| ADR | Fits an existing ADR, or needs a new one / v2.0? |

If all pass → **implementation** (L0/L1). If any fail → **architecture discussion**, not silent drift.

Do not evolve frozen ADRs 0003 / 0005 / 0009 / 0010–0013 in place; add new ADRs for v2.0 breaks.

## Host Experience Review

Use with [host-experience-principle.md](./host-experience-principle.md) when classifying a new Host screen:

| Check | Pass condition |
|-------|----------------|
| Commerce vs workflow | Is the feature primarily commerce or workflow? |
| Matrix applied | Has the decision matrix been applied? |
| Metadata-driven | If Form + Widgets: evidence of configurability or cross-host reuse? |
| Hand-crafted | If hand-crafted React: evidence that UX or performance is the primary concern? |

Default bias: prefer the simplest implementation that meets current needs; do not introduce metadata solely for consistency.

## Tenant Operating Model Review

Use with [tenant-operating-model.md](./tenant-operating-model.md) when adding admin surfaces, roles, or configuration ownership:

| Check | Pass condition |
|-------|----------------|
| Layer clarity | Is this Platform, Tenant Configuration, Business Configuration, or Business Operations? |
| Workflows vs tenant identity | Are workflows treated as business configuration (not tenant identity)? |
| Role vs enum | Prefer permission sets + navigation over new hard-coded role enums? |
| Process vs execute | Is design/publish owned by Process Owner and execution by Operations? |
| Catalog | Is master data owned by Catalog Manager (not accidental Operations admin)? |
| Deferred scope | Are Tenant Admin UI / Process Studio IA / delegated admin treated as roadmap, not new ADRs? |

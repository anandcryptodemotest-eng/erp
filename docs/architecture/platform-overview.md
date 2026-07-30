# Platform Overview (v1.2)

Enterprise application platform — not an OMS-only UI stack.

```text
Platform
├── Workflow Engine
├── Metadata Engine
├── Form Catalogue
├── UI Runtime
├── Widget Library
├── Extension Registry
├── Screen Controller
├── Host Abstraction
├── Theme System
├── Permission Model
└── Multi-Application Support
```

Stack: **Platform → Runtime → Host → Business Application**.

Core contracts are **feature-frozen for v1.x**. See [compliance-review.md](./compliance-review.md).

**When to use the shared runtime on a Host** (commerce vs workflow): see [host-experience-principle.md](./host-experience-principle.md). That guide does not change ADR contracts; it explains how to apply them.

**Who owns configuration, master data, workflows, and execution:** see [tenant-operating-model.md](./tenant-operating-model.md). Platform governance guide — not an ADR.

## Documentation hierarchy

| Layer | Location | Role |
|-------|----------|------|
| Decisions | [`docs/adr/`](../adr/) | Stable architecture contracts |
| Guidance | [`docs/architecture/`](./) | How to apply contracts; ownership / governance (evolvable) |
| Enforcement | [compliance-review.md](./compliance-review.md) | Review checklists |

ADRs: [0003](../adr/0003-ui-runtime.md), [0005](../adr/0005-screen-controller.md), [0009](../adr/0009-ui-composition.md), [0010](../adr/0010-multi-host-runtime.md), [0011](../adr/0011-host-api-contract.md), [0012](../adr/0012-form-audience-visibility.md), [0013](../adr/0013-theme-design-tokens.md).

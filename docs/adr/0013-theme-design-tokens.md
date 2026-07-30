# ADR 0013: Theme & Design Tokens

**Status:** Approved (Frozen — Platform v1.2)  
**Gate level:** L1 Extension  
**Depends on:** ADR 0010, ADR 0003, ADR 0004

## Context

Multi-host UIs need distinct branding without widgets branching on Host id.

## Decision

```text
Host → ThemeProvider → Design Tokens → Widget
```

- Host owns theme selection (`themeId` / ThemeProvider).
- Widgets consume `ThemeTokens` from the runtime only.
- **Prohibited:** `if (host === "CUSTOMER")` (or any Host id) inside widgets.

Existing theme ids (`oms-default`, `oms-attention`, and Host-specific ids) register via the Extension Registry.

## Consequences

- Customer, Admin, Warehouse can differ visually without forking widgets.
- Theme changes are Host/metadata configuration, not widget code.

## Related

- [0010 Multi-Host Runtime](./0010-multi-host-runtime.md)
- [0003 UI Runtime](./0003-ui-runtime.md)
- [0004 Extension Registry](./0004-extension-registry.md)

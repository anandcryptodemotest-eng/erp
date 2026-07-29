# Workflow + Metadata Platform

## Architecture freeze (Phase 1)

Separation of concerns:

| Layer | Owns | Never |
|-------|------|-------|
| **Configuration Studio** (Design-time) | Draft → Validate → Preview → Publish → Archive | Execute workflows |
| **Metadata Repository** | Published assets + version history | Run tasks |
| **Runtime Platform** | Snapshots, engine, queue, projection | Know about drafts or resolve `latest` |
| **Domain Adapters** | Sales / Procurement business logic | Own UI metadata |
| **Renderers** | Metadata → UX | Orchestrate workflow |

```
Configuration Studio
  → Metadata Lifecycle (Publish)
  → Metadata Repository
  → Runtime (Metadata Resolver + Workflow Engine)
  → Domain Adapters + Renderers
```

## AssetRef

```ts
interface AssetRef {
  type: "FORM" | "WORKFLOW" | ...;
  id: string;
  version: number; // concrete only — never "latest" at runtime
}
```

Designer may pick Latest; **publish** resolves to a concrete version. Runtime and snapshots always store `version: number`.

## Forms / Screens (Phase 1+)

- Catalog: `WorkflowFormVersion`
- Screen body: `layout: [{ widget, props }]`, `themeId`
- Activities: `assetRef: { type: "FORM", id, version }`
- UI Runtime (`@erp/ui-runtime`) + Extension Registry (`@erp/extensions`)
- See [PLATFORM-ARCHITECTURE-v1.md](./PLATFORM-ARCHITECTURE-v1.md)

## Admin paths

- `/configuration` — Studio hub (Forms + Workflows live; others Coming Soon)
- `/configuration/forms` — Form catalog + designer
- `/workflows` — Workflow designer (Properties → Form AssetRef picker)

## Vertical slice

1. Create/publish form in Form Designer  
2. Reference from workflow activity (`assetRef`)  
3. Publish workflow (validates referenced forms; writes dependency index)  
4. Start Sales Order → snapshot pins both  
5. OMS renders from snapshot  
6. Complete task → workflow advances  

## Related

See also [WORKFLOW-PLATFORM.md](./WORKFLOW-PLATFORM.md) for the DAG engine ADR.

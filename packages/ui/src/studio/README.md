# Studio Framework — consumer guide (v1.0)

Classify the screen first ([ADR 0014](../../../docs/adr/0014-erp-ui-framework-classification.md)). Use Studio only for multi-step authoring.

## Host pattern (DI)

```tsx
<StudioProvider schema={schema} defaultValues={...} registry={registry} domain={domain}>
  <DesktopRenderer onClose={...} />   {/* or MobileRenderer / AutoStudioShell */}
</StudioProvider>
```

## Implement a studio

1. Zod form schema + per-step schemas  
2. `createStudioRegistry().step(...).build()` — one Component + optional SummaryComponent per step (**no** `.web` / `.mobile` forks)  
3. `StudioDomain`: `saveDraft`, `restoreDraft`, `submit`, optional `preview` / `validateWorkflow`  
4. Inject a renderer under the provider  

## Ownership

| Layer | Owns |
|-------|------|
| Renderer | Rail, progress, summary chrome, footer |
| Kernel | Validation, navigation, draft, events |
| Steps / Domain | Fields and APIs |

## Packages

- `@erp/ui` → `studio/` (kernel + renderers)  
- `@erp/ui` → `workspace/` — **Workspace Framework v0.1** (Sales Desk first consumer)  

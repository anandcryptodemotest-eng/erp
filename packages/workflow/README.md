# @erp/workflow

Domain-independent workflow platform: JSON definitions are the source of truth.

- **Designer** (Gateway) authors Draft JSON via React Flow
- **Validator** gates Publish
- **Runtime** executes immutable snapshots — never UI canvas nodes

```
Canvas → JSON → Validator → DB → Engine
```

Platform never imports `apps/sales` etc. Domains register adapters + task types at bootstrap.

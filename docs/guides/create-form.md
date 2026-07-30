# Create a form (screen)

1. Configuration → Forms → Create draft.
2. Set theme id (`oms-default` / `oms-attention`).
3. Set **Audiences** (ADR 0012) — e.g. `ADMIN`, `CUSTOMER`. Empty ⇒ Admin-only legacy.
4. Add layout widgets (`FormFields`, `ProductList`, `CatalogSearch`, `ActionButtons`, …).
5. Edit fields used by `FormFields`.
6. Publish — version becomes immutable.
7. Reference from a workflow activity via **AssetRef**, or load from a Host via  
   `GET /api/workflow-forms/published?formId=…&audience=CUSTOMER`.

See [form-designer.md](../architecture/form-designer.md) and [compliance-review.md](../architecture/compliance-review.md).

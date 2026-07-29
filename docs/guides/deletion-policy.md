# Deletion Policy

Greenfield (2026-07-29): hybrid runtime and SalesReview host panel **deleted**.

| Legacy item | Status |
|-------------|--------|
| Hybrid `workflow-runtime.ts` | **Deleted** — v5 snapshot only |
| `STEP_UI_REGISTRY` | **Deleted** |
| SalesReview hosted OMS panel | **Deleted** — ProductList + CatalogSearch + FormFields |
| SalesReview / custom renderer in form designer | **Deleted** — layout widgets + presets only |
| Designer writes of `formKey` on new activities | **Stopped** — AssetRef only (read path may still resolve legacy `formKey`) |
| `showItems` checkbox in form designer | **Removed** — use ProductList widget |
| Order PATCH task side-effects | **Migrated** to adapter via `completeTaskByAction` |

## Remaining ops

- After deploy, run `npx tsx scripts/reset-workflow-v5.ts` (or `node scripts/reset-workflow-v5.cjs`) to wipe any pre-greenfield instances if present.
- Republish is automatic on next `GET /api/workflow-templates` (`ensureSeed`).

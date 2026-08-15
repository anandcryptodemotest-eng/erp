/**
 * One-shot: force-publish latest starter form bodies for a tenant (bypasses customized gate).
 *
 *   cd apps/sales && DATABASE_URL=... pnpm exec tsx ../../scripts/force-publish-starter-forms.ts
 *
 * Env:
 *   TENANT_ID (required) — gateway Tenant.id
 *   FORM_IDS — comma-separated, default: dispatch
 */

import { forcePublishStarterForms } from "../apps/sales/src/lib/form-catalog";

const tenantId = process.env.TENANT_ID?.trim();
const formIds = (process.env.FORM_IDS ?? "dispatch")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  if (!tenantId) throw new Error("TENANT_ID required");
  if (formIds.length === 0) throw new Error("FORM_IDS empty");
  console.log(`Force-publish starters tenant=${tenantId} forms=${formIds.join(",")}`);
  const rows = await forcePublishStarterForms(tenantId, formIds);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

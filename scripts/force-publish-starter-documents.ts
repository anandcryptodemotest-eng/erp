/**
 * One-shot: force-publish latest starter document bodies for a tenant.
 *
 *   cd apps/sales && DATABASE_URL=... TENANT_ID=<uuid> \
 *     pnpm exec tsx ../../scripts/force-publish-starter-documents.ts
 *
 * Env:
 *   TENANT_ID (required) — gateway Tenant.id
 *   DOCUMENT_IDS — comma-separated, default: tax-invoice,commercial-invoice,bill-of-supply
 */

import { forcePublishStarterDocuments } from "../apps/sales/src/lib/document-catalog";

const tenantId = process.env.TENANT_ID?.trim();
const documentIds = (process.env.DOCUMENT_IDS ?? "tax-invoice,commercial-invoice,bill-of-supply")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  if (!tenantId) throw new Error("TENANT_ID required");
  if (documentIds.length === 0) throw new Error("DOCUMENT_IDS empty");
  console.log(`Force-publish starters tenant=${tenantId} documents=${documentIds.join(",")}`);
  const rows = await forcePublishStarterDocuments(tenantId, documentIds);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

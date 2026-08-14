import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/lib/platform-auth";
import { requireTenantAdmin } from "@/lib/billing-auth";
import { ensureBillingCatalog, runBilling } from "@/lib/billing-core";

/** POST /api/billing/run — generate OPEN invoices for due subscriptions (does not extend entitlement).
 *  Optional `{ asOf }` is DEMO-only; LIVE rejects it with 400. */
export async function POST(request: Request) {
  const platform = await requirePlatformAuth(request, "manageLicenses");
  if (platform instanceof NextResponse) {
    const tenant = await requireTenantAdmin(request);
    if (tenant instanceof NextResponse) return platform;
  }

  const cfg = await ensureBillingCatalog();
  const body = (await request.json().catch(() => ({}))) as { asOf?: unknown };
  let now = new Date();
  if (typeof body.asOf === "string" && body.asOf.length > 0) {
    if (cfg.mode === "LIVE") {
      return NextResponse.json({ error: "asOf is not allowed in LIVE mode" }, { status: 400 });
    }
    const parsed = new Date(body.asOf);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "asOf must be a valid ISO timestamp" }, { status: 400 });
    }
    now = parsed;
  }

  const run = await runBilling(now);
  return NextResponse.json({ data: run });
}

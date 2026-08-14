import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/billing-auth";
import { demoPayInvoice, ensureBillingCatalog } from "@/lib/billing-core";

const bodySchema = z.object({
  invoiceId: z.string().min(1),
});

/** POST /api/billing/demo-pay — DEMO provider settles an OPEN SaaS invoice. */
export async function POST(request: Request) {
  const auth = await requireTenantAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const cfg = await ensureBillingCatalog();
  if (cfg.mode === "LIVE") {
    return NextResponse.json({ error: "demo-pay is blocked in LIVE mode" }, { status: 409 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  const result = await demoPayInvoice({ tenantId: auth.tenantId, invoiceId: parsed.data.invoiceId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result });
}

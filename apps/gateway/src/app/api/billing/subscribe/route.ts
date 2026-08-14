import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAdmin } from "@/lib/billing-auth";
import { subscribeTenant } from "@/lib/billing-core";

const bodySchema = z.object({ planId: z.string().min(1) });

/** POST /api/billing/subscribe — OPEN invoice for a paid plan; current entitlement stays until PAID. */
export async function POST(request: Request) {
  const auth = await requireTenantAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "planId is required" }, { status: 400 });
  const result = await subscribeTenant({ tenantId: auth.tenantId, planId: parsed.data.planId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    data: {
      status: result.subscription.status,
      subscriptionId: result.subscription.id,
      invoiceId: result.invoice?.id ?? null,
      invoiceNumber: result.invoice?.invoiceNumber ?? null,
      amountPaise: result.invoice?.totalPaise ?? 0,
      billingPeriodKey: result.invoice?.billingPeriodKey ?? null,
      featureCodes: result.subscription.featureCodes,
      billingInterval: result.plan.billingInterval,
    },
  });
}

import { NextResponse } from "next/server";
import { requireTenantUser } from "@/lib/billing-auth";
import { prisma } from "@/lib/prisma";
import { ensureBillingCatalog, getTenantEntitlement } from "@/lib/billing-core";

/** GET /api/billing/subscription — agreement + open invoices + entitlement. */
export async function GET(request: Request) {
  const auth = await requireTenantUser(request);
  if (auth instanceof NextResponse) return auth;
  const cfg = await ensureBillingCatalog();
  const entitlement = await getTenantEntitlement(auth.tenantId);
  const sub = await prisma.billingSubscription.findUnique({
    where: { tenantId: auth.tenantId },
    include: {
      plan: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 20 },
      payments: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  return NextResponse.json({
    data: {
      mode: cfg.mode,
      graceDays: cfg.graceDays,
      reminderDays: cfg.reminderDays,
      entitlement,
      subscription: sub,
    },
  });
}

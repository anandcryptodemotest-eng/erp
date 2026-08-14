import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAuth } from "@/lib/platform-auth";
import { grantPaidPlanDemo } from "@/lib/billing-core";

type Ctx = { params: Promise<{ id: string }> };
const bodySchema = z.object({ planCode: z.string().min(1).default("growth_monthly") });

/** POST /api/platform/tenants/:id/billing/grant — DEMO only. Pays a plan so E2E/demo tenants have OMS. */
export async function POST(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "manageLicenses");
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({ planCode: "growth_monthly" })));
  if (!parsed.success) return NextResponse.json({ error: "planCode is required" }, { status: 400 });
  const result = await grantPaidPlanDemo({ tenantId: id, planCode: parsed.data.planCode });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result });
}

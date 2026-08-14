import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { ensureBillingCatalog } from "@/lib/billing-core";

/** GET /api/billing/features — catalog for platform matrix. */
export async function GET(request: Request) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;
  await ensureBillingCatalog();
  const features = await prisma.saasFeature.findMany({ orderBy: { code: "asc" } });
  return NextResponse.json({ data: features });
}

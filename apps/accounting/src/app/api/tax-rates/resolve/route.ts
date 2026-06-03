import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tax-rates/resolve?countryCode=IN&code=GST_5
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const countryCode = (url.searchParams.get("countryCode") ?? "IN").toUpperCase();
  const rawCode = url.searchParams.get("code");
  const code = rawCode ? rawCode.trim() : undefined;

  const where = {
    tenantId,
    countryCode,
    isActive: true,
    ...(code ? { code } : {}),
  };

  const taxRate = await prisma.taxRate.findFirst({
    where,
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  if (!taxRate) {
    return NextResponse.json(
      { error: code ? `Tax code ${code} not found for ${countryCode}` : `Default tax not found for ${countryCode}` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      id: taxRate.id,
      countryCode: taxRate.countryCode,
      code: taxRate.code,
      name: taxRate.name,
      taxType: taxRate.taxType,
      rate: taxRate.rate,
      isDefault: taxRate.isDefault,
    },
  });
}

import { NextResponse } from "next/server";
import { suggestTaxFromHsn } from "@/lib/tax-resolution";

// GET /api/products/tax-suggest?hsnCode=040120&countryCode=IN
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const hsnCode = url.searchParams.get("hsnCode");
  const countryCode = (url.searchParams.get("countryCode") ?? "IN").toUpperCase();

  if (countryCode !== "IN") {
    return NextResponse.json({ error: "HSN suggestion endpoint currently supports IN only" }, { status: 400 });
  }

  const suggestion = await suggestTaxFromHsn(hsnCode);
  return NextResponse.json({ data: { hsnCode, countryCode, ...suggestion } });
}

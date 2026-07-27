import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/customers/me
 * Resolve the Sales Customer row linked to the logged-in portal user (JWT userId).
 */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { tenantId, portalUserId: userId, isActive: true },
    include: {
      addresses: { where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
    },
  });

  if (!customer) {
    // Staff roles may not have a portal link
    if (role === "CUSTOMER") {
      return NextResponse.json({ error: "No customer profile linked to this login" }, { status: 404 });
    }
    return NextResponse.json({ error: "Not a portal customer" }, { status: 404 });
  }

  return NextResponse.json({ data: customer });
}

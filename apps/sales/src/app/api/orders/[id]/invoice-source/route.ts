import { NextResponse } from "next/server";
import { getServiceSecret } from "@erp/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/orders/:id/invoice-source — minimal order data for invoice generation (no workflow) */
export async function GET(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const serviceKey = request.headers.get("x-service-key");
  const isService = !!getServiceSecret() && serviceKey === getServiceSecret();
  if (!isService) {
    return NextResponse.json({ error: "Service auth required" }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      items: true,
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({ data: order });
}

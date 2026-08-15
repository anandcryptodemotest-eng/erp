import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/orders/:id/invoice-lines — persist qty/unitPrice before Generate invoice PDF.
 * Staff-only; Accounting generate always reads Sales invoice-source afterward.
 */
export async function PUT(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const { id } = await params;
  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    items?: { id?: string; orderItemId?: string; quantity?: number; unitPrice?: number }[];
  };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ data: order });
  }

  await prisma.$transaction(async (tx) => {
    for (const raw of body.items!) {
      const lineId = String(raw.id ?? raw.orderItemId ?? "");
      if (!lineId || lineId.startsWith("new-")) continue;
      const existing = order.items.find((i) => i.id === lineId);
      if (!existing) continue;
      const quantity = Math.max(
        1,
        Math.round(Number(raw.quantity ?? existing.quantity) || existing.quantity)
      );
      const unitPrice = Math.max(0, Number(raw.unitPrice ?? existing.unitPrice) || 0);
      const total = Math.round(quantity * unitPrice * 100) / 100;
      await tx.salesOrderItem.update({
        where: { id: lineId },
        data: { quantity, unitPrice, total },
      });
    }
    const refreshed = await tx.salesOrderItem.findMany({ where: { salesOrderId: id } });
    const subtotal = refreshed.reduce((s, i) => s + i.total, 0);
    await tx.salesOrder.update({
      where: { id },
      data: {
        subtotal,
        total: subtotal + order.tax + order.deliveryFee - order.couponDiscount,
      },
    });
  });

  const updated = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    include: { items: true, customer: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ data: updated });
}

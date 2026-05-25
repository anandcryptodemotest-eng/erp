import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createReturnSchema = z.object({
  orderId: z.string(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    orderItemId: z.string(),
    productId: z.string(),
    productName: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
});

// GET /api/returns
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  const vendorId = url.searchParams.get("vendorId") ?? undefined;

  const where = {
    tenantId,
    ...(status && { status }),
    ...(vendorId && { vendorId }),
  };

  const [returns, total] = await Promise.all([
    prisma.purchaseReturn.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.purchaseReturn.count({ where }),
  ]);

  return NextResponse.json({ data: returns, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/returns
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) return NextResponse.json({ error: "Auth context required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createReturnSchema.parse(body);

    const order = await prisma.purchaseOrder.findFirst({
      where: { id: data.orderId, tenantId },
      include: { items: true },
    });
    if (!order) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    if (!["RECEIVED", "PARTIALLY_RECEIVED"].includes(order.status)) {
      return NextResponse.json({ error: "Can only return received purchase orders" }, { status: 409 });
    }

    // Validate quantities: returned qty must not exceed received qty
    for (const returnItem of data.items) {
      const orderItem = order.items.find((i) => i.id === returnItem.orderItemId);
      if (!orderItem) {
        return NextResponse.json({ error: `Order item ${returnItem.orderItemId} not found on this order` }, { status: 400 });
      }
      if (returnItem.quantity > orderItem.receivedQty) {
        return NextResponse.json(
          { error: `Return quantity ${returnItem.quantity} exceeds received quantity ${orderItem.receivedQty} for ${orderItem.productName}` },
          { status: 409 }
        );
      }
    }

    const TAX_RATE = parseFloat(process.env.TAX_RATE ?? "0.10");
    const returnItems = data.items.map((item) => ({ ...item, total: item.quantity * item.unitPrice }));
    const subtotal = returnItems.reduce((sum, i) => sum + i.total, 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const count = await prisma.purchaseReturn.count({ where: { tenantId } });
    const returnNumber = `PR-${String(count + 1).padStart(5, "0")}`;

    const purchaseReturn = await prisma.purchaseReturn.create({
      data: {
        tenantId,
        returnNumber,
        orderId: data.orderId,
        vendorId: order.vendorId,
        userId,
        reason: data.reason,
        notes: data.notes,
        subtotal,
        tax,
        total,
        items: { create: returnItems },
      },
      include: { items: true, order: { select: { id: true, orderNumber: true } } },
    });

    return NextResponse.json({ data: purchaseReturn }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

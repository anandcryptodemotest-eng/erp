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
    quantity: z.number().positive(), // Float: allows returning weight-based lines (e.g. 0.5 kg)
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
  const customerId = url.searchParams.get("customerId") ?? undefined;

  const where = {
    tenantId,
    ...(status && { status }),
    ...(customerId && { customerId }),
  };

  const [returns, total] = await Promise.all([
    prisma.salesReturn.findMany({
      where,
      include: { customer: { select: { id: true, name: true } }, order: { select: { id: true, orderNumber: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.salesReturn.count({ where }),
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

    const role = request.headers.get("x-user-role");

    const order = await prisma.salesOrder.findFirst({
      where: { id: data.orderId, tenantId },
      include: { items: true, customer: { select: { id: true, portalUserId: true } } },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // A customer may only open a return against their OWN order.
    if (role === "CUSTOMER" && order.customer?.portalUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Returnable once the goods have reached the customer. DELIVERED is included so
    // the grocery flow (which deducts stock at dispatch, not via 'ship') is returnable.
    if (!["SHIPPED", "INVOICED", "PARTIALLY_SHIPPED", "DELIVERED", "PAID", "CLOSED"].includes(order.status)) {
      return NextResponse.json({ error: "Can only return delivered, shipped, or invoiced orders" }, { status: 409 });
    }

    // Returnable quantity per line = shippedQty when the order went through the
    // ship path; otherwise (delivered/invoiced grocery orders) the ordered quantity.
    for (const returnItem of data.items) {
      const orderItem = order.items.find((i) => i.id === returnItem.orderItemId);
      if (!orderItem) {
        return NextResponse.json({ error: `Order item ${returnItem.orderItemId} not found on this order` }, { status: 400 });
      }
      const returnable = orderItem.shippedQty > 0 ? orderItem.shippedQty : orderItem.quantity;
      if (returnItem.quantity > returnable) {
        return NextResponse.json(
          { error: `Return quantity ${returnItem.quantity} exceeds returnable quantity ${returnable} for ${orderItem.productName}` },
          { status: 409 }
        );
      }
    }

    // Tax on a return mirrors the tax on the ORIGINAL order line (credit back what
    // was charged), not a flat house rate. SalesOrderItem.taxRate is a fraction
    // (e.g. 0.18); 0 when the product had no GST configured.
    const returnItems = data.items.map((item) => ({ ...item, total: item.quantity * item.unitPrice }));
    const subtotal = returnItems.reduce((sum, i) => sum + i.total, 0);
    const tax = returnItems.reduce((sum, i) => {
      const orderItem = order.items.find((o) => o.id === i.orderItemId);
      const rate = orderItem?.taxRate ?? 0;
      return sum + i.total * rate;
    }, 0);
    const total = subtotal + tax;

    const count = await prisma.salesReturn.count({ where: { tenantId } });
    const returnNumber = `SR-${String(count + 1).padStart(5, "0")}`;

    const salesReturn = await prisma.salesReturn.create({
      data: {
        tenantId,
        returnNumber,
        orderId: data.orderId,
        customerId: order.customerId,
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

    return NextResponse.json({ data: salesReturn }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createOrderSchema = z.object({
  customerId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })),
});

// GET /api/orders
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const orders = await prisma.salesOrder.findMany({
    where: { tenantId },
    include: { customer: true, items: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: orders });
}

// POST /api/orders
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = createOrderSchema.parse(body);

    const items = data.items.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    // Generate order number
    const count = await prisma.salesOrder.count({ where: { tenantId } });
    const orderNumber = `SO-${String(count + 1).padStart(5, "0")}`;

    const order = await prisma.salesOrder.create({
      data: {
        tenantId,
        orderNumber,
        customerId: data.customerId,
        userId,
        date: new Date(data.date),
        subtotal,
        tax,
        total,
        notes: data.notes,
        items: { create: items },
      },
      include: { items: true, customer: true },
    });

    // TODO: Emit ORDER_CREATED event to inventory service for stock reservation

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

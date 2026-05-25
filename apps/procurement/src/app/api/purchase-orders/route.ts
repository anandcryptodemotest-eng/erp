import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createPOSchema = z.object({
  vendorId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })),
});

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const status = url.searchParams.get("status") ?? undefined;
  const vendorId = url.searchParams.get("vendorId") ?? undefined;

  const where = { tenantId, ...(status && { status }), ...(vendorId && { vendorId }) };
  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: { vendor: { select: { id: true, name: true } }, items: true },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return NextResponse.json({ data: orders, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) return NextResponse.json({ error: "Auth required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createPOSchema.parse(body);

    const items = data.items.map((i) => ({ ...i, total: i.quantity * i.unitPrice }));
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const TAX_RATE = parseFloat(process.env.TAX_RATE ?? "0.10");
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const count = await prisma.purchaseOrder.count({ where: { tenantId } });
    const orderNumber = `PO-${String(count + 1).padStart(5, "0")}`;

    const order = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        orderNumber,
        vendorId: data.vendorId,
        userId,
        date: new Date(data.date),
        subtotal,
        tax,
        total,
        notes: data.notes,
        items: { create: items },
      },
      include: { vendor: true, items: true },
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

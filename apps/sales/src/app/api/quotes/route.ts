import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createQuoteSchema = z.object({
  opportunityId: z.string().optional(),
  customerId: z.string(),
  date: z.string().datetime(),
  validUntil: z.string().datetime(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    discount: z.number().min(0).max(100).default(0),
  })).min(1),
});

// GET /api/quotes
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
    isActive: true,
    ...(status && { status }),
    ...(customerId && { customerId }),
  };

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.quote.count({ where }),
  ]);

  return NextResponse.json({ data: quotes, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/quotes
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) return NextResponse.json({ error: "Auth context required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createQuoteSchema.parse(body);

    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, tenantId } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const TAX_RATE = parseFloat(process.env.TAX_RATE ?? "0.10");
    const items = data.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
      return { ...item, total: lineTotal };
    });
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const count = await prisma.quote.count({ where: { tenantId } });
    const quoteNumber = `QT-${String(count + 1).padStart(5, "0")}`;

    const quote = await prisma.quote.create({
      data: {
        tenantId,
        quoteNumber,
        opportunityId: data.opportunityId,
        customerId: data.customerId,
        userId,
        date: new Date(data.date),
        validUntil: new Date(data.validUntil),
        subtotal,
        tax,
        total,
        notes: data.notes,
        items: { create: items },
      },
      include: { items: true, customer: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ data: quote }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

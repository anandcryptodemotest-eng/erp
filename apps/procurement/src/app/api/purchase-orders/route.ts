import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";
import { z } from "zod";

const createPOSchema = z.object({
  vendorId: z.string(),
  date: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    productName: z.string(),
    // Fields used to auto-create the product when productId is absent
    productSku: z.string().optional(),
    productUnit: z.string().default("pcs"),
    productCostPrice: z.number().nonnegative().optional(),
    variantId: z.string().optional(),
    quantity: z.number().positive(),    // Float for weight-based purchasing (e.g. 50.5 kg)
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

    // Auto-create any new products in inventory service
    const resolvedItems = await Promise.all(
      data.items.map(async (item) => {
        if (item.productId) return item;

        const sku = item.productSku ?? `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const result = await serviceClient.call("inventory", "/api/products", {
          method: "POST",
          body: {
            sku,
            name: item.productName,
            unit: item.productUnit,
            costPrice: item.productCostPrice ?? item.unitPrice,
            sellPrice: item.unitPrice,
          },
          tenantId,
          userId,
        });

        const newProduct = (result.data as { data?: { id?: string } });
        const productId = newProduct?.data?.id;
        if (!productId) throw new Error(`Failed to create product: ${item.productName}`);
        return { ...item, productId };
      })
    );

    const items = resolvedItems.map((i) => ({
      productId: i.productId!,
      productName: i.productName,
      variantId: i.variantId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.quantity * i.unitPrice,
    }));
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

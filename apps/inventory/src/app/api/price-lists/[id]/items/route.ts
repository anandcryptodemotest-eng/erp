import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const priceListItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  minQty: z.number().int().min(1).default(1),
  price: z.number().positive(),
});

const bulkUpsertSchema = z.object({
  items: z.array(priceListItemSchema).min(1),
});

// GET /api/price-lists/:id/items
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const priceList = await prisma.priceList.findFirst({ where: { id, tenantId } });
  if (!priceList) return NextResponse.json({ error: "Price list not found" }, { status: 404 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const skip = (page - 1) * limit;
  const productId = url.searchParams.get("productId") ?? undefined;

  const where = { priceListId: id, ...(productId && { productId }) };
  const [items, total] = await Promise.all([
    prisma.priceListItem.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
      },
      orderBy: [{ productId: "asc" }, { minQty: "asc" }],
      skip,
      take: limit,
    }),
    prisma.priceListItem.count({ where }),
  ]);

  return NextResponse.json({ data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// PUT /api/price-lists/:id/items — bulk upsert (replace items for listed productIds)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const { items } = bulkUpsertSchema.parse(body);

    const priceList = await prisma.priceList.findFirst({ where: { id, tenantId } });
    if (!priceList) return NextResponse.json({ error: "Price list not found" }, { status: 404 });

    // Verify all products belong to this tenant
    const productIds = [...new Set(items.map((i) => i.productId))];
    const validProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true },
    });
    if (validProducts.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products not found" }, { status: 400 });
    }

    // Delete existing items for these products then re-insert (clean upsert)
    const result = await prisma.$transaction(async (tx) => {
      await tx.priceListItem.deleteMany({ where: { priceListId: id, productId: { in: productIds } } });
      return tx.priceListItem.createMany({
        data: items.map((item) => ({ ...item, priceListId: id })),
      });
    });

    return NextResponse.json({ data: { count: result.count } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/price-lists/:id/items?itemId=xxx — remove a single item
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const itemId = url.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId query param required" }, { status: 400 });

  const priceList = await prisma.priceList.findFirst({ where: { id, tenantId } });
  if (!priceList) return NextResponse.json({ error: "Price list not found" }, { status: 404 });

  const item = await prisma.priceListItem.findFirst({ where: { id: itemId, priceListId: id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.priceListItem.delete({ where: { id: itemId } });
  return NextResponse.json({ data: { id: itemId } });
}

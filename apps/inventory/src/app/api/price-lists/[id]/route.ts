import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updatePriceListSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  currency: z.string().length(3).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/price-lists/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const priceList = await prisma.priceList.findFirst({
    where: { id, tenantId },
    include: {
      items: {
        include: { product: { select: { id: true, sku: true, name: true } }, variant: { select: { id: true, sku: true, name: true } } },
        orderBy: [{ productId: "asc" }, { minQty: "asc" }],
      },
    },
  });

  if (!priceList) return NextResponse.json({ error: "Price list not found" }, { status: 404 });
  return NextResponse.json({ data: priceList });
}

// PATCH /api/price-lists/:id
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const data = updatePriceListSchema.parse(body);

    const existing = await prisma.priceList.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Price list not found" }, { status: 404 });

    const priceList = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.priceList.updateMany({ where: { tenantId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.priceList.update({ where: { id }, data });
    });

    return NextResponse.json({ data: priceList });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/price-lists/:id — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.priceList.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Price list not found" }, { status: 404 });

  await prisma.priceList.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/warehouses/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const warehouse = await prisma.warehouse.findFirst({
    where: { id, tenantId },
    include: {
      stocks: { include: { product: { select: { id: true, sku: true, name: true, reorderLevel: true } } } },
    },
  });

  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  return NextResponse.json({ data: warehouse });
}

// PATCH /api/warehouses/:id
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
    const data = updateWarehouseSchema.parse(body);

    const existing = await prisma.warehouse.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

    const warehouse = await prisma.warehouse.update({ where: { id }, data });
    return NextResponse.json({ data: warehouse });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/warehouses/:id — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.warehouse.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  await prisma.warehouse.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

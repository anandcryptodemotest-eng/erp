import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateVariantSchema = z.object({
  name: z.string().min(1).optional(),
  attributes: z.record(z.string()).optional(),
  costPrice: z.number().positive().optional(),
  sellPrice: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/products/:id/variants/:vid
export async function GET(request: Request, { params }: { params: Promise<{ id: string; vid: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id, vid } = await params;
  const variant = await prisma.productVariant.findFirst({
    where: { id: vid, productId: id, tenantId },
  });

  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  return NextResponse.json({ data: variant });
}

// PATCH /api/products/:id/variants/:vid
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; vid: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id, vid } = await params;
  try {
    const body = await request.json();
    const data = updateVariantSchema.parse(body);

    const existing = await prisma.productVariant.findFirst({ where: { id: vid, productId: id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

    const variant = await prisma.productVariant.update({ where: { id: vid }, data });
    return NextResponse.json({ data: variant });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/products/:id/variants/:vid — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; vid: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const { id, vid } = await params;
  const existing = await prisma.productVariant.findFirst({ where: { id: vid, productId: id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

  await prisma.productVariant.update({ where: { id: vid }, data: { isActive: false } });
  return NextResponse.json({ data: { id: vid } });
}

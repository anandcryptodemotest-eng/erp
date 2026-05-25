import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateTaxRateSchema = z.object({
  name: z.string().min(1).optional(),
  rate: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const rate = await prisma.taxRate.findFirst({ where: { id, tenantId } });
  if (!rate) return NextResponse.json({ error: "Tax rate not found" }, { status: 404 });
  return NextResponse.json({ data: rate });
}

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
    const data = updateTaxRateSchema.parse(body);

    const existing = await prisma.taxRate.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Tax rate not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.taxRate.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.taxRate.update({ where: { id }, data });
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.taxRate.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Tax rate not found" }, { status: 404 });

  await prisma.taxRate.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

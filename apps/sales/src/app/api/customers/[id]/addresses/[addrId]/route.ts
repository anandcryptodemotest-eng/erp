import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1).optional(),
  line2: z.string().nullable().optional(),
  city: z.string().min(1).optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addrId: string }> }
) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const { id, addrId } = await params;

  const address = await prisma.customerAddress.findFirst({
    where: { id: addrId, customerId: id, tenantId, isActive: true },
  });
  if (!address) return NextResponse.json({ error: "Address not found" }, { status: 404 });
  return NextResponse.json({ data: address });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addrId: string }> }
) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const { id, addrId } = await params;

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addrId, customerId: id, tenantId, isActive: true },
  });
  if (!existing) return NextResponse.json({ error: "Address not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const address = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId: id, tenantId, isDefault: true, id: { not: addrId } },
        data: { isDefault: false },
      });
    }
    return tx.customerAddress.update({ where: { id: addrId }, data: parsed.data });
  });

  return NextResponse.json({ data: address });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addrId: string }> }
) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const { id, addrId } = await params;

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addrId, customerId: id, tenantId, isActive: true },
  });
  if (!existing) return NextResponse.json({ error: "Address not found" }, { status: 404 });

  await prisma.customerAddress.update({ where: { id: addrId }, data: { isActive: false } });
  return NextResponse.json({ data: { id: addrId } });
}

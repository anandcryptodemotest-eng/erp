import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1).optional(),
  pincodes: z.array(z.string().min(1)).min(1).optional(),
  deliveryFee: z.number().min(0).optional(),
  minOrderAmount: z.number().min(0).optional(),
  estimatedMins: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const { id } = await params;
  const zone = await prisma.deliveryZone.findFirst({ where: { id, tenantId } });
  if (!zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  return NextResponse.json({ data: zone });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.deliveryZone.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const zone = await prisma.deliveryZone.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ data: zone });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.deliveryZone.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Zone not found" }, { status: 404 });

  await prisma.deliveryZone.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { success: true } });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const blockSchema = z.object({
  reason: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const role = request.headers.get("x-user-role");
  const { id } = await params;

  if (!["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({ where: { id, tenantId, isActive: true } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (customer.isBlocked) return NextResponse.json({ error: "Customer is already blocked" }, { status: 409 });

  const body = await request.json().catch(() => null);
  const parsed = blockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: { isBlocked: true, blockedReason: parsed.data.reason, blockedAt: new Date() },
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const role = request.headers.get("x-user-role");
  const { id } = await params;

  if (!["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({ where: { id, tenantId, isActive: true } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!customer.isBlocked) return NextResponse.json({ error: "Customer is not blocked" }, { status: 409 });

  const updated = await prisma.customer.update({
    where: { id },
    data: { isBlocked: false, blockedReason: null, blockedAt: null },
  });
  return NextResponse.json({ data: updated });
}

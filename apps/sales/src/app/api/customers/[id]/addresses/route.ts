import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCustomerAccess } from "@/lib/customer-access";

const createSchema = z.object({
  label: z.string().default("Home"),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  pincode: z.string().min(1),
  isDefault: z.boolean().default(false),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  const { id } = await params;

  const access = await assertCustomerAccess({ tenantId, customerId: id, userId, role });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const customer = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const addresses = await prisma.customerAddress.findMany({
    where: { customerId: id, tenantId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ data: addresses });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  const { id } = await params;

  const access = await assertCustomerAccess({ tenantId, customerId: id, userId, role });
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const customer = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const address = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId: id, tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.customerAddress.create({ data: { tenantId, customerId: id, ...parsed.data } });
  });

  return NextResponse.json({ data: address }, { status: 201 });
}

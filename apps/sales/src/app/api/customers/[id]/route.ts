import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/customers/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId },
    include: {
      orders: {
        where: { status: { notIn: ["CANCELLED"] } },
        select: { id: true, orderNumber: true, status: true, total: true, date: true },
        orderBy: { date: "desc" },
        take: 10,
      },
    },
  });

  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Compute outstanding balance (confirmed/partially_shipped orders)
  const outstanding = await prisma.salesOrder.aggregate({
    where: { tenantId, customerId: id, status: { in: ["CONFIRMED", "PARTIALLY_SHIPPED"] } },
    _sum: { total: true },
  });

  return NextResponse.json({ data: { ...customer, outstandingBalance: outstanding._sum.total ?? 0 } });
}

// PATCH /api/customers/:id
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
    const data = updateCustomerSchema.parse(body);

    const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const customer = await prisma.customer.update({ where: { id }, data });
    return NextResponse.json({ data: customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/customers/:id — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  await prisma.customer.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  department: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  salary: z.number().positive().optional(),
  taxSlabId: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/employees/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const employee = await prisma.employee.findFirst({
    where: { id, tenantId },
    include: {
      taxSlab: true,
      payroll: { orderBy: { period: "desc" }, take: 5 },
      leave: { orderBy: { startDate: "desc" }, take: 5 },
    },
  });

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  return NextResponse.json({ data: employee });
}

// PATCH /api/employees/:id
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
    const data = updateEmployeeSchema.parse(body);

    const existing = await prisma.employee.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const employee = await prisma.employee.update({ where: { id }, data });
    return NextResponse.json({ data: employee });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    const e = error as { code?: string };
    if (e.code === "P2002") return NextResponse.json({ error: "Employee ID or email already exists" }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/employees/:id — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.employee.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  await prisma.employee.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

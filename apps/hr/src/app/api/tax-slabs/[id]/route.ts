import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateTaxSlabSchema = z.object({
  name: z.string().min(1).optional(),
  minIncome: z.number().min(0).optional(),
  maxIncome: z.number().positive().optional(),
  rate: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const slab = await prisma.taxSlab.findFirst({
    where: { id, tenantId },
    include: { employees: { select: { id: true, employeeId: true, firstName: true, lastName: true } } },
  });

  if (!slab) return NextResponse.json({ error: "Tax slab not found" }, { status: 404 });
  return NextResponse.json({ data: slab });
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
    const data = updateTaxSlabSchema.parse(body);

    const existing = await prisma.taxSlab.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Tax slab not found" }, { status: 404 });

    const slab = await prisma.taxSlab.update({ where: { id }, data });
    return NextResponse.json({ data: slab });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

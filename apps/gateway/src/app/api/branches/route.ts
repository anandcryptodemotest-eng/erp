import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
});

// GET /api/branches
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const data = await prisma.branch.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ data });
}

// POST /api/branches
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role && !["ADMIN", "ORG_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    if (data.isDefault) {
      await prisma.branch.updateMany({ where: { tenantId }, data: { isDefault: false } });
    }

    const branch = await prisma.branch.create({ data: { ...data, tenantId } });
    return NextResponse.json({ data: branch }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Branch code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
});

// GET /api/warehouses
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = { tenantId, isActive: true };
  const [warehouses, total] = await Promise.all([
    prisma.warehouse.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
    prisma.warehouse.count({ where }),
  ]);

  return NextResponse.json({ data: warehouses, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/warehouses
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createWarehouseSchema.parse(body);
    const warehouse = await prisma.warehouse.create({ data: { ...data, tenantId } });
    return NextResponse.json({ data: warehouse }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

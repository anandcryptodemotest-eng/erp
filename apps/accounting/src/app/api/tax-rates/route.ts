import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTaxRateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  rate: z.number().min(0).max(100),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

// GET /api/tax-rates
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = { tenantId, isActive: true };
  const [rates, total] = await Promise.all([
    prisma.taxRate.findMany({ where, orderBy: { code: "asc" }, skip, take: limit }),
    prisma.taxRate.count({ where }),
  ]);

  return NextResponse.json({ data: rates, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/tax-rates
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createTaxRateSchema.parse(body);

    const taxRate = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.taxRate.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.taxRate.create({ data: { ...data, tenantId } });
    });

    return NextResponse.json({ data: taxRate }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    const e = error as { code?: string };
    if (e.code === "P2002") return NextResponse.json({ error: "Tax rate code already exists" }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

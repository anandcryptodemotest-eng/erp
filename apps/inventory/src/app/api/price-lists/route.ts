import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requirePriceListRead, requirePriceListWrite } from "@erp/auth";

const createPriceListSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  currency: z.string().length(3).default("USD"),
  isDefault: z.boolean().default(false),
});

// GET /api/price-lists
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const denied = requirePriceListRead(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = { tenantId, isActive: true };
  const [priceLists, total] = await Promise.all([
    prisma.priceList.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
    prisma.priceList.count({ where }),
  ]);

  return NextResponse.json({ data: priceLists, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/price-lists
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const denied = requirePriceListWrite(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const data = createPriceListSchema.parse(body);

    // If marking as default, unset existing default first
    const priceList = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.priceList.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.priceList.create({ data: { ...data, tenantId } });
    });

    return NextResponse.json({ data: priceList }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

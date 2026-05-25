import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().default("pcs"),
  costPrice: z.number().positive(),
  sellPrice: z.number().positive(),
  reorderLevel: z.number().int().min(0).default(10),
});

// GET /api/products
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true },
    include: { stocks: { include: { warehouse: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: products });
}

// POST /api/products
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createProductSchema.parse(body);

    const product = await prisma.product.create({
      data: { ...data, tenantId },
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "SKU already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

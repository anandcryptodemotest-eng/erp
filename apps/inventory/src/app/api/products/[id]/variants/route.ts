import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createVariantSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  attributes: z.record(z.string()),
  costPrice: z.number().positive().optional(),
  sellPrice: z.number().positive().optional(),
});

// GET /api/products/:id/variants
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, tenantId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = { productId: id, tenantId, isActive: true };
  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
    prisma.productVariant.count({ where }),
  ]);

  return NextResponse.json({ data: variants, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/products/:id/variants
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const data = createVariantSchema.parse(body);

    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const variant = await prisma.productVariant.create({
      data: { ...data, productId: id, tenantId },
    });
    return NextResponse.json({ data: variant }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Variant SKU already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

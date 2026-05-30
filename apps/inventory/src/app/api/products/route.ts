import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  barcode: z.string().optional(),
  pluCode: z.string().optional(),       // PLU for weight-based items (no barcode)
  imageUrls: z.array(z.string().url()).optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.string().optional(),
  unit: z.string().default("pcs"),      // pcs | kg | g | liter | ml | dozen | bag
  sellByWeight: z.boolean().default(false), // true = price × weight at billing
  costPrice: z.number().nonnegative(),
  sellPrice: z.number().nonnegative(),  // per unit; for weight items = per kg
  reorderLevel: z.number().min(0).default(10), // Float so loose items support e.g. 5.0 kg min
  hasVariants: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

// GET /api/products
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const search = url.searchParams.get("search") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const brandId = url.searchParams.get("brandId") ?? undefined;
  const barcode = url.searchParams.get("barcode") ?? undefined;
  const isFeatured = url.searchParams.get("isFeatured") === "true" ? true : undefined;
  const lowStock = url.searchParams.get("lowStock") === "true";

  const where = {
    tenantId,
    isActive: true,
    ...(search && { name: { contains: search, mode: "insensitive" as const } }),
    ...(categoryId && { categoryId }),
    ...(brandId && { brandId }),
    ...(barcode && { barcode }),
    ...(isFeatured !== undefined && { isFeatured }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        stocks: { include: { warehouse: { select: { id: true, name: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  // If lowStock filter requested, post-filter by reorder level
  const data = lowStock
    ? products.filter((p) => p.stocks.some((s) => s.quantity <= p.reorderLevel))
    : products;

  return NextResponse.json({ data, meta: { page, limit, total: lowStock ? data.length : total, pages: Math.ceil((lowStock ? data.length : total) / limit) } });
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
      return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

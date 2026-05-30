import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isFeatured: z.boolean().default(false),
  bannerImageUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
});

// GET /api/products/categories
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = { tenantId, isActive: true };
  const [categories, total] = await Promise.all([
    prisma.productCategory.findMany({
      where,
      include: { children: { where: { isActive: true } } },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.productCategory.count({ where }),
  ]);

  return NextResponse.json({ data: categories, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/products/categories
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createCategorySchema.parse(body);

    const category = await prisma.productCategory.create({
      data: { ...data, tenantId },
    });
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

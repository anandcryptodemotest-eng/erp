import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const search = url.searchParams.get("search") ?? undefined;

  const where = {
    tenantId,
    isActive: true,
    ...(search && { name: { contains: search, mode: "insensitive" as const } }),
  };

  const [data, total] = await Promise.all([
    prisma.brand.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
    prisma.brand.count({ where }),
  ]);

  return NextResponse.json({ data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const brand = await prisma.brand.create({ data: { tenantId, ...parsed.data } });
    return NextResponse.json({ data: brand }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Brand name already exists" }, { status: 409 });
    }
    throw err;
  }
}

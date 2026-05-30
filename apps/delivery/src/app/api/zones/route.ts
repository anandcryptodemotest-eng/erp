import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  pincodes: z.array(z.string().min(1)).min(1),
  deliveryFee: z.number().min(0).default(0),
  minOrderAmount: z.number().min(0).default(0),
  estimatedMins: z.number().int().min(1).default(60),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.deliveryZone.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.deliveryZone.count({ where: { tenantId, isActive: true } }),
  ]);

  return NextResponse.json({ data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const zone = await prisma.deliveryZone.create({
      data: { tenantId, ...parsed.data },
    });
    return NextResponse.json({ data: zone }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Zone name already exists" }, { status: 409 });
    }
    throw err;
  }
}

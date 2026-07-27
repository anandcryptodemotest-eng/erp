import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const linkSchema = z.object({
  productId: z.string().min(1),
  vendorId: z.string().min(1),
  priority: z.number().int().min(1).default(1),
  isPreferred: z.boolean().default(false),
  leadTimeDays: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

// GET /api/product-vendors?productId=
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const vendorId = url.searchParams.get("vendorId");

  const links = await prisma.productVendor.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(productId && { productId }),
      ...(vendorId && { vendorId }),
    },
    include: { vendor: true },
    orderBy: [{ isPreferred: "desc" }, { priority: "asc" }],
  });

  return NextResponse.json({ data: links });
}

// POST /api/product-vendors
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = linkSchema.parse(body);

    const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, tenantId, isActive: true } });
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    if (data.isPreferred) {
      await prisma.productVendor.updateMany({
        where: { tenantId, productId: data.productId, isActive: true },
        data: { isPreferred: false },
      });
    }

    const link = await prisma.productVendor.upsert({
      where: {
        tenantId_productId_vendorId: {
          tenantId,
          productId: data.productId,
          vendorId: data.vendorId,
        },
      },
      create: { ...data, tenantId },
      update: {
        priority: data.priority,
        isPreferred: data.isPreferred,
        leadTimeDays: data.leadTimeDays,
        notes: data.notes,
        isActive: true,
      },
      include: { vendor: true },
    });

    return NextResponse.json({ data: link }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

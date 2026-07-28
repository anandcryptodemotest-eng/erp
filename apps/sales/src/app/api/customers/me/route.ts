import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * GET /api/customers/me
 * Resolve the Sales Customer row linked to the logged-in portal user (JWT userId).
 *
 * POST /api/customers/me
 * Bootstrap / update the portal customer profile for the logged-in CUSTOMER.
 */
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { tenantId, portalUserId: userId, isActive: true },
    include: {
      addresses: { where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
    },
  });

  if (!customer) {
    if (role === "CUSTOMER") {
      return NextResponse.json({ error: "No customer profile linked to this login" }, { status: 404 });
    }
    return NextResponse.json({ error: "Not a portal customer" }, { status: 404 });
  }

  return NextResponse.json({ data: customer });
}

const bootstrapSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
});

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  if (role !== "CUSTOMER") {
    return NextResponse.json({ error: "Only portal customers can bootstrap /me" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = bootstrapSchema.parse(body);

    const existing = await prisma.customer.findFirst({
      where: { tenantId, portalUserId: userId },
    });
    if (existing) {
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          email: data.email ?? existing.email,
          phone: data.phone ?? existing.phone,
          city: data.city ?? existing.city,
          isActive: true,
        },
        include: {
          addresses: { where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        },
      });
      return NextResponse.json({ data: updated });
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        portalUserId: userId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        city: data.city,
      },
      include: {
        addresses: { where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      },
    });
    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

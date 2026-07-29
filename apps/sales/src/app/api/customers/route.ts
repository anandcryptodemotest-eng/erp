import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const log = createLogger({ service: "sales" });

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  customerGroup: z.string().optional(),
  portalUserId: z.string().optional(),
});

// GET /api/customers
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  // Portal customers must use /api/customers/me — do not leak the directory
  if (role === "CUSTOMER") {
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const me = await prisma.customer.findFirst({
      where: { tenantId, portalUserId: userId, isActive: true },
      include: {
        addresses: { where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      },
    });
    if (!me) return NextResponse.json({ data: [], meta: { page: 1, limit: 1, total: 0, pages: 0 } });
    return NextResponse.json({ data: [me], meta: { page: 1, limit: 1, total: 1, pages: 1 } });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const search = url.searchParams.get("search") ?? undefined;
  const isBlocked = url.searchParams.get("isBlocked");

  const where = {
    tenantId,
    isActive: true,
    ...(search && { name: { contains: search, mode: "insensitive" as const } }),
    ...(isBlocked !== null && { isBlocked: isBlocked === "true" }),
  };
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { name: "asc" }, skip, take: limit }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({ data: customers, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/customers
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createCustomerSchema.parse(body);

    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        taxId: data.taxId,
        customerGroup: data.customerGroup,
        tenantId,
        portalUserId: data.portalUserId,
      },
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    log.error("customers_post", { err: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

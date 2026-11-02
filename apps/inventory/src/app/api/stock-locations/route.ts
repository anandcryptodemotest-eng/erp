import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const LOCATION_TYPES = ["WAREHOUSE", "CART", "VAN", "STORE", "KIOSK"] as const;

const createSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  type: z.enum(LOCATION_TYPES).default("CART"),
  branchId: z.string().optional(),
  operatorId: z.string().optional(),
  /** Optionally bind to an existing warehouse; otherwise one is auto-created. */
  warehouseId: z.string().optional(),
  location: z.string().optional(),
});

// GET /api/stock-locations?type=CART&status=ON_ROUTE&branchId=...
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const skip = (page - 1) * limit;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const branchId = url.searchParams.get("branchId") ?? undefined;

  const where = {
    tenantId,
    isActive: true,
    ...(type && { type }),
    ...(status && { status }),
    ...(branchId && { branchId }),
  };

  const [locations, total] = await Promise.all([
    prisma.stockLocation.findMany({
      where,
      orderBy: { code: "asc" },
      skip,
      take: limit,
      include: { warehouse: { select: { id: true, name: true } } },
    }),
    prisma.stockLocation.count({ where }),
  ]);

  return NextResponse.json({ data: locations, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/stock-locations — create a cart/van/store (auto-creates a backing warehouse).
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? "SYSTEM";
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const data = createSchema.parse(await request.json());

    const dup = await prisma.stockLocation.findFirst({ where: { tenantId, code: data.code } });
    if (dup) return NextResponse.json({ error: `Location code ${data.code} already exists` }, { status: 409 });

    // Resolve or create the backing warehouse (the real stock pool).
    let warehouseId = data.warehouseId;
    if (warehouseId) {
      const existing = await prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId } });
      if (!existing) return NextResponse.json({ error: "Backing warehouse not found" }, { status: 404 });
      const taken = await prisma.stockLocation.findUnique({ where: { warehouseId } });
      if (taken) return NextResponse.json({ error: "Warehouse already bound to a location" }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      if (!warehouseId) {
        // Name the backing warehouse so it sorts AFTER normal warehouses: the OMS
        // default-warehouse resolver picks the alphabetically-first warehouse, and a
        // cart must never hijack that. The human-facing name lives on StockLocation.
        const wh = await tx.warehouse.create({
          data: { tenantId, name: `zzz-loc-${data.code}`, location: data.location ?? data.name },
        });
        warehouseId = wh.id;
      }
      const loc = await tx.stockLocation.create({
        data: {
          tenantId,
          warehouseId: warehouseId!,
          code: data.code,
          name: data.name,
          type: data.type,
          branchId: data.branchId,
          operatorId: data.operatorId,
          status: "CREATED",
        },
        include: { warehouse: { select: { id: true, name: true } } },
      });
      // Seed the lifecycle audit with the initial CREATED event.
      await tx.stockLocationStatusEvent.create({
        data: { tenantId, stockLocationId: loc.id, fromStatus: null, toStatus: "CREATED", userId, remarks: "Location created" },
      });
      return loc;
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES = [
  "CREATED",
  "LOADING",
  "READY",
  "ON_ROUTE",
  "PARKED",
  "SETTLEMENT_PENDING",
  "CLOSED",
] as const;

/**
 * Allowed lifecycle transitions. The happy path is a forward walk; a couple of
 * back-edges support real operations (re-load a READY cart, re-route a PARKED one).
 */
const ALLOWED: Record<string, string[]> = {
  CREATED: ["LOADING"],
  LOADING: ["READY"],
  READY: ["ON_ROUTE", "LOADING"],
  ON_ROUTE: ["PARKED"],
  PARKED: ["ON_ROUTE", "SETTLEMENT_PENDING"],
  SETTLEMENT_PENDING: ["CLOSED"],
  CLOSED: [],
};

const patchSchema = z.object({
  operatorId: z.string().nullable().optional(),
  status: z.enum(STATUSES).optional(),
  remarks: z.string().max(500).optional(),
  // Optional live position update.
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// GET /api/stock-locations/:id
export async function GET(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const location = await prisma.stockLocation.findFirst({
    where: { id, tenantId },
    include: {
      warehouse: { select: { id: true, name: true } },
      statusEvents: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });
  return NextResponse.json({ data: location });
}

// PATCH /api/stock-locations/:id — update operator, position, and/or lifecycle status.
export async function PATCH(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id") ?? "SYSTEM";
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const data = patchSchema.parse(await request.json());
    const existing = await prisma.stockLocation.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Location not found" }, { status: 404 });

    // Guard the lifecycle transition before writing anything.
    if (data.status && data.status !== existing.status) {
      const allowed = ALLOWED[existing.status] ?? [];
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          { error: `Illegal transition ${existing.status} -> ${data.status}` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const loc = await tx.stockLocation.update({
        where: { id },
        data: {
          ...(data.operatorId !== undefined ? { operatorId: data.operatorId } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.latitude !== undefined && data.longitude !== undefined
            ? { lastLatitude: data.latitude, lastLongitude: data.longitude, lastSeenAt: new Date() }
            : {}),
        },
        include: { warehouse: { select: { id: true, name: true } } },
      });

      // Audit the transition (only when status actually changed).
      if (data.status && data.status !== existing.status) {
        await tx.stockLocationStatusEvent.create({
          data: {
            tenantId,
            stockLocationId: id,
            fromStatus: existing.status,
            toStatus: data.status,
            userId,
            remarks: data.remarks,
          },
        });
      }
      return loc;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";

// Accept both the native shape ({orderId, orderNumber, executiveId}) and the
// sales dispatch shape ({salesOrderId, driverId, vehicleInfo}). orderNumber is
// optional (derived when omitted) so the sales workflow can auto-assign.
const schema = z
  .object({
    orderId: z.string().min(1).optional(),
    salesOrderId: z.string().min(1).optional(),
    orderNumber: z.string().min(1).optional(),
    executiveId: z.string().min(1).optional(),
    driverId: z.string().min(1).optional(),
    vehicleInfo: z.string().optional(),
    notes: z.string().optional(),
  })
  .transform((v) => ({
    orderId: v.orderId ?? v.salesOrderId ?? "",
    orderNumber: v.orderNumber,
    executiveId: v.executiveId ?? v.driverId ?? "",
    vehicleInfo: v.vehicleInfo,
    notes: v.notes,
  }))
  .refine((v) => v.orderId.length > 0, { message: "orderId (or salesOrderId) is required" })
  .refine((v) => v.executiveId.length > 0, { message: "executiveId (or driverId) is required" });

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  const executiveId = url.searchParams.get("executiveId") ?? undefined;
  const orderId = url.searchParams.get("orderId") ?? undefined;

  const where = {
    tenantId,
    ...(status && { status }),
    ...(executiveId && { executiveId }),
    ...(orderId && { orderId }),
  };

  const [data, total] = await Promise.all([
    prisma.deliveryAssignment.findMany({
      where,
      orderBy: { assignedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.deliveryAssignment.count({ where }),
  ]);

  return NextResponse.json({ data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const userId = request.headers.get("x-user-id")!;
  const role = request.headers.get("x-user-role");
  const serviceKey = request.headers.get("x-service-key");

  if (!serviceKey && !["ADMIN", "MANAGER", "ORG_ADMIN", "BRANCH_ADMIN", "DISPATCH_EXECUTIVE"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const input = parsed.data;

  // Verify the executive against HR. This is STRICT for a human dispatcher
  // (they pick from a roster), but BEST-EFFORT for service-key calls (the sales
  // workflow auto-assigns an own-fleet driver that may not be an HR employee) —
  // we don't want fulfilment to fail because HR isn't set up.
  const viaService = Boolean(serviceKey);
  const hrRes = await serviceClient.call<{ data?: { isDeliveryExecutive?: boolean; availabilityStatus?: string } }>(
    "hr",
    `/api/employees/${input.executiveId}`,
    { tenantId, userId }
  );
  const emp = hrRes.data?.data;
  const hrKnown = hrRes.status === 200 && !!emp;

  if (!viaService) {
    if (hrRes.status === 404 || !emp) {
      return NextResponse.json({ error: "Executive not found" }, { status: 404 });
    }
    if (!emp.isDeliveryExecutive) {
      return NextResponse.json({ error: "Employee is not a delivery executive" }, { status: 400 });
    }
    if (emp.availabilityStatus !== "AVAILABLE") {
      return NextResponse.json({ error: "Executive is not available" }, { status: 409 });
    }
  } else if (hrKnown && emp && emp.isDeliveryExecutive && emp.availabilityStatus && emp.availabilityStatus !== "AVAILABLE") {
    // Even service calls shouldn't assign a known-but-busy executive.
    return NextResponse.json({ error: "Executive is not available" }, { status: 409 });
  }

  // Derive a display order number when the caller didn't supply one.
  let orderNumber = input.orderNumber;
  if (!orderNumber) {
    const soRes = await serviceClient.call<{ data?: { orderNumber?: string } }>(
      "sales",
      `/api/orders/${input.orderId}`,
      { tenantId, userId }
    );
    orderNumber = soRes.data?.data?.orderNumber ?? input.orderId;
  }

  const noteParts = [input.notes, input.vehicleInfo ? `Vehicle: ${input.vehicleInfo}` : null].filter(Boolean);

  const existing = await prisma.deliveryAssignment.findFirst({
    where: { tenantId, orderId: input.orderId, status: { in: ["ASSIGNED", "ACCEPTED", "PICKED_UP"] } },
  });
  if (existing) {
    return NextResponse.json({ data: existing, meta: { reused: true } }, { status: 200 });
  }

  const assignment = await prisma.deliveryAssignment.create({
    data: {
      tenantId,
      orderId: input.orderId,
      orderNumber,
      executiveId: input.executiveId,
      notes: noteParts.length ? noteParts.join(" · ") : undefined,
    },
  });

  return NextResponse.json({ data: assignment }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";

const schema = z.object({
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  executiveId: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  const executiveId = url.searchParams.get("executiveId") ?? undefined;

  const where = {
    tenantId,
    ...(status && { status }),
    ...(executiveId && { executiveId }),
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

  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Verify the executive exists and is available in HR service
  const hrRes = await serviceClient.call<{ isDeliveryExecutive: boolean; availabilityStatus: string }>(
    "hr",
    `/api/employees/${parsed.data.executiveId}`,
    { tenantId, userId }
  );

  if (hrRes.status === 404 || !hrRes.data) {
    return NextResponse.json({ error: "Executive not found" }, { status: 404 });
  }
  if (!(hrRes.data as unknown as { data: { isDeliveryExecutive: boolean; availabilityStatus: string } }).data?.isDeliveryExecutive) {
    return NextResponse.json({ error: "Employee is not a delivery executive" }, { status: 400 });
  }
  if ((hrRes.data as unknown as { data: { availabilityStatus: string } }).data?.availabilityStatus !== "AVAILABLE") {
    return NextResponse.json({ error: "Executive is not available" }, { status: 409 });
  }

  const assignment = await prisma.deliveryAssignment.create({
    data: {
      tenantId,
      orderId: parsed.data.orderId,
      orderNumber: parsed.data.orderNumber,
      executiveId: parsed.data.executiveId,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({ data: assignment }, { status: 201 });
}

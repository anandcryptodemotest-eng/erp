import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

const updateSchema = z.object({
  status: z.enum(["ACCEPTED", "PICKED_UP", "DELIVERED", "FAILED", "CANCELLED"]),
  failureReason: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const { id } = await params;

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { id, tenantId },
    include: { tracking: { orderBy: { capturedAt: "desc" }, take: 10 } },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  return NextResponse.json({ data: assignment });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const { id } = await params;

  const existing = await prisma.deliveryAssignment.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${existing.status} to ${parsed.data.status}` },
      { status: 400 }
    );
  }

  const now = new Date();
  const timestamps: Record<string, Date> = {};
  if (parsed.data.status === "ACCEPTED") timestamps.acceptedAt = now;
  if (parsed.data.status === "PICKED_UP") timestamps.pickedUpAt = now;
  if (parsed.data.status === "DELIVERED") timestamps.deliveredAt = now;
  if (parsed.data.status === "FAILED") timestamps.failedAt = now;

  const assignment = await prisma.deliveryAssignment.update({
    where: { id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.failureReason && { failureReason: parsed.data.failureReason }),
      ...(parsed.data.notes && { notes: parsed.data.notes }),
      ...timestamps,
    },
  });

  // When delivered, notify sales service to advance the order status
  if (parsed.data.status === "DELIVERED" && assignment.orderId) {
    const tenantId = request.headers.get("x-tenant-id")!;
    const userId = request.headers.get("x-user-id") ?? "";
    await serviceClient.call("sales", `/api/orders/${assignment.orderId}?action=delivered`, {
      method: "PATCH",
      body: {},
      tenantId,
      userId,
    });
  }

  return NextResponse.json({ data: assignment });
}

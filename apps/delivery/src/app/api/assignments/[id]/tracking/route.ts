import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const pingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});

// GET /api/assignments/:id/tracking — recent location pings (latest first).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const assignment = await prisma.deliveryAssignment.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const rows = await prisma.deliveryTracking.findMany({
    where: { tenantId, assignmentId: id },
    orderBy: { capturedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ data: rows, meta: { latest: rows[0] ?? null, count: rows.length } });
}

// POST /api/assignments/:id/tracking — driver app appends a live GPS ping.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const assignment = await prisma.deliveryAssignment.findFirst({ where: { id, tenantId } });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  if (!["ASSIGNED", "ACCEPTED", "PICKED_UP"].includes(assignment.status)) {
    return NextResponse.json(
      { error: `Cannot track an assignment in ${assignment.status} status` },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = pingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const ping = await prisma.deliveryTracking.create({
    data: {
      tenantId,
      assignmentId: id,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy,
    },
  });
  return NextResponse.json({ data: ping }, { status: 201 });
}

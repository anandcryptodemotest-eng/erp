import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id")!;
  const { id } = await params;

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { id, tenantId },
    select: { status: true },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  if (!["ACCEPTED", "PICKED_UP"].includes(assignment.status)) {
    return NextResponse.json({ error: "Tracking only allowed during active delivery" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const point = await prisma.deliveryTracking.create({
    data: { tenantId, assignmentId: id, ...parsed.data },
  });

  return NextResponse.json({ data: point }, { status: 201 });
}

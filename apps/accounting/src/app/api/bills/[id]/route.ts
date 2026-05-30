import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED"]),
  notes: z.string().optional(),
});

// GET /api/bills/:id
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const bill = await prisma.bill.findFirst({
    where: { id, tenantId },
    include: { items: true, returns: { include: { items: true } } },
  });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  return NextResponse.json({ data: bill });
}

// PATCH /api/bills/:id — transition HELD → COMPLETED or HELD/COMPLETED → CANCELLED
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  const { id } = await params;

  const bill = await prisma.bill.findFirst({ where: { id, tenantId } });
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status === "CANCELLED") {
    return NextResponse.json({ error: "Bill is already cancelled" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // CANCELLED requires ADMIN/MANAGER
  if (parsed.data.status === "CANCELLED" && !["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions to cancel a bill" }, { status: 403 });
  }
  // HELD bill can only complete if it was held
  if (parsed.data.status === "COMPLETED" && bill.status !== "HELD") {
    return NextResponse.json({ error: "Only HELD bills can be completed" }, { status: 409 });
  }

  const updated = await prisma.bill.update({
    where: { id },
    data: {
      status: parsed.data.status,
      paymentStatus: parsed.data.status === "CANCELLED" ? "CANCELLED" : "PAID",
      notes: parsed.data.notes ?? bill.notes,
    },
    include: { items: true },
  });
  return NextResponse.json({ data: updated });
}

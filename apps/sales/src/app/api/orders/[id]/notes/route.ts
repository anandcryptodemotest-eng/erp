import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  body: z.string().trim().min(1).max(8000),
  sourceStep: z.string().trim().max(120).optional().nullable(),
});

/**
 * GET/POST /api/orders/:id/notes — human OrderNote (Sales). Not chat, not OrderModification.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const notes = await prisma.orderNote.findMany({
    where: { tenantId, salesOrderId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: notes });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }
  const { id } = await params;

  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const note = await prisma.orderNote.create({
    data: {
      tenantId,
      salesOrderId: id,
      body: parsed.data.body,
      authorUserId: userId,
      authorRole: role ?? null,
      sourceStep: parsed.data.sourceStep ?? null,
    },
  });
  return NextResponse.json({ data: note }, { status: 201 });
}

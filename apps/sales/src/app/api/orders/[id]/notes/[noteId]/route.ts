import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

/**
 * PATCH/DELETE /api/orders/:id/notes/:noteId — edit or remove an OrderNote.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id, noteId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.orderNote.findFirst({
    where: { id: noteId, tenantId, salesOrderId: id },
  });
  if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  const note = await prisma.orderNote.update({
    where: { id: noteId },
    data: { body: parsed.data.body },
  });
  return NextResponse.json({ data: note });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const tenantId = _request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id, noteId } = await params;

  const existing = await prisma.orderNote.findFirst({
    where: { id: noteId, tenantId, salesOrderId: id },
  });
  if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  await prisma.orderNote.delete({ where: { id: noteId } });
  return NextResponse.json({ data: { id: noteId, deleted: true } });
}

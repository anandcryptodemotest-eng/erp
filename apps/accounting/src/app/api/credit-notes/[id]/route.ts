import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// PATCH /api/credit-notes/:id?action=apply|refund|cancel
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const note = await prisma.creditNote.findFirst({
    where: { id, tenantId },
    include: { invoice: { select: { id: true, number: true, status: true, total: true } } },
  });

  if (!note) return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
  return NextResponse.json({ data: note });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const note = await prisma.creditNote.findFirst({ where: { id, tenantId } });
  if (!note) return NextResponse.json({ error: "Credit note not found" }, { status: 404 });

  if (note.status !== "ISSUED") {
    return NextResponse.json({ error: `Cannot perform action on credit note in ${note.status} status` }, { status: 409 });
  }

  if (action === "apply") {
    const updated = await prisma.creditNote.update({ where: { id }, data: { status: "APPLIED" } });
    return NextResponse.json({ data: updated });
  }

  if (action === "refund") {
    const updated = await prisma.creditNote.update({ where: { id }, data: { status: "REFUNDED" } });
    return NextResponse.json({ data: updated });
  }

  if (action === "cancel") {
    const updated = await prisma.creditNote.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: "Invalid action. Use ?action=apply|refund|cancel" }, { status: 400 });
}

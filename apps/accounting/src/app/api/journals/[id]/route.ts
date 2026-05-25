import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateJournalSchema = z.object({
  description: z.string().optional(),
  reference: z.string().optional(),
});

// GET /api/journals/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const entry = await prisma.journalEntry.findFirst({
    where: { id, tenantId },
    include: { lines: { include: { account: true } } },
  });

  if (!entry) return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
  return NextResponse.json({ data: entry });
}

// PATCH /api/journals/:id?action=post
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const entry = await prisma.journalEntry.findFirst({ where: { id, tenantId } });
  if (!entry) return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });

  try {
    if (action === "post") {
      if (role !== "ADMIN" && role !== "MANAGER") {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      if (entry.isPosted) {
        return NextResponse.json({ error: "Journal entry is already posted" }, { status: 409 });
      }
      const updated = await prisma.journalEntry.update({ where: { id }, data: { isPosted: true } });
      return NextResponse.json({ data: updated });
    }

    // Plain update (only for unposted entries)
    if (entry.isPosted) {
      return NextResponse.json({ error: "Cannot edit a posted journal entry" }, { status: 409 });
    }
    const body = await request.json();
    const data = updateJournalSchema.parse(body);
    const updated = await prisma.journalEntry.update({ where: { id }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

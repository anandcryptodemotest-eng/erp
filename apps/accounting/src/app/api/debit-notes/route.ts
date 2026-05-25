import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createDebitNoteSchema = z.object({
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  sourceRef: z.string().optional(),
  date: z.string(),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

// GET /api/debit-notes
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;

  const where = { tenantId, ...(status && { status }), ...(entityId && { entityId }) };
  const [notes, total] = await Promise.all([
    prisma.debitNote.findMany({ where, orderBy: { date: "desc" }, skip, take: limit }),
    prisma.debitNote.count({ where }),
  ]);

  return NextResponse.json({ data: notes, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/debit-notes
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createDebitNoteSchema.parse(body);

    const count = await prisma.debitNote.count({ where: { tenantId } });
    const number = `DN-${String(count + 1).padStart(5, "0")}`;

    const note = await prisma.debitNote.create({
      data: { ...data, tenantId, number, date: new Date(data.date) },
    });

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createCreditNoteSchema = z.object({
  invoiceId: z.string().optional(),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  sourceRef: z.string().optional(),
  date: z.string(),
  amount: z.number().positive(),
  notes: z.string().optional(),
});

// GET /api/credit-notes
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
    prisma.creditNote.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.creditNote.count({ where }),
  ]);

  return NextResponse.json({ data: notes, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/credit-notes
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createCreditNoteSchema.parse(body);

    if (data.invoiceId) {
      const invoice = await prisma.invoice.findFirst({ where: { id: data.invoiceId, tenantId } });
      if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const count = await prisma.creditNote.count({ where: { tenantId } });
    const number = `CN-${String(count + 1).padStart(5, "0")}`;

    const note = await prisma.creditNote.create({
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

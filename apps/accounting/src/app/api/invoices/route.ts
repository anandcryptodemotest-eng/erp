import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const invoiceSchema = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  sourceRef: z.string().optional(),
  date: z.string(),
  dueDate: z.string(),
  subtotal: z.number().positive(),
  tax: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const where = { tenantId, ...(type && { type }), ...(status && { status }) };
  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { payments: true },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({ data: invoices, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = invoiceSchema.parse(body);

    const count = await prisma.invoice.count({ where: { tenantId } });
    const number = `INV-${String(count + 1).padStart(6, "0")}`;
    const total = data.subtotal + data.tax;

    const invoice = await prisma.invoice.create({
      data: { ...data, tenantId, number, total, date: new Date(data.date), dueDate: new Date(data.dueDate) },
    });

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

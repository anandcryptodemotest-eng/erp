import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const invoiceSchema = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  date: z.string(),
  dueDate: z.string(),
  subtotal: z.number().positive(),
  tax: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const invoices = await prisma.invoice.findMany({
    where: { tenantId },
    include: { payments: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: invoices });
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

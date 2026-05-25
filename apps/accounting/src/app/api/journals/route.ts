import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const journalSchema = z.object({
  date: z.string(),
  reference: z.string().optional(),
  description: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.string(),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    description: z.string().optional(),
  })).min(2),
});

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const entries = await prisma.journalEntry.findMany({
    where: { tenantId },
    include: { lines: { include: { account: true } } },
    orderBy: { date: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: entries });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = journalSchema.parse(body);

    const totalDebit = data.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = data.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: "Debits must equal credits" }, { status: 400 });
    }

    const entry = await prisma.journalEntry.create({
      data: {
        tenantId,
        date: new Date(data.date),
        reference: data.reference,
        description: data.description,
        lines: { create: data.lines },
      },
      include: { lines: true },
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

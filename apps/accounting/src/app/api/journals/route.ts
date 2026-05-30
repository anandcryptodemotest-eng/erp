import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const journalSchema = z.object({
  date: z.string(),
  reference: z.string().optional(),
  description: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.string().optional(),
    accountCode: z.string().optional(),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    description: z.string().optional(),
  })).min(2),
});

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = { tenantId };
  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.journalEntry.count({ where }),
  ]);

  return NextResponse.json({ data: entries, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = journalSchema.parse(body);

    // Resolve accountCode -> accountId where needed
    const resolvedLines = await Promise.all(
      data.lines.map(async (line) => {
        let accountId = line.accountId;
        if (!accountId && line.accountCode) {
          const acct = await prisma.account.findFirst({ where: { tenantId, code: line.accountCode } });
          if (!acct) throw new Error(`Account code not found: ${line.accountCode}`);
          accountId = acct.id;
        }
        if (!accountId) throw new Error("Each line must have accountId or accountCode");
        return { accountId, debit: line.debit, credit: line.credit, description: line.description };
      })
    );

    const totalDebit = resolvedLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = resolvedLines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json({ error: "Debits must equal credits" }, { status: 400 });
    }

    const entry = await prisma.journalEntry.create({
      data: {
        tenantId,
        date: new Date(data.date),
        reference: data.reference,
        description: data.description,
        lines: { create: resolvedLines },
      },
      include: { lines: true },
    });

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Account code not found")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createOpportunitySchema = z.object({
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  title: z.string().min(1),
  value: z.number().min(0).default(0),
  currency: z.string().length(3).default("USD"),
  stage: z.enum(["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED"]).default("PROSPECTING"),
  probability: z.number().int().min(0).max(100).default(50),
  expectedClose: z.string().datetime().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/opportunities
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  const stage = url.searchParams.get("stage") ?? undefined;

  const where = {
    tenantId,
    isActive: true,
    ...(status && { status }),
    ...(stage && { stage }),
  };

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return NextResponse.json({ data: opportunities, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/opportunities
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = createOpportunitySchema.parse(body);

    const opportunity = await prisma.opportunity.create({
      data: {
        ...data,
        tenantId,
        expectedClose: data.expectedClose ? new Date(data.expectedClose) : null,
      },
    });
    return NextResponse.json({ data: opportunity }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

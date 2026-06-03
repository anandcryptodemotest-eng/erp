import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const STAGES = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED"] as const;
const OPPORTUNITY_STATUSES = ["OPEN", "WON", "LOST"] as const;

const ALLOWED_STAGE_TRANSITIONS: Record<(typeof STAGES)[number], Array<(typeof STAGES)[number]>> = {
  PROSPECTING: ["QUALIFICATION"],
  QUALIFICATION: ["PROPOSAL"],
  PROPOSAL: ["NEGOTIATION"],
  NEGOTIATION: ["CLOSED"],
  CLOSED: [],
};

const ALLOWED_STATUS_TRANSITIONS: Record<(typeof OPPORTUNITY_STATUSES)[number], Array<(typeof OPPORTUNITY_STATUSES)[number]>> = {
  OPEN: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

const updateOpportunitySchema = z.object({
  title: z.string().min(1).optional(),
  value: z.number().min(0).optional(),
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
  stage: z.enum(STAGES).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedClose: z.string().datetime().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/opportunities/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const opportunity = await prisma.opportunity.findFirst({
    where: { id, tenantId },
    include: {
      lead: { select: { id: true, name: true, company: true } },
      quotes: { where: { isActive: true }, select: { id: true, quoteNumber: true, status: true, total: true } },
    },
  });

  if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  return NextResponse.json({ data: opportunity });
}

// PATCH /api/opportunities/:id
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  try {
    const body = await request.json();
    const data = updateOpportunitySchema.parse(body);

    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    if (existing.status === "WON" || existing.status === "LOST") {
      return NextResponse.json({ error: "Opportunity is already closed" }, { status: 409 });
    }

    if (data.stage && data.stage !== existing.stage) {
      const currentStage = existing.stage as (typeof STAGES)[number];
      const allowedNextStages = ALLOWED_STAGE_TRANSITIONS[currentStage] ?? [];
      if (!allowedNextStages.includes(data.stage)) {
        return NextResponse.json(
          { error: `Invalid stage transition from ${existing.stage} to ${data.stage}` },
          { status: 409 }
        );
      }
    }

    if (data.status && data.status !== existing.status) {
      const currentStatus = existing.status as (typeof OPPORTUNITY_STATUSES)[number];
      const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];
      if (!allowedNextStatuses.includes(data.status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${existing.status} to ${data.status}` },
          { status: 409 }
        );
      }
    }

    const nextStatus = data.status ?? existing.status;

    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: {
        ...data,
        stage: nextStatus === "OPEN" ? data.stage : "CLOSED",
        probability:
          nextStatus === "WON"
            ? 100
            : nextStatus === "LOST"
              ? 0
              : data.probability,
        expectedClose: data.expectedClose ? new Date(data.expectedClose) : undefined,
      },
    });
    return NextResponse.json({ data: opportunity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/opportunities/:id — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const existing = await prisma.opportunity.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  await prisma.opportunity.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

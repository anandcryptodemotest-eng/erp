import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CONVERTED"] as const;

const ALLOWED_TRANSITIONS: Record<(typeof LEAD_STATUSES)[number], Array<(typeof LEAD_STATUSES)[number]>> = {
  NEW: ["CONTACTED", "DISQUALIFIED"],
  CONTACTED: ["QUALIFIED", "DISQUALIFIED"],
  QUALIFIED: ["CONVERTED", "DISQUALIFIED"],
  DISQUALIFIED: [],
  CONVERTED: [],
};

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
  isActive: z.boolean().optional(),
});

const convertLeadSchema = z.object({
  title: z.string().min(1),
  value: z.number().min(0).default(0),
  createOrLinkCustomer: z.boolean().default(true),
  customer: z
    .object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

// GET /api/leads/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, tenantId },
    include: { opportunities: { where: { isActive: true } } },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ data: lead });
}

// PATCH /api/leads/:id
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  try {
    const body = await request.json();

    const existing = await prisma.lead.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    if (action === "convert") {
      if (existing.status !== "QUALIFIED") {
        return NextResponse.json({ error: "Only QUALIFIED leads can be converted" }, { status: 409 });
      }

      const parsed = convertLeadSchema.parse(body);
      let customerId: string | undefined;

      if (parsed.createOrLinkCustomer) {
        const customerName = parsed.customer?.name ?? existing.company ?? existing.name;
        const customerEmail = parsed.customer?.email ?? existing.email ?? undefined;
        const customerPhone = parsed.customer?.phone ?? existing.phone ?? undefined;

        let existingCustomer = null;
        if (customerEmail || customerPhone) {
          existingCustomer = await prisma.customer.findFirst({
            where: {
              tenantId,
              isActive: true,
              OR: [
                ...(customerEmail ? [{ email: customerEmail }] : []),
                ...(customerPhone ? [{ phone: customerPhone }] : []),
              ],
            },
          });
        }

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const customer = await prisma.customer.create({
            data: {
              tenantId,
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
            },
          });
          customerId = customer.id;
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const opportunity = await tx.opportunity.create({
          data: {
            tenantId,
            leadId: existing.id,
            customerId,
            title: parsed.title,
            value: parsed.value,
            stage: "PROSPECTING",
          },
        });

        const lead = await tx.lead.update({
          where: { id },
          data: { status: "CONVERTED" },
        });

        return { lead, opportunity };
      });

      return NextResponse.json({ data: result }, { status: 200 });
    }

    const data = updateLeadSchema.parse(body);

    if (data.status && data.status !== existing.status) {
      const current = existing.status as (typeof LEAD_STATUSES)[number];
      const allowed = ALLOWED_TRANSITIONS[current] ?? [];
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${existing.status} to ${data.status}` },
          { status: 409 }
        );
      }
    }

    const lead = await prisma.lead.update({ where: { id }, data });
    return NextResponse.json({ data: lead });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/leads/:id — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const existing = await prisma.lead.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  await prisma.lead.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

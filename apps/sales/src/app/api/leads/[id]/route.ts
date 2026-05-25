import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED"]).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
  isActive: z.boolean().optional(),
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
  try {
    const body = await request.json();
    const data = updateLeadSchema.parse(body);

    const existing = await prisma.lead.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

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

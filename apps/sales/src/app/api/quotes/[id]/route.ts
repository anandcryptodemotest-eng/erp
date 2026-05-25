import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateQuoteSchema = z.object({
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

const statusSchema = z.object({
  status: z.enum(["SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
});

// GET /api/quotes/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      opportunity: { select: { id: true, title: true } },
      items: true,
      orders: { select: { id: true, orderNumber: true, status: true } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  return NextResponse.json({ data: quote });
}

// PATCH /api/quotes/:id — update or change status
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const existing = await prisma.quote.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  try {
    const body = await request.json();

    if (action === "status") {
      const { status } = statusSchema.parse(body);
      const allowed: Record<string, string[]> = {
        DRAFT: ["SENT"],
        SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
      };
      if (!allowed[existing.status]?.includes(status)) {
        return NextResponse.json({ error: `Cannot transition from ${existing.status} to ${status}` }, { status: 409 });
      }
      const quote = await prisma.quote.update({ where: { id }, data: { status } });
      return NextResponse.json({ data: quote });
    }

    const data = updateQuoteSchema.parse(body);
    if (existing.status !== "DRAFT") {
      return NextResponse.json({ error: "Only DRAFT quotes can be edited" }, { status: 409 });
    }
    const quote = await prisma.quote.update({
      where: { id },
      data: { ...data, validUntil: data.validUntil ? new Date(data.validUntil) : undefined },
    });
    return NextResponse.json({ data: quote });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/quotes/:id — soft delete (DRAFT only)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const existing = await prisma.quote.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT quotes can be deleted" }, { status: 409 });
  }

  await prisma.quote.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

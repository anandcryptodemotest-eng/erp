import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().nullable().optional(),
  type: z.enum(["HOME", "PROMOTIONAL", "CATEGORY", "PRODUCT"]).optional(),
  position: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const banner = await prisma.banner.findFirst({ where: { id, tenantId } });
  if (!banner) return NextResponse.json({ error: "Banner not found" }, { status: 404 });
  return NextResponse.json({ data: banner });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (!["ADMIN", "MANAGER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const { id } = await params;

  const existing = await prisma.banner.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Banner not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { startsAt, endsAt, ...rest } = parsed.data;
  const banner = await prisma.banner.update({
    where: { id },
    data: {
      ...rest,
      ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
      ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
    },
  });
  return NextResponse.json({ data: banner });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { id } = await params;

  const existing = await prisma.banner.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Banner not found" }, { status: 404 });

  await prisma.banner.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ data: { id } });
}

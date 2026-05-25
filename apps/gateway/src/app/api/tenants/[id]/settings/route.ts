import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { z } from "zod";

const upsertSettingsSchema = z.record(z.string(), z.string());

type Params = { params: Promise<{ id: string }> };

// GET /api/tenants/:id/settings — get all settings as key-value map
export async function GET(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id } = await params;

  const member = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: auth.userId } },
  });

  if (!member || !member.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const settings = await prisma.tenantSetting.findMany({ where: { tenantId: id } });

  return NextResponse.json({
    data: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  });
}

// PUT /api/tenants/:id/settings — upsert settings (ADMIN only)
// Body: { "currency": "USD", "timezone": "UTC", "fiscalYearStart": "01" }
export async function PUT(request: Request, { params }: Params) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id } = await params;

  const caller = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId: id, userId: auth.userId } },
  });

  if (!caller || !caller.isActive) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const settings = upsertSettingsSchema.parse(body);

    await prisma.$transaction(
      Object.entries(settings).map(([key, value]) =>
        prisma.tenantSetting.upsert({
          where: { tenantId_key: { tenantId: id, key } },
          create: { tenantId: id, key, value },
          update: { value },
        })
      )
    );

    const all = await prisma.tenantSetting.findMany({ where: { tenantId: id } });

    return NextResponse.json({
      data: Object.fromEntries(all.map((s) => [s.key, s.value])),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

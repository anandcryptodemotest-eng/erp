import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { writePlatformAudit } from "@/lib/platform-audit";

type Ctx = { params: Promise<{ tenantId: string }> };

const putSchema = z.object({
  settings: z.record(z.string()),
});

export async function GET(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "readAll");
  if (gate instanceof NextResponse) return gate;
  const { tenantId } = await params;
  const rows = await prisma.tenantSetting.findMany({ where: { tenantId } });
  return NextResponse.json({
    data: Object.fromEntries(rows.map((r) => [r.key, r.value])),
  });
}

export async function PUT(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "writeSettings");
  if (gate instanceof NextResponse) return gate;
  const { tenantId } = await params;

  try {
    const { settings } = putSchema.parse(await request.json());
    const before = await prisma.tenantSetting.findMany({ where: { tenantId } });

    await prisma.$transaction(
      Object.entries(settings).map(([key, value]) =>
        prisma.tenantSetting.upsert({
          where: { tenantId_key: { tenantId, key } },
          create: { tenantId, key, value },
          update: { value },
        })
      )
    );

    const after = await prisma.tenantSetting.findMany({ where: { tenantId } });
    const meta = clientMeta(request);
    await writePlatformAudit({
      operatorId: gate.claims.sub,
      action: "SETTINGS_UPDATED",
      entityType: "Tenant",
      entityId: tenantId,
      metadata: {
        before: Object.fromEntries(before.map((r) => [r.key, r.value])),
        after: Object.fromEntries(after.map((r) => [r.key, r.value])),
      },
      ...meta,
    });

    return NextResponse.json({
      data: Object.fromEntries(after.map((r) => [r.key, r.value])),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

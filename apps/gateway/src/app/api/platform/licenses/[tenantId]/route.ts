import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAuth, clientMeta } from "@/lib/platform-auth";
import { writePlatformAudit } from "@/lib/platform-audit";

type Ctx = { params: Promise<{ tenantId: string }> };

const putSchema = z.object({
  modules: z
    .array(
      z.object({
        moduleId: z.string().min(1),
        plan: z.string().default("basic"),
        isActive: z.boolean().default(true),
        maxUsers: z.number().int().positive().optional(),
      })
    )
    .min(1),
});

// PUT /api/platform/licenses/:tenantId
export async function PUT(request: Request, { params }: Ctx) {
  const gate = await requirePlatformAuth(request, "manageLicenses");
  if (gate instanceof NextResponse) return gate;
  const { tenantId } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    const { modules } = putSchema.parse(await request.json());
    const before = await prisma.moduleLicense.findMany({ where: { tenantId } });

    const updated = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const m of modules) {
        const row = await tx.moduleLicense.upsert({
          where: { tenantId_moduleId: { tenantId, moduleId: m.moduleId } },
          create: {
            tenantId,
            moduleId: m.moduleId,
            plan: m.plan,
            isActive: m.isActive,
            maxUsers: m.maxUsers ?? 5,
          },
          update: {
            plan: m.plan,
            isActive: m.isActive,
            ...(m.maxUsers != null ? { maxUsers: m.maxUsers } : {}),
          },
        });
        results.push(row);
      }
      return results;
    });

    const meta = clientMeta(request);
    await writePlatformAudit({
      operatorId: gate.claims.sub,
      action: "LICENSE_UPDATED",
      entityType: "Tenant",
      entityId: tenantId,
      metadata: { before, after: updated },
      ...meta,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

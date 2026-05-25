import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, extractToken } from "@erp/auth";
import { z } from "zod";

const purchaseSchema = z.object({
  tenantId: z.string(),
  moduleId: z.string(),
  plan: z.enum(["basic", "pro", "enterprise"]).default("basic"),
  maxUsers: z.number().int().positive().default(5),
});

// GET /api/modules — list available modules with pricing
export async function GET() {
  const { services } = await import("@erp/config");

  const modules = Object.values(services).map((svc) => ({
    id: svc.id,
    name: svc.name,
    description: svc.description,
    subdomain: svc.subdomain,
    dependencies: svc.dependencies,
  }));

  return NextResponse.json({ modules });
}

// POST /api/modules — purchase/activate module for tenant
export async function POST(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth || auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { tenantId, moduleId, plan, maxUsers } = purchaseSchema.parse(body);

    // Verify user is admin of this tenant
    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: auth.userId } },
    });

    if (!tenantUser || tenantUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Not tenant admin" }, { status: 403 });
    }

    // Check dependencies
    const { services } = await import("@erp/config");
    const module = services[moduleId as keyof typeof services];
    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const existingLicenses = await prisma.moduleLicense.findMany({
      where: { tenantId, isActive: true },
    });
    const licensedIds = existingLicenses.map((l) => l.moduleId);

    const missingDeps = module.dependencies.filter((dep) => !licensedIds.includes(dep));
    if (missingDeps.length > 0) {
      return NextResponse.json(
        { error: `Missing required modules: ${missingDeps.join(", ")}` },
        { status: 400 }
      );
    }

    // Create or update license
    const license = await prisma.moduleLicense.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId } },
      update: { plan, maxUsers, isActive: true },
      create: { tenantId, moduleId, plan, maxUsers },
    });

    return NextResponse.json({ license }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

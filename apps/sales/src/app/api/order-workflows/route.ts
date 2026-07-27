import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  applyWorkflowTemplate,
  getDefaultWorkflow,
  listPlatformTemplates,
} from "@/lib/order-workflow";
import { z } from "zod";

// GET /api/order-workflows — list tenant workflows (+ ?active=1 for default resolved)
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  if (url.searchParams.get("active") === "1") {
    const active = await getDefaultWorkflow(tenantId);
    return NextResponse.json({ data: active });
  }

  const workflows = await prisma.orderWorkflow.findMany({
    where: { tenantId, isActive: true },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ data: workflows });
}

const createSchema = z.object({
  templateId: z.string().min(1),
  setDefault: z.boolean().default(true),
});

// POST /api/order-workflows — apply a platform template to this tenant
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role && !["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { templateId, setDefault } = createSchema.parse(body);
    const workflow = await applyWorkflowTemplate(tenantId, templateId, { setDefault });
    return NextResponse.json({ data: workflow }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 400 }
    );
  }
}

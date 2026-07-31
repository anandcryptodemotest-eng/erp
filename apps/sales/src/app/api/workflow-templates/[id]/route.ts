import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateDefinition } from "@/lib/workflow-platform";
import type { WorkflowDefinition } from "@erp/workflow";
import type { Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const row = await prisma.workflowTemplateVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: row });
}

/** PATCH — save Draft definition JSON (designer save) */
export async function PATCH(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { requireProcessDesignerFromRequest } = await import("@erp/auth");
  const denied = requireProcessDesignerFromRequest(request);
  if (denied) return denied;
  const { id } = await params;

  const row = await prisma.workflowTemplateVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.lifecycle !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT templates can be edited — clone to create a new draft" }, { status: 409 });
  }

  const body = (await request.json()) as {
    name?: string;
    definition?: WorkflowDefinition;
  };

  const definition = body.definition
    ? ({
        ...body.definition,
        template: row.templateCode,
        version: row.version,
      } as WorkflowDefinition)
    : undefined;

  const updated = await prisma.workflowTemplateVersion.update({
    where: { id },
    data: {
      ...(body.name != null ? { name: body.name } : {}),
      ...(definition
        ? { definition: definition as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });

  const validation = definition
    ? validateDefinition(definition)
    : validateDefinition(updated.definition as unknown as WorkflowDefinition);

  return NextResponse.json({ data: updated, validation });
}

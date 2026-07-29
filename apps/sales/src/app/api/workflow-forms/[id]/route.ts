import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFormReferencedBy, validateFormDefinition } from "@/lib/form-catalog";
import { withFormId, type FormDefinition } from "@erp/workflow";
import type { Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/workflow-forms/:id */
export async function GET(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const row = await prisma.workflowFormVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const referencedBy = await getFormReferencedBy(tenantId, row.formId);
  return NextResponse.json({ data: row, meta: { referencedBy } });
}

/** PATCH /api/workflow-forms/:id — draft only */
export async function PATCH(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { id } = await params;

  const row = await prisma.workflowFormVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.lifecycle !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT forms can be edited — clone to draft" }, { status: 409 });
  }

  const body = (await request.json()) as { name?: string; definition?: FormDefinition };
  const nextDef = body.definition
    ? withFormId({
        ...body.definition,
        id: row.formId,
        key: body.definition.key ?? (row.definition as unknown as FormDefinition).key,
      })
    : undefined;

  if (nextDef) {
    const validation = validateFormDefinition(nextDef);
    if (!validation.ok) {
      return NextResponse.json({ error: "Validation failed", validation }, { status: 422 });
    }
  }

  const updated = await prisma.workflowFormVersion.update({
    where: { id },
    data: {
      ...(body.name != null ? { name: body.name } : {}),
      ...(nextDef
        ? { definition: nextDef as unknown as Prisma.InputJsonValue, name: nextDef.title ?? row.name }
        : {}),
    },
  });

  return NextResponse.json({ data: updated });
}

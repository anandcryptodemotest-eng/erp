import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateFormDefinition } from "@/lib/form-catalog";
import type { FormDefinition } from "@erp/workflow";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/workflow-forms/:id/publish
 * DRAFT → PUBLISHED (immutable). Archives older published versions of same formId.
 */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { requireProcessDesignerFromRequest } = await import("@erp/auth");
  const denied = requireProcessDesignerFromRequest(request);
  if (denied) return denied;
  const { id } = await params;

  const row = await prisma.workflowFormVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.lifecycle !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT forms can be published" }, { status: 409 });
  }

  const def = row.definition as unknown as FormDefinition;
  const validation = validateFormDefinition(def);
  if (!validation.ok) {
    return NextResponse.json({ error: "Validation failed", validation }, { status: 422 });
  }

  await prisma.workflowFormVersion.updateMany({
    where: {
      tenantId,
      formId: row.formId,
      lifecycle: "PUBLISHED",
      id: { not: id },
    },
    data: { lifecycle: "ARCHIVED" },
  });

  const published = await prisma.workflowFormVersion.update({
    where: { id },
    data: { lifecycle: "PUBLISHED", publishedAt: new Date() },
  });

  return NextResponse.json({ data: published, validation });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveAndValidateWorkflowForms,
  rewriteWorkflowDependencies,
} from "@/lib/form-catalog";
import { validateDefinition } from "@/lib/workflow-platform";
import { collectFormAssetRefs, type WorkflowDefinition } from "@erp/workflow";
import type { Prisma } from "@/generated/prisma";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/workflow-templates/:id/publish
 * Validates workflow + referenced FORM assets, pins concrete assetRefs, writes dependency index.
 * Running instances keep their snapshots; only new starts use this version.
 */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { requireProcessDesignerFromRequest } = await import("@erp/auth");
  const denied = requireProcessDesignerFromRequest(request);
  if (denied) return denied;
  const { id } = await params;

  const row = await prisma.workflowTemplateVersion.findFirst({ where: { id, tenantId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.lifecycle !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT templates can be published" }, { status: 409 });
  }

  const def = row.definition as unknown as WorkflowDefinition;

  const formResolution = await resolveAndValidateWorkflowForms(tenantId, def);
  if (!formResolution.ok) {
    return NextResponse.json(
      {
        error: "Referenced form validation failed",
        validation: { ok: false, errors: formResolution.errors, warnings: [] },
      },
      { status: 422 }
    );
  }

  const normalized = formResolution.normalized;

  const latestPublished = await prisma.workflowTemplateVersion.findFirst({
    where: { tenantId, templateCode: row.templateCode, lifecycle: "PUBLISHED" },
    orderBy: { version: "desc" },
  });

  const validation = validateDefinition(normalized, latestPublished?.version);
  if (!validation.ok) {
    return NextResponse.json({ error: "Validation failed", validation }, { status: 422 });
  }

  await prisma.workflowTemplateVersion.updateMany({
    where: {
      tenantId,
      templateCode: row.templateCode,
      lifecycle: "PUBLISHED",
      id: { not: id },
    },
    data: { lifecycle: "ARCHIVED" },
  });

  const published = await prisma.workflowTemplateVersion.update({
    where: { id },
    data: {
      lifecycle: "PUBLISHED",
      publishedAt: new Date(),
      definition: normalized as unknown as Prisma.InputJsonValue,
    },
  });

  const refs = collectFormAssetRefs(normalized);
  await rewriteWorkflowDependencies(
    tenantId,
    {
      id: published.id,
      templateCode: published.templateCode,
      version: published.version,
    },
    refs
  );

  return NextResponse.json({
    data: published,
    validation,
    meta: { referencedForms: refs },
  });
}

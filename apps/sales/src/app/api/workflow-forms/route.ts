import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureFormCatalogSeed,
  listFormVersions,
  validateFormDefinition,
} from "@/lib/form-catalog";
import { withFormId, type FormDefinition } from "@erp/workflow";
import type { Prisma } from "@/generated/prisma";

const log = createLogger({ service: "sales" });

/** GET /api/workflow-forms — list form versions; seeds SO_STANDARD forms if missing */
export async function GET(request: Request) {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

    const url = new URL(request.url);
    const formId = url.searchParams.get("formId") ?? undefined;
    const lifecycle = url.searchParams.get("lifecycle") ?? undefined;

    const rows = await listFormVersions(tenantId, { formId, lifecycle });
    return NextResponse.json({ data: rows });
  } catch (e: unknown) {
    log.error("workflow_forms_get", { err: e });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load forms" },
      { status: 500 }
    );
  }
}

/** POST /api/workflow-forms — create draft (new form or new version / clone) */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  await ensureFormCatalogSeed(tenantId);

  const body = (await request.json()) as {
    action?: "create" | "clone";
    formId?: string;
    name?: string;
    definition?: FormDefinition;
    sourceId?: string;
  };

  if (body.action === "clone") {
    if (!body.sourceId) {
      return NextResponse.json({ error: "sourceId required to clone" }, { status: 400 });
    }
    const source = await prisma.workflowFormVersion.findFirst({
      where: { id: body.sourceId, tenantId },
    });
    if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

    const max = await prisma.workflowFormVersion.findFirst({
      where: { tenantId, formId: source.formId },
      orderBy: { version: "desc" },
    });
    const nextVersion = (max?.version ?? 0) + 1;
    const def = withFormId(source.definition as unknown as FormDefinition);

    const created = await prisma.workflowFormVersion.create({
      data: {
        tenantId,
        formId: source.formId,
        version: nextVersion,
        lifecycle: "DRAFT",
        name: body.name ?? source.name,
        definition: def as unknown as Prisma.InputJsonValue,
        clonedFromId: source.id,
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  }

  const formId = (body.formId ?? body.definition?.id ?? body.definition?.key)?.trim();
  if (!formId) {
    return NextResponse.json({ error: "formId required" }, { status: 400 });
  }

  const existing = await prisma.workflowFormVersion.findFirst({
    where: { tenantId, formId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (existing?.version ?? 0) + 1;

  const def = withFormId({
    key: body.definition?.key ?? `${formId.replace(/-/g, "_")}_form`,
    id: formId,
    title: body.name ?? body.definition?.title ?? formId,
    renderer: body.definition?.renderer ?? "generic",
    component: body.definition?.component,
    fields: body.definition?.fields ?? [],
    description: body.definition?.description,
    theme: body.definition?.theme,
    confirmLabel: body.definition?.confirmLabel,
    showItems: body.definition?.showItems,
    showTotal: body.definition?.showTotal,
  });

  const validation = validateFormDefinition(def);
  if (!validation.ok) {
    return NextResponse.json({ error: "Validation failed", validation }, { status: 422 });
  }

  const created = await prisma.workflowFormVersion.create({
    data: {
      tenantId,
      formId,
      version: nextVersion,
      lifecycle: "DRAFT",
      name: def.title ?? formId,
      definition: def as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}

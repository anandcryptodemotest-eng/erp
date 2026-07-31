import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SO_STANDARD_V5,
  SO_TASK_TYPES,
  validateDefinition,
} from "@/lib/workflow-platform";
import { ensureFormCatalogSeed } from "@/lib/form-catalog";
import type { WorkflowDefinition } from "@erp/workflow";
import type { Prisma } from "@/generated/prisma";

const log = createLogger({ service: "sales" });

async function ensureSeed(tenantId: string, opts: { force?: boolean } = {}) {
  if (!opts.force) return;
  await ensureFormCatalogSeed(tenantId, { force: true });
  const count = await prisma.workflowTemplateVersion.count({ where: { tenantId } });
  if (count > 0) return;

  await prisma.workflowTemplateVersion.create({
    data: {
      tenantId,
      templateCode: SO_STANDARD_V5.template,
      version: SO_STANDARD_V5.version,
      lifecycle: "PUBLISHED",
      name: SO_STANDARD_V5.name ?? "Sales Order Standard",
      definition: SO_STANDARD_V5 as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
    },
  });
}

/** GET /api/workflow-templates — list versions (no auto-seed) */
export async function GET(request: Request) {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

    const url = new URL(request.url);
    const code = url.searchParams.get("template");
    const lifecycle = url.searchParams.get("lifecycle");

    const rows = await prisma.workflowTemplateVersion.findMany({
      where: {
        tenantId,
        ...(code ? { templateCode: code } : {}),
        ...(lifecycle ? { lifecycle } : {}),
      },
      orderBy: [{ templateCode: "asc" }, { version: "desc" }],
    });

    return NextResponse.json({
      data: rows,
      meta: { taskTypes: SO_TASK_TYPES, conditions: ["always", "never", "shortage"] },
    });
  } catch (e: unknown) {
    log.error("workflow_templates_get", { err: e });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load workflow templates" },
      { status: 500 }
    );
  }
}

/** POST /api/workflow-templates — create Draft, clone, or seed starter template */
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  const { requireProcessDesignerFromRequest } = await import("@erp/auth");
  const denied = requireProcessDesignerFromRequest(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    action?: "create" | "clone" | "seed";
    templateCode?: string;
    name?: string;
    definition?: WorkflowDefinition;
    sourceId?: string;
  };

  if (body.action === "seed") {
    await ensureSeed(tenantId, { force: true });
    const rows = await prisma.workflowTemplateVersion.findMany({
      where: { tenantId },
      orderBy: [{ templateCode: "asc" }, { version: "desc" }],
    });
    return NextResponse.json({ data: rows, meta: { seeded: true } }, { status: 201 });
  }

  if (body.action === "clone") {
    if (!body.sourceId) {
      return NextResponse.json({ error: "sourceId required to clone" }, { status: 400 });
    }
    const source = await prisma.workflowTemplateVersion.findFirst({
      where: { id: body.sourceId, tenantId },
    });
    if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

    const max = await prisma.workflowTemplateVersion.aggregate({
      where: { tenantId, templateCode: source.templateCode },
      _max: { version: true },
    });
    const nextVersion = (max._max.version ?? 0) + 1;
    const def = source.definition as unknown as WorkflowDefinition;
    const nextDef: WorkflowDefinition = { ...def, version: nextVersion };

    const created = await prisma.workflowTemplateVersion.create({
      data: {
        tenantId,
        templateCode: source.templateCode,
        version: nextVersion,
        lifecycle: "DRAFT",
        name: body.name ?? `${source.name ?? source.templateCode} (draft)`,
        definition: nextDef as unknown as Prisma.InputJsonValue,
        clonedFromId: source.id,
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  }

  const def = body.definition ?? { ...SO_STANDARD_V5, version: 1, template: body.templateCode ?? "SO_STANDARD" };
  const templateCode = body.templateCode ?? def.template;
  const max = await prisma.workflowTemplateVersion.aggregate({
    where: { tenantId, templateCode },
    _max: { version: true },
  });
  const nextVersion = (max._max.version ?? 0) + 1;
  const nextDef: WorkflowDefinition = { ...def, template: templateCode, version: nextVersion };

  const created = await prisma.workflowTemplateVersion.create({
    data: {
      tenantId,
      templateCode,
      version: nextVersion,
      lifecycle: "DRAFT",
      name: body.name ?? nextDef.name ?? templateCode,
      definition: nextDef as unknown as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ data: created }, { status: 201 });
}

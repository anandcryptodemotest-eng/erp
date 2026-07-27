import { prisma } from "@/lib/prisma";
import {
  getWorkflowTemplate,
  type WorkflowStepTemplate,
  type WorkflowTemplate,
  WORKFLOW_TEMPLATES,
} from "@/lib/workflow-templates";

export type WorkflowStepRow = {
  id: string;
  key: string;
  label: string;
  action: string;
  fromStatuses: string[];
  toStatus: string | null;
  resolverKey: string | null;
  sortOrder: number;
  roleHint: string | null;
  uiPanel: string;
  isTerminal: boolean;
  allowCancel: boolean;
};

export type ResolvedWorkflow = {
  id: string;
  tenantId: string;
  templateId: string;
  code: string;
  name: string;
  isDefault: boolean;
  steps: WorkflowStepRow[];
  trackedStatuses: string[];
};

function parseFromStatuses(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  return [];
}

function mapStep(row: {
  id: string;
  key: string;
  label: string;
  action: string;
  fromStatuses: unknown;
  toStatus: string | null;
  resolverKey: string | null;
  sortOrder: number;
  roleHint: string | null;
  uiPanel: string;
  isTerminal: boolean;
  allowCancel: boolean;
}): WorkflowStepRow {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    action: row.action,
    fromStatuses: parseFromStatuses(row.fromStatuses),
    toStatus: row.toStatus,
    resolverKey: row.resolverKey,
    sortOrder: row.sortOrder,
    roleHint: row.roleHint,
    uiPanel: row.uiPanel,
    isTerminal: row.isTerminal,
    allowCancel: row.allowCancel,
  };
}

/** Default workflow for tenant; null if none applied yet. */
export async function getDefaultWorkflow(tenantId: string): Promise<ResolvedWorkflow | null> {
  const wf = await prisma.orderWorkflow.findFirst({
    where: { tenantId, isActive: true, isDefault: true },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });
  if (!wf) {
    const any = await prisma.orderWorkflow.findFirst({
      where: { tenantId, isActive: true },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    if (!any) return null;
    return toResolved(any);
  }
  return toResolved(wf);
}

export async function getWorkflowById(
  tenantId: string,
  workflowId: string
): Promise<ResolvedWorkflow | null> {
  const wf = await prisma.orderWorkflow.findFirst({
    where: { id: workflowId, tenantId, isActive: true },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });
  return wf ? toResolved(wf) : null;
}

/** Resolve workflow for an order (explicit → tenant default). */
export async function resolveOrderWorkflow(
  tenantId: string,
  workflowId?: string | null
): Promise<ResolvedWorkflow | null> {
  if (workflowId) {
    const wf = await getWorkflowById(tenantId, workflowId);
    if (wf) return wf;
  }
  return getDefaultWorkflow(tenantId);
}

function toResolved(wf: {
  id: string;
  tenantId: string;
  templateId: string;
  code: string;
  name: string;
  isDefault: boolean;
  steps: Parameters<typeof mapStep>[0][];
}): ResolvedWorkflow {
  const tmpl = getWorkflowTemplate(wf.templateId);
  return {
    id: wf.id,
    tenantId: wf.tenantId,
    templateId: wf.templateId,
    code: wf.code,
    name: wf.name,
    isDefault: wf.isDefault,
    steps: wf.steps.map(mapStep),
    trackedStatuses: tmpl?.trackedStatuses ?? dedupeStatuses(wf.steps),
  };
}

function dedupeStatuses(steps: Parameters<typeof mapStep>[0][]): string[] {
  const set = new Set<string>(["DRAFT", "CANCELLED"]);
  for (const s of steps) {
    for (const st of parseFromStatuses(s.fromStatuses)) set.add(st);
    if (s.toStatus) set.add(s.toStatus);
  }
  return [...set];
}

/**
 * Validate that `action` is allowed on this workflow from `currentStatus`.
 * Global actions: cancel (if any step allowCancel), upload-document.
 */
export function assertWorkflowAction(
  workflow: ResolvedWorkflow | null,
  action: string,
  currentStatus: string
): { ok: true; step?: WorkflowStepRow } | { ok: false; error: string; status: number } {
  if (action === "upload-document") {
    return { ok: true };
  }

  if (action === "cancel") {
    if (!workflow) return { ok: true };
    const allowed = workflow.steps.some((s) => s.allowCancel);
    if (!allowed) {
      return { ok: false, error: "Cancel is not allowed in this workflow", status: 409 };
    }
    if (["CLOSED", "CANCELLED", "INVOICED"].includes(currentStatus)) {
      return { ok: false, error: `Cannot cancel order in ${currentStatus}`, status: 409 };
    }
    return { ok: true };
  }

  // No workflow configured: allow all existing handlers (backward compatible)
  if (!workflow) {
    return { ok: true };
  }

  const step = workflow.steps.find((s) => s.action === action);
  if (!step) {
    return {
      ok: false,
      error: `Action "${action}" is not part of workflow "${workflow.name}". Apply a different template or add a step.`,
      status: 409,
    };
  }

  if (!step.fromStatuses.includes(currentStatus)) {
    return {
      ok: false,
      error: `Action "${action}" not allowed from status ${currentStatus}. Allowed from: ${step.fromStatuses.join(", ")}`,
      status: 409,
    };
  }

  return { ok: true, step };
}

/** Next actions for OMS UI from current status. */
export function nextActionsForStatus(
  workflow: ResolvedWorkflow,
  status: string
): { action: string; label: string; uiPanel: string; roleHint: string | null }[] {
  return workflow.steps
    .filter((s) => s.fromStatuses.includes(status))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      action: s.action,
      label: s.label,
      uiPanel: s.uiPanel,
      roleHint: s.roleHint,
    }));
}

export async function applyWorkflowTemplate(
  tenantId: string,
  templateId: string,
  opts: { setDefault?: boolean } = {}
): Promise<ResolvedWorkflow> {
  const template = getWorkflowTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown workflow template: ${templateId}`);
  }

  const setDefault = opts.setDefault !== false;

  if (setDefault) {
    await prisma.orderWorkflow.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const existing = await prisma.orderWorkflow.findUnique({
    where: { tenantId_code: { tenantId, code: template.code } },
  });

  if (existing) {
    await prisma.orderWorkflowStep.deleteMany({ where: { workflowId: existing.id } });
    const updated = await prisma.orderWorkflow.update({
      where: { id: existing.id },
      data: {
        templateId: template.templateId,
        name: template.name,
        description: template.description,
        version: template.version,
        isActive: true,
        isDefault: setDefault || existing.isDefault,
        steps: { create: stepsCreateData(tenantId, template.steps) },
      },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
    });
    return toResolved(updated);
  }

  const created = await prisma.orderWorkflow.create({
    data: {
      tenantId,
      templateId: template.templateId,
      code: template.code,
      name: template.name,
      description: template.description,
      version: template.version,
      isDefault: setDefault,
      isActive: true,
      steps: { create: stepsCreateData(tenantId, template.steps) },
    },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });

  return toResolved(created);
}

function stepsCreateData(tenantId: string, steps: WorkflowStepTemplate[]) {
  return steps.map((s) => ({
    tenantId,
    key: s.key,
    label: s.label,
    action: s.action,
    fromStatuses: s.fromStatuses,
    toStatus: s.toStatus,
    resolverKey: s.resolverKey ?? null,
    sortOrder: s.sortOrder,
    roleHint: s.roleHint ?? null,
    uiPanel: s.uiPanel ?? "none",
    isTerminal: s.isTerminal ?? false,
    allowCancel: s.allowCancel ?? true,
  }));
}

export function listPlatformTemplates(): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES;
}

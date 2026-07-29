import { prisma } from "@/lib/prisma";
import {
  getWorkflowTemplate,
  type StepUi,
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
  phase: string;
  dependsOn: string[];
  required: boolean;
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

export type NextAction = {
  action: string;
  label: string;
  uiPanel: string;
  roleHint: string | null;
  phase: string;
  stepKey: string;
  required: boolean;
  dependsOn: string[];
  sortOrder: number;
  ui?: StepUi;
};

function parseStringArray(raw: unknown): string[] {
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
  phase?: string | null;
  dependsOn?: unknown;
  required?: boolean | null;
  isTerminal: boolean;
  allowCancel: boolean;
}): WorkflowStepRow {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    action: row.action,
    fromStatuses: parseStringArray(row.fromStatuses),
    toStatus: row.toStatus,
    resolverKey: row.resolverKey,
    sortOrder: row.sortOrder,
    roleHint: row.roleHint,
    uiPanel: row.uiPanel,
    phase: row.phase ?? "FULFILL",
    dependsOn: parseStringArray(row.dependsOn),
    required: row.required ?? true,
    isTerminal: row.isTerminal,
    allowCancel: row.allowCancel,
  };
}

/** Default workflow for tenant; null if none applied yet. Auto-upgrades template version. */
export async function getDefaultWorkflow(tenantId: string): Promise<ResolvedWorkflow | null> {
  const wf = await prisma.orderWorkflow.findFirst({
    where: { tenantId, isActive: true, isDefault: true },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });
  const picked =
    wf ??
    (await prisma.orderWorkflow.findFirst({
      where: { tenantId, isActive: true },
      include: { steps: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "asc" },
    }));
  if (!picked) return null;

  const tmpl = getWorkflowTemplate(picked.templateId);
  if (tmpl && tmpl.version > picked.version) {
    return applyWorkflowTemplate(tenantId, picked.templateId, {
      setDefault: picked.isDefault,
    });
  }
  return toResolved(picked);
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

/** Resolve workflow for an order (explicit → tenant default). Auto-upgrades template version. */
export async function resolveOrderWorkflow(
  tenantId: string,
  workflowId?: string | null
): Promise<ResolvedWorkflow | null> {
  if (workflowId) {
    const wf = await getWorkflowById(tenantId, workflowId);
    if (wf) {
      const tmpl = getWorkflowTemplate(wf.templateId);
      const row = await prisma.orderWorkflow.findFirst({
        where: { id: wf.id, tenantId },
        select: { version: true, isDefault: true },
      });
      if (tmpl && row && tmpl.version > row.version) {
        return applyWorkflowTemplate(tenantId, wf.templateId, {
          setDefault: row.isDefault,
        });
      }
      return wf;
    }
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
    for (const st of parseStringArray(s.fromStatuses)) set.add(st);
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
    if (["CLOSED", "CANCELLED", "PAID"].includes(currentStatus)) {
      return { ok: false, error: `Cannot cancel order in ${currentStatus}`, status: 409 };
    }
    return { ok: true };
  }

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

function depsMet(dependsOn: string[], completedKeys: Set<string>): boolean {
  return dependsOn.every((k) => completedKeys.has(k));
}

/**
 * Next actions for OMS UI from current status.
 * PREP phase: all eligible steps with met dependsOn (true parallel).
 * Other phases: lowest sortOrder among eligible with met dependsOn (sequential).
 */
export function nextActionsForStatus(
  workflow: ResolvedWorkflow,
  status: string,
  opts: {
    completedStepKeys?: Set<string>;
    /** Step keys that should be offered even if required=false (e.g. procurement after shortage) */
    activatedOptionalKeys?: Set<string>;
  } = {}
): NextAction[] {
  const completed = opts.completedStepKeys ?? new Set<string>();
  const activated = opts.activatedOptionalKeys ?? new Set<string>();

  const eligible = workflow.steps
    .filter((s) => s.fromStatuses.includes(status))
    .filter((s) => depsMet(s.dependsOn, completed))
    .filter((s) => s.required || activated.has(s.key) || completed.has(s.key))
    .filter((s) => !completed.has(s.key))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (eligible.length === 0) return [];

  const prep = eligible.filter((s) => s.phase === "PREP");
  const chosen = prep.length > 0 ? prep : eligible.filter((s) => s.sortOrder === eligible[0].sortOrder);

  const tmpl = getWorkflowTemplate(workflow.templateId);
  const tmplSteps = tmpl?.steps ?? [];

  return chosen.map((s) => {
    const tmplStep = tmplSteps.find((t) => t.key === s.key);
    return {
      action: s.action,
      label: s.label,
      uiPanel: s.uiPanel,
      roleHint: s.roleHint,
      phase: s.phase,
      stepKey: s.key,
      required: s.required,
      dependsOn: s.dependsOn,
      sortOrder: s.sortOrder,
      ui: tmplStep?.ui,
    };
  });
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
    phase: s.phase ?? "FULFILL",
    dependsOn: s.dependsOn ?? [],
    required: s.required ?? true,
    isTerminal: s.isTerminal ?? false,
    allowCancel: s.allowCancel ?? true,
  }));
}

export function listPlatformTemplates(): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES;
}

/** Whether all required PREP steps (plus activated optionals) are completed. */
export function prepGateReady(
  workflow: ResolvedWorkflow,
  completedStepKeys: Set<string>,
  activatedOptionalKeys: Set<string>
): boolean {
  const prep = workflow.steps.filter((s) => s.phase === "PREP");
  for (const step of prep) {
    const needed = step.required || activatedOptionalKeys.has(step.key);
    if (needed && !completedStepKeys.has(step.key)) return false;
  }
  return prep.some((s) => s.required);
}

/**
 * OMS Business Work Items — Sales runtime (BL-035).
 * Aggregates WorkflowTasks for Order Desk; composite complete preserves activity audit.
 */

import {
  aggregateWorkItems,
  roleMatchesWorkItem,
  workItemDef,
  type AggregatedWorkItem,
  SO_STANDARD_WORK_ITEMS,
} from "@erp/workflow";
import { prisma } from "@/lib/prisma";
import { completePlatformTask } from "@/lib/workflow-runtime-v5";
import {
  shouldCompleteStep,
  slicePayloadForStep,
  hasPaymentCollectionPayload,
} from "@/lib/workflow-work-item-gates";

export {
  hasDispatchFulfillmentPayload,
  hasPaymentCollectionPayload,
  shouldCompleteStep,
  slicePayloadForStep,
} from "@/lib/workflow-work-item-gates";

export type WorkbenchWorkItem = AggregatedWorkItem & {
  id: string;
  salesOrderId: string;
  assignedRole: string;
  blockedBy: string[];
  ui?: unknown;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customer?: { id: string; name: string } | null;
    items?: unknown[];
    salesRequest?: { id: string; requestNumber: string; status: string } | null;
  };
  dueAt?: string | null;
  /** Desk / ops-summary aliases */
  title?: string;
  action?: string;
  workItemKey?: string;
};

type EnrichedTask = {
  id: string;
  stepKey: string;
  action: string;
  title: string;
  status: string;
  assignedRole: string | null;
  kind: string | null;
  salesOrderId: string;
  dueAt?: Date | null;
  blockedBy?: string[];
  ui?: unknown;
  order: WorkbenchWorkItem["order"];
};

/** Build Work Items for a role queue from enriched workbench tasks. */
export function buildWorkbenchWorkItems(
  enrichedTasks: EnrichedTask[],
  role: string
): WorkbenchWorkItem[] {
  const byOrder = new Map<string, EnrichedTask[]>();
  for (const t of enrichedTasks) {
    const list = byOrder.get(t.salesOrderId) ?? [];
    list.push(t);
    byOrder.set(t.salesOrderId, list);
  }

  const out: WorkbenchWorkItem[] = [];
  for (const [salesOrderId, orderTasks] of byOrder) {
    const sample = orderTasks[0]!;
    const aggregated = aggregateWorkItems(
      orderTasks.map((t) => ({
        id: t.id,
        stepKey: t.stepKey,
        status: t.status,
        action: t.action,
        title: t.title,
        assignedRole: t.assignedRole,
        kind: t.kind,
      }))
    );

    for (const wi of aggregated) {
      const def = workItemDef(wi.key);
      if (!def) continue;
      const adminAll = [
        "ADMIN",
        "MANAGER",
        "ORG_ADMIN",
        "SUPER_ADMIN",
        "BRANCH_ADMIN",
      ].includes(role.toUpperCase());
      if (!adminAll && !roleMatchesWorkItem(def, role)) continue;
      // Queue: actionable only (READY / CLAIMED / IN_PROGRESS)
      if (!wi.actionable) continue;

      const primaryTask = orderTasks.find((t) => t.id === wi.primaryTaskId) ?? orderTasks.find((t) => t.stepKey === wi.primaryStepKey);
      const blockedBy = primaryTask?.blockedBy ?? [];
      out.push({
        ...wi,
        id: `${salesOrderId}:${wi.key}`,
        salesOrderId,
        assignedRole: primaryTask?.assignedRole ?? def.roleHints[0]!,
        blockedBy,
        ui: primaryTask?.ui,
        order: sample.order,
        dueAt: primaryTask?.dueAt?.toISOString?.() ?? null,
        title: wi.label,
        action: wi.primaryAction ?? wi.key,
        workItemKey: wi.key,
      });
    }
  }

  out.sort((a, b) => {
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
  return out;
}

export async function getWorkItemsForOrder(input: {
  tenantId: string;
  salesOrderId: string;
}): Promise<AggregatedWorkItem[]> {
  const tasks = await prisma.workflowTask.findMany({
    where: { tenantId: input.tenantId, salesOrderId: input.salesOrderId },
    select: {
      id: true,
      stepKey: true,
      action: true,
      title: true,
      status: true,
      assignedRole: true,
      kind: true,
    },
  });
  return aggregateWorkItems(tasks);
}

/**
 * Complete a Business Work Item: advances one or more READY engine activities in order.
 * Dispatch Order: warehouse then dispatch (same payload session).
 * Bill & Collect: invoice always when READY; payment only if collection fields present.
 */
export async function completeWorkItem(input: {
  tenantId: string;
  salesOrderId: string;
  workItemKey: string;
  actorUserId: string;
  actorRole?: string | null;
  payload?: unknown;
}): Promise<{
  workItemKey: string;
  completedStepKeys: string[];
  remainingActionable: boolean;
  primaryAction: string | null;
}> {
  const def = workItemDef(input.workItemKey);
  if (!def) throw new Error(`Unknown work item: ${input.workItemKey}`);
  if (input.actorRole && !roleMatchesWorkItem(def, input.actorRole)) {
    // ADMIN override: allow if role is admin-like — leave to assertWorkflowTaskAction per task
  }

  const payload =
    input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? (input.payload as Record<string, unknown>)
      : {};

  const completedStepKeys: string[] = [];

  for (const stepKey of def.activityKeys) {
    const task = await prisma.workflowTask.findFirst({
      where: {
        tenantId: input.tenantId,
        salesOrderId: input.salesOrderId,
        stepKey,
        status: { in: ["READY", "CLAIMED", "IN_PROGRESS"] },
      },
    });
    if (!task) continue;
    if (!shouldCompleteStep(stepKey, def.key, payload)) break;

    await completePlatformTask({
      taskId: task.id,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      payload: slicePayloadForStep(stepKey, payload),
    });
    completedStepKeys.push(stepKey);
  }

  if (completedStepKeys.length === 0) {
    if (def.key === "bill_and_collect" && !hasPaymentCollectionPayload(payload)) {
      const paymentOpen = await prisma.workflowTask.findFirst({
        where: {
          tenantId: input.tenantId,
          salesOrderId: input.salesOrderId,
          stepKey: "payment",
          status: { in: ["READY", "CLAIMED", "IN_PROGRESS"] },
        },
        select: { id: true },
      });
      const invoiceOpen = await prisma.workflowTask.findFirst({
        where: {
          tenantId: input.tenantId,
          salesOrderId: input.salesOrderId,
          stepKey: "invoice",
          status: { in: ["READY", "CLAIMED", "IN_PROGRESS"] },
        },
        select: { id: true },
      });
      if (paymentOpen && !invoiceOpen) {
        throw new Error(
          "Invoice already issued. Enter advance or full amount (and method) to record payment, or leave Bill & Collect open to collect later."
        );
      }
    }
    throw new Error(`No actionable activity for work item ${input.workItemKey}`);
  }

  const remaining = await getWorkItemsForOrder({
    tenantId: input.tenantId,
    salesOrderId: input.salesOrderId,
  });
  const self = remaining.find((w) => w.key === input.workItemKey);
  return {
    workItemKey: input.workItemKey,
    completedStepKeys,
    remainingActionable: Boolean(self?.actionable),
    primaryAction: self?.primaryAction ?? null,
  };
}

export { SO_STANDARD_WORK_ITEMS };

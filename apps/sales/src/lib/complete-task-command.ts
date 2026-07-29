/**
 * Complete-task command — thin orchestration for snapshot (v5) instances.
 * Domain mutations live in salesOrderAdapter handlers.
 */

import { prisma } from "@/lib/prisma";
import { completePlatformTask, syncTaskReadiness } from "@/lib/workflow-runtime-v5";

const ACTION_TO_TYPE: Record<string, string> = {
  review: "SALES_REVIEW",
  "verify-stock": "INVENTORY_CHECK",
  "request-vendors": "PROCUREMENT_REQUEST",
  "complete-pricing": "PRICING_REVIEW",
  "warehouse-ready": "WAREHOUSE_PICK",
  dispatch: "DISPATCH",
  "deliver-oms": "DELIVERY_CONFIRM",
  invoice: "INVOICE_GENERATE",
  "collect-payment": "PAYMENT_COLLECTION",
  close: "ORDER_CLOSE",
};

export function taskTypeForAction(action: string): string | undefined {
  return ACTION_TO_TYPE[action];
}

export async function getInstanceSnapshotFlag(tenantId: string, salesOrderId: string) {
  const instance = await prisma.workflowInstance.findFirst({
    where: { tenantId, salesOrderId },
    select: { id: true, snapshot: true },
  });
  return {
    instanceId: instance?.id ?? null,
    hasSnapshot: Boolean(instance?.snapshot),
  };
}

/** Find an open platform task for this order + OMS action. */
export async function findOpenTaskByAction(input: {
  tenantId: string;
  salesOrderId: string;
  action: string;
}) {
  const instance = await prisma.workflowInstance.findFirst({
    where: { tenantId: input.tenantId, salesOrderId: input.salesOrderId },
    select: { id: true, snapshot: true },
  });
  if (!instance?.snapshot) return null;

  const taskType = ACTION_TO_TYPE[input.action];
  const task = await prisma.workflowTask.findFirst({
    where: {
      workflowInstanceId: instance.id,
      status: { in: ["READY", "CLAIMED", "IN_PROGRESS", "WAITING"] },
      OR: [
        { action: input.action },
        ...(taskType ? [{ taskType }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  return task;
}

/**
 * Complete a snapshot-backed task by OMS action string.
 * Returns null if the order is not on the v5 snapshot path.
 */
export async function completeTaskByAction(input: {
  tenantId: string;
  salesOrderId: string;
  action: string;
  actorUserId: string;
  actorRole?: string | null;
  payload?: unknown;
}) {
  const task = await findOpenTaskByAction({
    tenantId: input.tenantId,
    salesOrderId: input.salesOrderId,
    action: input.action,
  });
  if (!task) return null;

  // Promote WAITING → READY if engine lag (rare); prefer sync first
  if (task.status === "WAITING") {
    await syncTaskReadiness(task.workflowInstanceId);
    const refreshed = await prisma.workflowTask.findFirst({ where: { id: task.id } });
    if (!refreshed || !["READY", "CLAIMED", "IN_PROGRESS"].includes(refreshed.status)) {
      throw new Error(`Task ${task.stepKey} is not ready yet`);
    }
  }

  return completePlatformTask({
    taskId: task.id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    payload: input.payload,
  });
}

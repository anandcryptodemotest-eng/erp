/**
 * Snapshot-only workbench + task permissions (Platform Architecture v1).
 * Hybrid workflow-runtime.ts deleted — greenfield uses v5 only.
 */

import { prisma } from "@/lib/prisma";
import { resolveStepUiFromSnapshot } from "@/lib/form-ui";
import { syncTaskReadiness } from "@/lib/workflow-runtime-v5";
import type { Prisma } from "@/generated/prisma";

const ADMIN_OVERRIDE_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
]);

export function rolesMatch(taskRole: string, callerRole: string | null): boolean {
  if (!callerRole) return false;
  if (taskRole === callerRole) return true;
  const sales = new Set(["SALES_EXECUTIVE", "SALES_REP"]);
  return sales.has(taskRole) && sales.has(callerRole);
}

export async function assertTaskPermission(opts: {
  tenantId: string;
  orderId: string;
  action: string;
  role: string | null;
  userId: string;
}) {
  if (opts.role && ADMIN_OVERRIDE_ROLES.has(opts.role)) {
    return { ok: true as const };
  }

  const order = await prisma.salesOrder.findFirst({
    where: { id: opts.orderId, tenantId: opts.tenantId },
    select: { workflowInstance: { select: { id: true } } },
  });
  if (!order?.workflowInstance?.id) return { ok: true as const };

  const task = await prisma.workflowTask.findFirst({
    where: {
      workflowInstanceId: order.workflowInstance.id,
      action: opts.action,
      status: { in: ["READY", "CLAIMED", "IN_PROGRESS", "WAITING"] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!task) return { ok: true as const };
  if (task.assignedUserId && task.assignedUserId !== opts.userId) {
    return { ok: false as const, error: "Task is assigned to another user" };
  }
  if (opts.role && !rolesMatch(task.assignedRole, opts.role)) {
    return { ok: false as const, error: `This task belongs to ${task.assignedRole}` };
  }
  return { ok: true as const };
}

function parseDependsOn(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Sync readiness for open snapshot instances (no hybrid rebuild). */
export async function syncOpenInstanceReadiness(tenantId: string) {
  const rows = await prisma.workflowInstance.findMany({
    where: {
      tenantId,
      order: { status: { notIn: ["CLOSED", "CANCELLED"] } },
    },
    select: { id: true, snapshot: true },
    take: 200,
    orderBy: { createdAt: "desc" },
  });

  for (const row of rows) {
    if (!row.snapshot) continue;
    await syncTaskReadiness(row.id);
  }
}

export async function getWorkbenchForRole(input: {
  tenantId: string;
  role: string;
  userId?: string | null;
  mineOnly?: boolean;
}) {
  await syncOpenInstanceReadiness(input.tenantId);

  const where: Prisma.WorkflowTaskWhereInput = {
    tenantId: input.tenantId,
    status: { in: ["READY", "CLAIMED", "IN_PROGRESS", "WAITING"] },
  };
  if (input.mineOnly && input.userId) {
    where.assignedUserId = input.userId;
  } else {
    where.assignedRole = input.role;
  }

  const tasks = await prisma.workflowTask.findMany({
    where,
    include: {
      order: {
        include: {
          customer: { select: { id: true, name: true } },
          items: true,
          salesRequest: {
            select: { id: true, requestNumber: true, status: true },
          },
        },
      },
      workflowInstance: true,
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });

  // Only surface snapshot-backed tasks
  const snapshotTasks = tasks.filter((t) => Boolean(t.workflowInstance?.snapshot));

  const orderIds = [...new Set(snapshotTasks.map((t) => t.salesOrderId))];
  const allOrderTasks =
    orderIds.length > 0
      ? await prisma.workflowTask.findMany({
          where: { salesOrderId: { in: orderIds } },
          select: {
            salesOrderId: true,
            title: true,
            assignedRole: true,
            status: true,
            stepKey: true,
            required: true,
            optional: true,
            kind: true,
          },
        })
      : [];

  const enriched = snapshotTasks.map((t) => {
    const siblings = allOrderTasks.filter((s) => s.salesOrderId === t.salesOrderId);
    const completedKeys = new Set(
      siblings.filter((s) => s.status === "COMPLETED").map((s) => s.stepKey)
    );
    const formUi = resolveStepUiFromSnapshot(t.workflowInstance?.snapshot, t.stepKey);
    const unmet = parseDependsOn(t.dependsOn).filter((key) => !completedKeys.has(key));
    const blockedBy = unmet.map((key) => {
      const dep = siblings.find((s) => s.stepKey === key);
      return dep?.title ?? key;
    });
    return { ...t, blockedBy, ui: formUi ?? undefined };
  });

  const summary = {
    pending: enriched.filter((t) => t.status === "WAITING" || t.status === "READY").length,
    inProgress: enriched.filter((t) => t.status === "CLAIMED" || t.status === "IN_PROGRESS").length,
    overdue: enriched.filter((t) => t.dueAt && t.dueAt.getTime() < Date.now()).length,
    orders: new Set(enriched.map((t) => t.salesOrderId)).size,
  };

  return { tasks: enriched, summary };
}

import { prisma } from "@/lib/prisma";
import { nextActionsForStatus, resolveOrderWorkflow, type ResolvedWorkflow } from "@/lib/order-workflow";
import type { Prisma } from "@/generated/prisma";

const ADMIN_OVERRIDE_ROLES = new Set(["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"]);

type OrderLike = {
  id: string;
  tenantId: string;
  status: string;
  workflowId?: string | null;
  orderNumber?: string;
};

type RuntimeContext = {
  remarks?: string;
  payload?: Record<string, unknown>;
  actorRole?: string | null;
};

function roleForAction(action: { roleHint: string | null; action: string }): string {
  if (action.action === "request-vendors") return "PROCUREMENT_OFFICER";
  if (action.roleHint) return action.roleHint;
  return "ADMIN";
}

export async function ensureWorkflowRuntimeForOrder(order: OrderLike) {
  const workflow = await resolveOrderWorkflow(order.tenantId, order.workflowId);
  if (!workflow) return null;

  let instance = await prisma.workflowInstance.findFirst({
    where: { salesOrderId: order.id, tenantId: order.tenantId },
  });

  if (!instance) {
    const firstAction = nextActionsForStatus(workflow, order.status)[0];
    instance = await prisma.workflowInstance.create({
      data: {
        tenantId: order.tenantId,
        salesOrderId: order.id,
        workflowId: workflow.id,
        currentStatus: order.status,
        currentStepKey: firstAction?.action ?? null,
      },
    });
    await prisma.salesOrder.update({
      where: { id: order.id },
      data: { workflowId: workflow.id },
    });
    await prisma.workflowEvent.create({
      data: {
        tenantId: order.tenantId,
        workflowInstanceId: instance.id,
        salesOrderId: order.id,
        type: "STATUS_SYNC",
        toStatus: order.status,
        remarks: "Workflow runtime initialized",
      },
    });
  }

  await syncWorkflowTasks(instance.id, order, workflow);
  return prisma.workflowInstance.findFirst({
    where: { id: instance.id },
    include: {
      tasks: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      workflow: { include: { steps: { orderBy: { sortOrder: "asc" } } } },
    },
  });
}

export async function syncWorkflowTasks(
  workflowInstanceId: string,
  order: OrderLike,
  workflow?: ResolvedWorkflow | null
) {
  const resolved = workflow ?? (await resolveOrderWorkflow(order.tenantId, order.workflowId));
  if (!resolved) return;

  const activeActions = nextActionsForStatus(resolved, order.status);
  const activeActionNames = new Set(activeActions.map((a) => a.action));
  const firstAction = activeActions[0];

  const existing = await prisma.workflowTask.findMany({
    where: { workflowInstanceId },
  });

  await prisma.workflowInstance.update({
    where: { id: workflowInstanceId },
    data: {
      currentStatus: order.status,
      currentStepKey: firstAction?.action ?? null,
      completedAt: ["CLOSED", "CANCELLED", "INVOICED"].includes(order.status) ? new Date() : null,
    },
  });

  for (const task of existing) {
    if (
      ["PENDING", "IN_PROGRESS"].includes(task.status) &&
      !activeActionNames.has(task.action)
    ) {
      await prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: "CANCELLED" },
      });
    }
  }

  for (const action of activeActions) {
    const alreadyOpen = existing.some(
      (task) =>
        task.action === action.action && ["PENDING", "IN_PROGRESS"].includes(task.status)
    );
    if (alreadyOpen) continue;

    await prisma.workflowTask.create({
      data: {
        tenantId: order.tenantId,
        workflowInstanceId,
        salesOrderId: order.id,
        stepKey: action.action,
        action: action.action,
        title: action.label,
        assignedRole: roleForAction(action),
        status: "PENDING",
        payload: { uiPanel: action.uiPanel },
      },
    });
    await prisma.workflowEvent.create({
      data: {
        tenantId: order.tenantId,
        workflowInstanceId,
        salesOrderId: order.id,
        type: "TASK_CREATED",
        stepKey: action.action,
        action: action.action,
        toStatus: order.status,
        remarks: `Task created for ${roleForAction(action)}`,
      },
    });
  }

  if (order.status === "VENDOR_REQUESTED") {
    const hasProcurementTask = await prisma.workflowTask.findFirst({
      where: {
        workflowInstanceId,
        action: "procurement-follow-up",
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });
    if (!hasProcurementTask) {
      await prisma.workflowTask.create({
        data: {
          tenantId: order.tenantId,
          workflowInstanceId,
          salesOrderId: order.id,
          stepKey: "procurement_follow_up",
          action: "procurement-follow-up",
          title: "Follow up with vendors",
          assignedRole: "PROCUREMENT_OFFICER",
          status: "PENDING",
        },
      });
    }
  }
}

export async function recordWorkflowTransition(
  order: OrderLike,
  input: {
    action: string;
    previousStatus: string;
    currentStatus: string;
    actorUserId: string;
    actorRole?: string | null;
  } & RuntimeContext
) {
  // Ensure the runtime instance exists using the pre-transition status, so tasks for
  // the step being completed are resolved before we advance the instance to its new
  // status. Syncing against the new status first would sweep the just-finished task
  // into the "cancel stale tasks" pass and mark it CANCELLED instead of COMPLETED.
  let instance = await prisma.workflowInstance.findFirst({
    where: { salesOrderId: order.id, tenantId: order.tenantId },
  });
  if (!instance) {
    const ensured = await ensureWorkflowRuntimeForOrder({ ...order, status: input.previousStatus });
    if (!ensured) return null;
    instance = ensured;
  }

  const openTasksForAction = await prisma.workflowTask.findMany({
    where: {
      workflowInstanceId: instance.id,
      action: input.action,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
  });
  for (const task of openTasksForAction) {
    await prisma.workflowTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedBy: input.actorUserId,
        assignedUserId: task.assignedUserId ?? input.actorUserId,
      },
    });
  }

  await prisma.workflowEvent.create({
    data: {
      tenantId: order.tenantId,
      workflowInstanceId: instance.id,
      salesOrderId: order.id,
      type: "TRANSITION",
      stepKey: input.action,
      action: input.action,
      fromStatus: input.previousStatus,
      toStatus: input.currentStatus,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole ?? null,
      remarks: input.remarks,
      payload: input.payload as Prisma.InputJsonValue | undefined,
    },
  });

  await syncWorkflowTasks(instance.id, { ...order, status: input.currentStatus });
  return instance.id;
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
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!task) return { ok: true as const };
  if (task.assignedUserId && task.assignedUserId !== opts.userId) {
    return { ok: false as const, error: "Task is assigned to another user" };
  }
  if (opts.role && task.assignedRole !== opts.role) {
    return { ok: false as const, error: `This task belongs to ${task.assignedRole}` };
  }
  return { ok: true as const };
}

export async function getWorkbenchForRole(input: {
  tenantId: string;
  role: string;
  userId?: string | null;
  mineOnly?: boolean;
}) {
  const where: Prisma.WorkflowTaskWhereInput = {
    tenantId: input.tenantId,
    status: { in: ["PENDING", "IN_PROGRESS"] as const },
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
        },
      },
      workflowInstance: true,
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });

  const summary = {
    pending: tasks.filter((t) => t.status === "PENDING").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    overdue: tasks.filter((t) => t.dueAt && t.dueAt.getTime() < Date.now()).length,
    orders: new Set(tasks.map((t) => t.salesOrderId)).size,
  };

  return { tasks, summary };
}

export async function bootstrapWorkflowRuntimes(tenantId: string) {
  const orders = await prisma.salesOrder.findMany({
    where: {
      tenantId,
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    select: {
      id: true,
      tenantId: true,
      status: true,
      workflowId: true,
      orderNumber: true,
    },
    take: 200,
    orderBy: { createdAt: "desc" },
  });

  for (const order of orders) {
    await ensureWorkflowRuntimeForOrder(order);
  }
}


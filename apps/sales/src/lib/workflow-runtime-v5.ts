/**
 * Persisted workflow runtime for Sales Order (v5 platform path).
 * Uses @erp/workflow evaluateReadiness + domain adapter; never imports UI.
 */

import {
  evaluateReadiness,
  defaultConditionRegistry,
  defaultEventBus,
  createEvent,
  mergeVariables,
  assetKey,
  type WorkflowDefinition,
  type WorkflowRuntimeSnapshot,
  type TerminalStatus,
} from "@erp/workflow";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { bootstrapSalesWorkflowPlatform } from "@/workflow-adapter";
import { defaultAdapterRegistry } from "@erp/workflow";
import { resolveAndValidateWorkflowForms } from "@/lib/form-catalog";
import { withSpan, recordEvent } from "@erp/telemetry";

const LEASE_MS = 15 * 60 * 1000;

function roleForActivity(a: WorkflowDefinition["activities"][0]): string {
  return a.permissions?.complete?.[0] ?? a.roleHint ?? "USER";
}

function actionForType(taskType: string): string {
  const map: Record<string, string> = {
    SALES_REVIEW: "review",
    INVENTORY_CHECK: "verify-stock",
    PROCUREMENT_REQUEST: "request-vendors",
    PRICING_REVIEW: "complete-pricing",
    WAREHOUSE_PICK: "warehouse-ready",
    DISPATCH: "dispatch",
    DELIVERY_CONFIRM: "deliver-oms",
    INVOICE_GENERATE: "invoice",
    PAYMENT_COLLECTION: "collect-payment",
    ORDER_CLOSE: "close",
  };
  if (map[taskType]) return map[taskType];
  // Custom types like SALESREVIEW still map to built-in actions when letters match
  const compact = taskType.replace(/_/g, "").toUpperCase();
  const alias = Object.keys(map).find((k) => k.replace(/_/g, "") === compact);
  if (alias) return map[alias];
  return taskType.toLowerCase();
}

export async function getPublishedDefinition(
  tenantId: string,
  templateCode = "SO_STANDARD"
): Promise<{ id: string; definition: WorkflowDefinition } | null> {
  const row = await prisma.workflowTemplateVersion.findFirst({
    where: { tenantId, templateCode, lifecycle: "PUBLISHED" },
    orderBy: { version: "desc" },
  });
  if (!row) return null;
  let definition = row.definition as unknown as WorkflowDefinition;
  return { id: row.id, definition };
}

/**
 * Start a v5 workflow for a sales order from the latest published template snapshot.
 * Pins workflow definition + all referenced FORM assets (concrete versions only).
 */
export async function startSalesOrderWorkflowV5(input: {
  tenantId: string;
  salesOrderId: string;
  workflowId: string;
  orderStatus: string;
}) {
  return withSpan(
    "Workflow.Start",
    () => startSalesOrderWorkflowV5Inner(input),
    { orderId: input.salesOrderId, tenantId: input.tenantId }
  );
}

async function startSalesOrderWorkflowV5Inner(input: {
  tenantId: string;
  salesOrderId: string;
  workflowId: string;
  orderStatus: string;
}) {
  bootstrapSalesWorkflowPlatform();
  const published = await getPublishedDefinition(input.tenantId);
  if (!published) return null;

  const formResolution = await resolveAndValidateWorkflowForms(
    input.tenantId,
    structuredClone(published.definition)
  );
  const baseDef = formResolution.ok ? formResolution.normalized : structuredClone(published.definition);

  const pinnedAssets: NonNullable<WorkflowRuntimeSnapshot["pinnedAssets"]> = {};
  for (const [, entry] of formResolution.resolved) {
    pinnedAssets[assetKey(entry.ref)] = { ref: entry.ref, body: entry.definition };
  }
  // Also pin from embedded forms[] when resolution skipped an activity
  for (const a of baseDef.activities) {
    if (a.kind !== "HUMAN" || !a.assetRef) continue;
    const k = assetKey(a.assetRef);
    if (pinnedAssets[k]) continue;
    const embedded = (baseDef.forms ?? []).find(
      (f) => (f.id ?? f.key) === a.assetRef!.id || f.key === a.formKey
    );
    if (embedded) {
      pinnedAssets[k] = { ref: a.assetRef, body: embedded };
    }
  }

  const snapshot: WorkflowRuntimeSnapshot = {
    ...baseDef,
    pinnedAssets,
  };

  const existing = await prisma.workflowInstance.findFirst({
    where: { salesOrderId: input.salesOrderId },
  });
  if (existing?.snapshot) {
    return existing; // already on v5
  }

  const instance = existing
    ? await prisma.workflowInstance.update({
        where: { id: existing.id },
        data: {
          entityType: "SALES_ORDER",
          entityId: input.salesOrderId,
          templateCode: snapshot.template,
          templateVersion: snapshot.version,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          variables: (snapshot.variableDefaults ?? {}) as Prisma.InputJsonValue,
          instanceStatus: "RUNNING",
          currentStatus: input.orderStatus,
        },
      })
    : await prisma.workflowInstance.create({
        data: {
          tenantId: input.tenantId,
          salesOrderId: input.salesOrderId,
          workflowId: input.workflowId,
          currentStatus: input.orderStatus,
          entityType: "SALES_ORDER",
          entityId: input.salesOrderId,
          templateCode: snapshot.template,
          templateVersion: snapshot.version,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          variables: (snapshot.variableDefaults ?? {}) as Prisma.InputJsonValue,
          instanceStatus: "RUNNING",
        },
      });

  // Create all task instances WAITING; then evaluate → READY
  for (const a of snapshot.activities) {
    const exists = await prisma.workflowTask.findFirst({
      where: { workflowInstanceId: instance.id, stepKey: a.key },
    });
    if (exists) continue;
    await prisma.workflowTask.create({
      data: {
        tenantId: input.tenantId,
        workflowInstanceId: instance.id,
        salesOrderId: input.salesOrderId,
        stepKey: a.key,
        action: actionForType(a.type),
        title: a.label ?? a.key,
        assignedRole: roleForActivity(a),
        status: "WAITING",
        taskType: a.type,
        kind: a.kind,
        optional: Boolean(a.optional),
        required: !a.optional,
        dependsOn: snapshot.edges.filter((e) => e.to === a.key).map((e) => e.from),
        phase: "FULFILL",
      },
    });
  }

  await syncTaskReadiness(instance.id);
  await defaultEventBus.publish(
    createEvent({
      type: "WORKFLOW_STARTED",
      tenantId: input.tenantId,
      instanceId: instance.id,
      entityType: "SALES_ORDER",
      entityId: input.salesOrderId,
    })
  );
  recordEvent("SnapshotCreated", {
    workflowInstanceId: instance.id,
    orderId: input.salesOrderId,
  });
  recordEvent("WorkflowStarted", {
    workflowInstanceId: instance.id,
    orderId: input.salesOrderId,
  });
  return prisma.workflowInstance.findFirst({
    where: { id: instance.id },
    include: { tasks: true },
  });
}

export async function syncTaskReadiness(instanceId: string) {
  const instance = await prisma.workflowInstance.findFirst({
    where: { id: instanceId },
    include: { tasks: true },
  });
  if (!instance?.snapshot) return;

  const def = instance.snapshot as unknown as WorkflowDefinition;
  const variables = (instance.variables ?? {}) as Record<string, unknown>;
  const terminal: Record<string, TerminalStatus> = {};
  for (const t of instance.tasks) {
    if (["COMPLETED", "SKIPPED", "CANCELLED"].includes(t.status)) {
      terminal[t.stepKey] = t.status as TerminalStatus;
    }
  }

  const result = evaluateReadiness(def, terminal, variables, defaultConditionRegistry);

  for (const key of result.skippedKeys) {
    const task = instance.tasks.find((t) => t.stepKey === key);
    if (task && !["COMPLETED", "SKIPPED", "CANCELLED"].includes(task.status)) {
      await prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: "SKIPPED", completedAt: new Date() },
      });
      terminal[key] = "SKIPPED";
    }
  }

  // Re-eval after skips
  const result2 = evaluateReadiness(def, terminal, variables, defaultConditionRegistry);

  for (const t of instance.tasks) {
    if (["COMPLETED", "SKIPPED", "CANCELLED", "DEAD_LETTER", "CLAIMED", "IN_PROGRESS"].includes(t.status)) {
      continue;
    }
    if (result2.readyKeys.includes(t.stepKey)) {
      if (t.status !== "READY") {
        await prisma.workflowTask.update({
          where: { id: t.id },
          data: { status: "READY" },
        });
        await defaultEventBus.publish(
          createEvent({
            type: "TASK_READY",
            tenantId: instance.tenantId,
            instanceId: instance.id,
            entityType: instance.entityType,
            entityId: instance.entityId ?? instance.salesOrderId,
            taskId: t.id,
            activityKey: t.stepKey,
            taskType: t.taskType ?? undefined,
          })
        );
      }
    } else if (result2.waitingKeys.includes(t.stepKey) && t.status !== "WAITING") {
      await prisma.workflowTask.update({
        where: { id: t.id },
        data: { status: "WAITING" },
      });
    }
  }

  // Auto-complete SYSTEM autoComplete READY tasks
  const refreshed = await prisma.workflowTask.findMany({ where: { workflowInstanceId: instanceId } });
  for (const t of refreshed) {
    if (t.status !== "READY" || t.kind !== "SYSTEM") continue;
    const act = def.activities.find((a) => a.key === t.stepKey);
    if (!act?.autoComplete) continue;
    await completePlatformTask({
      taskId: t.id,
      actorUserId: "system",
      actorRole: "SYSTEM",
      payload: {},
    });
  }
}

export async function claimPlatformTask(input: {
  taskId: string;
  actorUserId: string;
  actorRole?: string | null;
}) {
  const task = await prisma.workflowTask.findFirst({ where: { id: input.taskId } });
  if (!task) throw new Error("Task not found");
  if (!["READY", "CLAIMED"].includes(task.status)) {
    throw new Error(`Task is ${task.status}, cannot claim`);
  }
  if (task.status === "CLAIMED" && task.assignedUserId && task.assignedUserId !== input.actorUserId) {
    if (task.leaseExpiresAt && task.leaseExpiresAt.getTime() > Date.now()) {
      throw new Error("Task claimed by another user");
    }
  }

  const updated = await prisma.workflowTask.update({
    where: { id: task.id },
    data: {
      status: "CLAIMED",
      assignedUserId: input.actorUserId,
      claimedAt: new Date(),
      leaseExpiresAt: new Date(Date.now() + LEASE_MS),
      rowVersion: { increment: 1 },
    },
  });

  const instance = await prisma.workflowInstance.findFirst({ where: { id: task.workflowInstanceId } });
  if (instance) {
    await defaultEventBus.publish(
      createEvent({
        type: "TASK_CLAIMED",
        tenantId: task.tenantId,
        instanceId: instance.id,
        entityType: instance.entityType,
        entityId: instance.entityId ?? instance.salesOrderId,
        taskId: task.id,
        actorUserId: input.actorUserId,
        activityKey: task.stepKey,
        taskType: task.taskType ?? undefined,
      })
    );
  }
  return updated;
}

export async function renewPlatformTaskLease(input: { taskId: string; actorUserId: string }) {
  const task = await prisma.workflowTask.findFirst({ where: { id: input.taskId } });
  if (!task) throw new Error("Task not found");
  if (task.status !== "CLAIMED" || task.assignedUserId !== input.actorUserId) {
    throw new Error("Only the claim holder can renew the lease");
  }
  return prisma.workflowTask.update({
    where: { id: task.id },
    data: { leaseExpiresAt: new Date(Date.now() + LEASE_MS), rowVersion: { increment: 1 } },
  });
}

export async function releasePlatformTask(input: { taskId: string; actorUserId: string }) {
  const task = await prisma.workflowTask.findFirst({ where: { id: input.taskId } });
  if (!task) throw new Error("Task not found");
  if (task.assignedUserId && task.assignedUserId !== input.actorUserId) {
    throw new Error("Only the claim holder can release");
  }
  return prisma.workflowTask.update({
    where: { id: task.id },
    data: {
      status: "READY",
      assignedUserId: null,
      claimedAt: null,
      leaseExpiresAt: null,
      rowVersion: { increment: 1 },
    },
  });
}

export async function completePlatformTask(input: {
  taskId: string;
  actorUserId: string;
  actorRole?: string | null;
  payload?: unknown;
}) {
  return withSpan(
    "Workflow.CompleteTask",
    () => completePlatformTaskInner(input),
    { taskId: input.taskId }
  );
}

async function completePlatformTaskInner(input: {
  taskId: string;
  actorUserId: string;
  actorRole?: string | null;
  payload?: unknown;
}) {
  bootstrapSalesWorkflowPlatform();
  const task = await prisma.workflowTask.findFirst({ where: { id: input.taskId } });
  if (!task) throw new Error("Task not found");
  if (!["READY", "CLAIMED", "IN_PROGRESS"].includes(task.status) && task.kind !== "SYSTEM") {
    throw new Error(`Task is ${task.status}, cannot complete`);
  }

  const instance = await prisma.workflowInstance.findFirst({
    where: { id: task.workflowInstanceId },
  });
  if (!instance?.snapshot) throw new Error("Workflow instance missing snapshot");

  const def = instance.snapshot as unknown as WorkflowDefinition;
  const activity = def.activities.find((a) => a.key === task.stepKey);
  const adapter = defaultAdapterRegistry.get(instance.entityType);
  if (!adapter) throw new Error(`No adapter for ${instance.entityType}`);

  const variables = (instance.variables ?? {}) as Record<string, unknown>;
  const ctx = {
    tenantId: instance.tenantId,
    instance: {
      id: instance.id,
      tenantId: instance.tenantId,
      template: instance.templateCode ?? def.template,
      templateVersion: instance.templateVersion ?? def.version,
      entityType: instance.entityType,
      entityId: instance.entityId ?? instance.salesOrderId,
      status: "RUNNING" as const,
      snapshot: def,
      variables,
      createdAt: instance.createdAt.toISOString(),
    },
    task: {
      id: task.id,
      workflowInstanceId: instance.id,
      tenantId: task.tenantId,
      activityKey: task.stepKey,
      taskType: task.taskType ?? activity?.type ?? "",
      kind: (task.kind as "HUMAN" | "SYSTEM") ?? "HUMAN",
      status: task.status as "READY",
      optional: task.optional,
      attempt: task.attempt,
      rowVersion: task.rowVersion,
    },
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    variables,
  };

  const validation = await adapter.validateTask(ctx.task, input.payload, ctx);
  if (!validation.ok) {
    throw new Error(validation.errors?.join("; ") ?? "Validation failed");
  }

  const result = await adapter.execute(ctx.task, input.payload, ctx);
  const nextVars = mergeVariables(variables, result.variablesPatch);
  const projection = await adapter.project(ctx.task, { ...ctx, variables: nextVars });
  const statusHint = result.projectionStatus ?? projection.status ?? activity?.projectionStatus;

  await prisma.workflowTask.update({
    where: { id: task.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedBy: input.actorUserId,
      payload: (result.payload ?? input.payload ?? {}) as Prisma.InputJsonValue,
      rowVersion: { increment: 1 },
    },
  });

  await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: {
      variables: nextVars as Prisma.InputJsonValue,
      currentStepKey: task.stepKey,
      ...(statusHint ? { currentStatus: statusHint } : {}),
    },
  });

  if (statusHint && instance.salesOrderId) {
    await prisma.salesOrder.update({
      where: { id: instance.salesOrderId },
      data: { status: statusHint },
    });
  }

  await defaultEventBus.publish(
    createEvent({
      type: "TASK_COMPLETED",
      tenantId: instance.tenantId,
      instanceId: instance.id,
      entityType: instance.entityType,
      entityId: instance.entityId ?? instance.salesOrderId,
      taskId: task.id,
      actorUserId: input.actorUserId,
      activityKey: task.stepKey,
      taskType: task.taskType ?? undefined,
      payload: { projectionStatus: statusHint },
    })
  );
  recordEvent("TaskCompleted", {
    taskId: task.id,
    orderId: instance.salesOrderId ?? undefined,
    activityKey: task.stepKey,
  });

  await syncTaskReadiness(instance.id);

  // Mark workflow complete if all terminal
  const left = await prisma.workflowTask.count({
    where: {
      workflowInstanceId: instance.id,
      status: { notIn: ["COMPLETED", "SKIPPED", "CANCELLED"] },
    },
  });
  if (left === 0) {
    await prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { instanceStatus: "COMPLETED", completedAt: new Date() },
    });
    await defaultEventBus.publish(
      createEvent({
        type: "WORKFLOW_COMPLETED",
        tenantId: instance.tenantId,
        instanceId: instance.id,
        entityType: instance.entityType,
        entityId: instance.entityId ?? instance.salesOrderId,
      })
    );
    recordEvent("WorkflowCompleted", {
      workflowInstanceId: instance.id,
      orderId: instance.salesOrderId ?? undefined,
    });
  }

  return prisma.workflowTask.findFirst({ where: { id: task.id } });
}

/** Expire stale leases back to READY */
export async function expireStaleLeases(tenantId: string) {
  const now = new Date();
  await prisma.workflowTask.updateMany({
    where: {
      tenantId,
      status: "CLAIMED",
      leaseExpiresAt: { lt: now },
    },
    data: {
      status: "READY",
      assignedUserId: null,
      claimedAt: null,
      leaseExpiresAt: null,
    },
  });
}

/**
 * WorkflowEvent persistence — audit log foundation (not an integration event bus).
 * Feeds timeline / notifications / analytics later.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { createLogger } from "@erp/logger";

const log = createLogger({ service: "sales" });

export type WorkflowAuditType =
  | "WORKFLOW_STARTED"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_CANCELLED"
  | "TASK_CREATED"
  | "TASK_READY"
  | "TASK_CLAIMED"
  | "TASK_RELEASED"
  | "TASK_COMPLETED"
  | "TASK_SKIPPED"
  | "STATUS_SYNC"
  | "TRANSITION";

export async function writeWorkflowAudit(input: {
  tenantId: string;
  workflowInstanceId: string;
  salesOrderId: string;
  type: WorkflowAuditType;
  stepKey?: string | null;
  action?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  remarks?: string | null;
  payload?: unknown;
}): Promise<void> {
  try {
    await prisma.workflowEvent.create({
      data: {
        tenantId: input.tenantId,
        workflowInstanceId: input.workflowInstanceId,
        salesOrderId: input.salesOrderId,
        type: input.type,
        stepKey: input.stepKey ?? undefined,
        action: input.action ?? undefined,
        fromStatus: input.fromStatus ?? undefined,
        toStatus: input.toStatus ?? undefined,
        actorUserId: input.actorUserId ?? undefined,
        actorRole: input.actorRole ?? undefined,
        remarks: input.remarks ?? undefined,
        payload:
          input.payload === undefined
            ? undefined
            : (input.payload as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    log.error("workflow_audit_write_failed", {
      type: input.type,
      instanceId: input.workflowInstanceId,
      err,
    });
  }
}

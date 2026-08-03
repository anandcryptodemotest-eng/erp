import { NextResponse } from "next/server";
import { createLogger, contextFromHeaders, runWithRequestContextAsync } from "@erp/logger";
import {
  claimPlatformTask,
  completePlatformTask,
  releasePlatformTask,
  renewPlatformTaskLease,
  expireStaleLeases,
} from "@/lib/workflow-runtime-v5";
import { WorkflowAuthError } from "@/lib/workflow-task-auth";
import { recordEvent, withSpan } from "@erp/telemetry";

type Ctx = { params: Promise<{ id: string }> };
const log = createLogger({ service: "sales" });

/** POST /api/workflow-tasks/:id?action=claim|renew|release|complete */
export async function POST(request: Request, { params }: Ctx) {
  const reqCtx = contextFromHeaders(request.headers, {
    service: "sales",
    method: "POST",
    path: "/api/workflow-tasks/[id]",
  });

  return runWithRequestContextAsync(reqCtx, async () => {
    const tenantId = request.headers.get("x-tenant-id");
    const userId = request.headers.get("x-user-id");
    const role = request.headers.get("x-user-role");
    if (!tenantId || !userId) {
      return NextResponse.json({ error: "Auth context required" }, { status: 400 });
    }

    const { id } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "complete";
    const body = await request.json().catch(() => ({}));

    try {
      await expireStaleLeases(tenantId);

      if (action === "claim") {
        const data = await withSpan("Workflow.ClaimTask", () =>
          claimPlatformTask({ taskId: id, actorUserId: userId, actorRole: role })
        );
        recordEvent("TaskClaimed", { taskId: id, tenantId });
        log.info("task_claimed", { taskId: id, tenantId, userId });
        return NextResponse.json({ data });
      }
      if (action === "renew") {
        const data = await renewPlatformTaskLease({
          taskId: id,
          actorUserId: userId,
          actorRole: role,
        });
        return NextResponse.json({ data });
      }
      if (action === "release") {
        const data = await releasePlatformTask({
          taskId: id,
          actorUserId: userId,
          actorRole: role,
        });
        log.info("task_released", { taskId: id, tenantId, userId });
        return NextResponse.json({ data });
      }
      if (action === "complete") {
        const data = await completePlatformTask({
          taskId: id,
          actorUserId: userId,
          actorRole: role,
          payload: body,
        });
        let orderStatus: string | undefined;
        if (data?.salesOrderId) {
          const { prisma } = await import("@/lib/prisma");
          const order = await prisma.salesOrder.findFirst({
            where: { id: data.salesOrderId },
            select: { status: true },
          });
          orderStatus = order?.status;
        }
        log.info("task_completed", {
          taskId: id,
          tenantId,
          userId,
          role,
          orderId: data?.salesOrderId,
          status: orderStatus,
        });
        return NextResponse.json({ data: { ...data, status: orderStatus } });
      }
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Task action failed";
      const status = e instanceof WorkflowAuthError ? e.status : 409;
      log.error("task_action_failed", { taskId: id, action, tenantId, userId, err: e });
      return NextResponse.json({ error: msg }, { status });
    }
  });
}

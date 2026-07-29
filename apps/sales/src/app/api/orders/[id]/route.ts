import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";
import {
  assertWorkflowAction,
  resolveOrderWorkflow,
} from "@/lib/order-workflow";
import { assertTaskPermission } from "@/lib/workflow-workbench";
import { resolveStepUiFromSnapshot } from "@/lib/form-ui";
import { notifyPortalCustomer } from "@/lib/notify-customer";
import {
  completeTaskByAction,
  getInstanceSnapshotFlag,
  taskTypeForAction,
} from "@/lib/complete-task-command";
import { startSalesOrderWorkflowV5, getPublishedDefinition, syncTaskReadiness } from "@/lib/workflow-runtime-v5";
import { withSpan } from "@erp/telemetry";
import { createLogger } from "@erp/logger";
import { z } from "zod";

const log = createLogger({ service: "sales" });

const shipItemsSchema = z.object({
  items: z.array(z.object({
    orderItemId: z.string(),
    shippedQty: z.number().int().positive(),
  })).min(1),
  warehouseId: z.string(),
  notes: z.string().optional(),
});

const confirmSchema = z.object({
  warehouseId: z.string(),
});

const documentSchema = z.object({
  type: z.enum(["ACKNOWLEDGEMENT", "DELIVERY_PROOF", "INVOICE", "OTHER"]),
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  mimeType: z.string().optional(),
});

async function logModification(
  tenantId: string,
  salesOrderId: string,
  userId: string,
  action: string,
  opts: { field?: string; oldValue?: string; newValue?: string; remarks?: string } = {}
) {
  await prisma.orderModification.create({
    data: {
      tenantId,
      salesOrderId,
      userId,
      action,
      field: opts.field,
      oldValue: opts.oldValue,
      newValue: opts.newValue,
      remarks: opts.remarks,
    },
  });
}

// GET /api/orders/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      quote: { select: { id: true, quoteNumber: true } },
      salesRequest: {
        select: { id: true, requestNumber: true, status: true, createdAt: true },
      },
      items: true,
      returns: { select: { id: true, returnNumber: true, status: true, total: true } },
      modifications: { orderBy: { createdAt: "desc" }, take: 50 },
      documents: { orderBy: { createdAt: "desc" } },
      workflowTasks: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      workflowEvents: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (role === "CUSTOMER" && userId) {
    if (order.customer.portalUserId !== userId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
  }

  const workflow = await resolveOrderWorkflow(tenantId, order.workflowId);
  const existingInstance = await prisma.workflowInstance.findFirst({
    where: { salesOrderId: order.id, tenantId },
    select: { id: true, snapshot: true },
  });

  if (!existingInstance?.snapshot) {
    return NextResponse.json(
      {
        error:
          "Order has no workflow snapshot. Cancel and recreate, or run scripts/reset-workflow-v5.ts.",
        runtimePath: "missing",
      },
      { status: 409 }
    );
  }

  await syncTaskReadiness(existingInstance.id);
  const runtime = await prisma.workflowInstance.findFirst({
    where: { id: existingInstance.id },
    include: {
      tasks: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      workflow: { include: { steps: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  const nextActions = (runtime?.tasks ?? [])
    .filter((t) => ["READY", "CLAIMED", "IN_PROGRESS"].includes(t.status) && t.kind !== "SYSTEM")
    .map((t) => {
      const fromSnapshot = resolveStepUiFromSnapshot(runtime?.snapshot ?? null, t.stepKey);
      return {
        action: t.action,
        label: t.title,
        roleHint: t.assignedRole,
        stepKey: t.stepKey,
        sortOrder: 0,
        uiPanel: "none" as const,
        taskId: t.id,
        ...(fromSnapshot ? { ui: fromSnapshot } : {}),
      };
    });

  return NextResponse.json({
    data: {
      ...order,
      workflow: workflow
        ? {
            id: workflow.id,
            code: workflow.code,
            name: workflow.name,
            templateId: workflow.templateId,
          }
        : null,
      nextActions: role === "CUSTOMER" ? [] : nextActions,
      workflowRuntime: runtime,
      prepTasks: (order.workflowTasks ?? []).filter(
        (t) => !["COMPLETED", "CANCELLED", "SKIPPED"].includes(t.status)
      ),
      runtimePath: "v5",
    },
  });
}

// PATCH /api/orders/:id?action=...
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) return NextResponse.json({ error: "Auth context required" }, { status: 400 });

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    include: { items: true, customer: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!action) {
    return NextResponse.json({ error: "Query param action is required" }, { status: 400 });
  }

  if (role === "CUSTOMER") {
    return NextResponse.json(
      {
        error:
          "Customers manage Sales Requests (cancel via /api/sales-requests/:id?action=cancel). Sales Orders are staff-managed after convert.",
      },
      { status: 403 }
    );
  }

  const workflow = await resolveOrderWorkflow(tenantId, order.workflowId);
  const { hasSnapshot } = await getInstanceSnapshotFlag(tenantId, id);

  // Platform task completion — Adapter handlers own domain mutations
  if (taskTypeForAction(action)) {
    if (!hasSnapshot) {
      return NextResponse.json(
        { error: "Order missing workflow snapshot — recreate the sales order" },
        { status: 409 }
      );
    }

    if (role !== "CUSTOMER") {
      const permission = await assertTaskPermission({
        tenantId,
        orderId: id,
        action,
        role,
        userId,
      });
      if (!permission.ok) {
        return NextResponse.json({ error: permission.error }, { status: 403 });
      }
    }
    try {
      const body = await request.json().catch(() => ({}));
      await completeTaskByAction({
        tenantId,
        salesOrderId: id,
        action,
        actorUserId: userId,
        actorRole: role,
        payload: body,
      });
      const updated = await prisma.salesOrder.findFirst({
        where: { id, tenantId },
        include: {
          items: true,
          customer: { select: { id: true, name: true } },
          salesRequest: true,
          workflowTasks: true,
        },
      });
      await logModification(tenantId, id, userId, `TASK_${action.toUpperCase()}`, {
        remarks: typeof body === "object" && body && "remarks" in body
          ? String((body as { remarks?: string }).remarks ?? "")
          : undefined,
        oldValue: order.status,
        newValue: updated?.status,
      });
      return NextResponse.json({ data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
      }
      const message = error instanceof Error ? error.message : "Task complete failed";
      return NextResponse.json({ error: message }, { status: 409 });
    }
  }

  const gate = assertWorkflowAction(workflow, action, order.status);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  if (role !== "CUSTOMER") {
    const permission = await assertTaskPermission({
      tenantId,
      orderId: id,
      action,
      role,
      userId,
    });
    if (!permission.ok) {
      return NextResponse.json({ error: permission.error }, { status: 403 });
    }
  }

  try {
    if (action === "confirm") {
      if (order.status !== "DRAFT") {
        return NextResponse.json({ error: "Only DRAFT orders can be confirmed" }, { status: 409 });
      }
      if (role !== "ADMIN" && role !== "MANAGER") {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }

      const body = await request.json();
      const { warehouseId } = confirmSchema.parse(body);

      // Credit limit check: customer's credit limit vs order total
      if (order.customer.creditLimit > 0) {
        // Sum outstanding orders (CONFIRMED or PARTIALLY_SHIPPED) for this customer
        const outstanding = await prisma.salesOrder.aggregate({
          where: {
            tenantId,
            customerId: order.customerId,
            status: { in: ["CONFIRMED", "PARTIALLY_SHIPPED"] },
            id: { not: id },
          },
          _sum: { total: true },
        });
        const outstandingAmount = outstanding._sum.total ?? 0;
        if (outstandingAmount + order.total > order.customer.creditLimit) {
          return NextResponse.json(
            { error: `Credit limit exceeded: outstanding ${outstandingAmount}, order ${order.total}, limit ${order.customer.creditLimit}` },
            { status: 409 }
          );
        }
      }

      // Reserve stock in inventory service
      const reservePayload = {
        items: order.items.map((item) => ({
          productId: item.productId,
          warehouseId,
          variantId: item.variantId ?? undefined,
          quantity: item.quantity,
        })),
        reference: order.id,
      };

      const reserveResult = await withSpan("SalesOrder.Confirm", () =>
        serviceClient.call("inventory", "/api/stock/reserve", {
          method: "POST",
          body: reservePayload,
          tenantId,
          userId,
        })
      );

      if (reserveResult.status !== 201) {
        const errBody = reserveResult.data as { error?: string } | undefined;
        return NextResponse.json(
          { error: errBody?.error ?? "Stock reservation failed" },
          { status: 409 }
        );
      }

      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "CONFIRMED", warehouseId },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      const published = await getPublishedDefinition(tenantId);
      if (published && updated.workflowId) {
        await startSalesOrderWorkflowV5({
          tenantId,
          salesOrderId: id,
          workflowId: updated.workflowId,
          orderStatus: updated.status,
        });
      }
      return NextResponse.json({ data: updated });
    }

    if (action === "ship") {
      if (!["CONFIRMED", "PARTIALLY_SHIPPED"].includes(order.status)) {
        return NextResponse.json({ error: "Order must be CONFIRMED or PARTIALLY_SHIPPED to ship" }, { status: 409 });
      }

      const body = await request.json();
      const { items: shipItems, warehouseId, notes } = shipItemsSchema.parse(body);

      // Validate shipped quantities
      for (const shipItem of shipItems) {
        const orderItem = order.items.find((i) => i.id === shipItem.orderItemId);
        if (!orderItem) {
          return NextResponse.json({ error: `Order item ${shipItem.orderItemId} not found` }, { status: 400 });
        }
        const remaining = orderItem.quantity - orderItem.shippedQty;
        if (shipItem.shippedQty > remaining) {
          return NextResponse.json(
            { error: `Cannot ship ${shipItem.shippedQty} for item ${orderItem.productName}: only ${remaining} remaining` },
            { status: 409 }
          );
        }
      }

      // Deduct stock in inventory service
      const deductPayload = {
        items: shipItems.map((si) => {
          const orderItem = order.items.find((i) => i.id === si.orderItemId)!;
          return {
            productId: orderItem.productId,
            warehouseId,
            variantId: orderItem.variantId ?? undefined,
            quantity: si.shippedQty,
          };
        }),
        reference: order.id,
        notes,
      };

      const deductResult = await serviceClient.call("inventory", "/api/stock/deduct", {
        method: "POST",
        body: deductPayload,
        tenantId,
        userId,
      });

      if (deductResult.status !== 201) {
        const errBody = deductResult.data as { error?: string } | undefined;
        return NextResponse.json({ error: errBody?.error ?? "Stock deduction failed" }, { status: 409 });
      }

      // Update shipped quantities on items
      const updated = await prisma.$transaction(async (tx) => {
        for (const si of shipItems) {
          await tx.salesOrderItem.update({
            where: { id: si.orderItemId },
            data: { shippedQty: { increment: si.shippedQty } },
          });
        }
        // Refresh to check if fully shipped
        const refreshed = await tx.salesOrder.findUnique({ where: { id }, include: { items: true } });
        const allShipped = refreshed!.items.every((i) => i.shippedQty >= i.quantity);
        return tx.salesOrder.update({
          where: { id },
          data: { status: allShipped ? "SHIPPED" : "PARTIALLY_SHIPPED" },
          include: { items: true, customer: { select: { id: true, name: true } } },
        });
      });


      return NextResponse.json({ data: updated });
    }

    if (action === "cancel") {
      const cancellable = [
        "DRAFT",
        "CONFIRMED",
        "FULFILLING",
        "READY_FOR_DISPATCH",
        "PARTIALLY_SHIPPED",
        // Legacy trading mid-statuses (pre SREQ→SO) — allow cleanup
        "PENDING_SALES_REVIEW",
        "SUBMITTED",
        "REVIEWED",
        "STOCK_VERIFIED",
        "VENDOR_REQUESTED",
        "PRICING_PENDING",
        "PRICING_COMPLETED",
      ];
      if (!cancellable.includes(order.status)) {
        return NextResponse.json({ error: `Cannot cancel order in ${order.status} status` }, { status: 409 });
      }

      // Release stock reservations if order was activated/confirmed (grocery)
      if (["CONFIRMED", "FULFILLING", "READY_FOR_DISPATCH", "PARTIALLY_SHIPPED"].includes(order.status)) {
        await serviceClient.call("inventory", "/api/stock/release", {
          method: "POST",
          body: { reference: order.id },
          tenantId,
          userId,
        });
      }

      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: {
          items: true,
          customer: { select: { id: true, name: true } },
          salesRequest: true,
        },
      });

      // Cancelling the SO also cancels the linked Sales Request
      await prisma.salesRequest.updateMany({
        where: {
          tenantId,
          salesOrderId: id,
          status: { in: ["OPEN", "CONVERTED"] },
        },
        data: {
          status: "CANCELLED",
          rejectReason: `Sales Order ${order.orderNumber} cancelled`,
        },
      });

      await logModification(tenantId, id, userId, "STATUS_CHANGE", {
        field: "status",
        oldValue: order.status,
        newValue: "CANCELLED",
      });

      await prisma.workflowTask.updateMany({
        where: {
          salesOrderId: id,
          status: { notIn: ["COMPLETED", "CANCELLED", "SKIPPED"] },
        },
        data: { status: "CANCELLED" },
      });
      await prisma.workflowInstance.updateMany({
        where: { salesOrderId: id, tenantId },
        data: { instanceStatus: "CANCELLED", currentStatus: "CANCELLED" },
      });

      await notifyPortalCustomer({
        tenantId,
        portalUserId: order.customer.portalUserId,
        type: "ORDER_CANCELLED",
        title: "Order cancelled",
        body: `${order.orderNumber} was cancelled.`,
        metadata: { orderId: id, orderNumber: order.orderNumber },
      });
      return NextResponse.json({ data: updated });
    }

    // ── Trading OMS: activate + parallel prep + fulfill + close ────────
    if (action === "activate") {
      if (order.status !== "DRAFT") {
        return NextResponse.json({ error: "Only DRAFT orders can be activated" }, { status: 409 });
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: { items: true, customer: { select: { id: true, name: true } }, salesRequest: true },
      });
      await logModification(tenantId, id, userId, "STATUS_CHANGE", {
        field: "status",
        oldValue: "DRAFT",
        newValue: "CONFIRMED",
      });
      if (updated.workflowId) {
        await startSalesOrderWorkflowV5({
          tenantId,
          salesOrderId: id,
          workflowId: updated.workflowId,
          orderStatus: updated.status,
        });
      }
      return NextResponse.json({ data: updated });
    }

    if (action === "upload-document") {
      const body = await request.json();
      const parsed = documentSchema.parse(body);
      const doc = await prisma.orderDocument.create({
        data: {
          tenantId,
          salesOrderId: id,
          type: parsed.type,
          fileName: parsed.fileName,
          fileUrl: parsed.fileUrl,
          mimeType: parsed.mimeType,
          uploadedBy: userId,
        },
      });
      return NextResponse.json({ data: doc }, { status: 201 });
    }


    return NextResponse.json(
      { error: `Unknown or migrated action: ${action}. Use POST /api/workflow-tasks/:id?action=complete for desk tasks.` },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error("orders_id_action_action_internal_error", { err: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

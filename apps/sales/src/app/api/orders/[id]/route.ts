import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";
import {
  assertWorkflowAction,
  nextActionsForStatus,
  resolveOrderWorkflow,
} from "@/lib/order-workflow";
import {
  assertTaskPermission,
  ensureWorkflowRuntimeForOrder,
  recordWorkflowTransition,
} from "@/lib/workflow-runtime";
import { z } from "zod";

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

const reviewSchema = z.object({
  remarks: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        remarks: z.string().optional(),
      })
    )
    .optional(),
});

const stockVerifySchema = z.object({
  items: z.array(
    z.object({
      orderItemId: z.string(),
      availableQty: z.number().nonnegative(),
    })
  ).min(1),
  remarks: z.string().optional(),
});

const pricingSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string(),
        purchasePrice: z.number().nonnegative().optional(),
        unitPrice: z.number().nonnegative().optional(),
        discount: z.number().nonnegative().optional(),
        taxRate: z.number().nonnegative().optional(),
      })
    )
    .optional(),
  discountAmount: z.number().nonnegative().optional(),
  transportationCharge: z.number().nonnegative().optional(),
  additionalCharges: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  remarks: z.string().optional(),
});

const dispatchSchema = z.object({
  assignedDriverId: z.string().optional(),
  vehicleInfo: z.string().optional(),
  trackingNumber: z.string().optional(),
  dispatchRemarks: z.string().optional(),
  dispatchedAt: z.string().datetime().optional(),
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
      items: true,
      returns: { select: { id: true, returnNumber: true, status: true, total: true } },
      modifications: { orderBy: { createdAt: "desc" }, take: 50 },
      documents: { orderBy: { createdAt: "desc" } },
      workflowTasks: { orderBy: [{ createdAt: "desc" }] },
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
  const runtime = await ensureWorkflowRuntimeForOrder({
    id: order.id,
    tenantId,
    status: order.status,
    workflowId: order.workflowId,
  });
  const nextActions = workflow ? nextActionsForStatus(workflow, order.status) : [];

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
      // Customers don't get internal action buttons
      nextActions: role === "CUSTOMER" ? [] : nextActions,
      workflowRuntime: runtime,
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
    if (action !== "cancel") {
      return NextResponse.json({ error: "Customers cannot advance internal OMS steps" }, { status: 403 });
    }
    if (order.customer.portalUserId !== userId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
  }

  const workflow = await resolveOrderWorkflow(tenantId, order.workflowId);
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

      const reserveResult = await serviceClient.call("inventory", "/api/stock/reserve", {
        method: "POST",
        body: reservePayload,
        tenantId,
        userId,
      });

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
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
          payload: { warehouseId },
        }
      );
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

      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
          remarks: notes,
        }
      );

      return NextResponse.json({ data: updated });
    }

    if (action === "cancel") {
      const cancellable = [
        "DRAFT",
        "SUBMITTED",
        "PENDING_SALES_REVIEW",
        "REVIEWED",
        "STOCK_VERIFIED",
        "VENDOR_REQUESTED",
        "PRICING_PENDING",
        "PRICING_COMPLETED",
        "READY_FOR_DISPATCH",
        "CONFIRMED",
        "PARTIALLY_SHIPPED",
      ];
      if (!cancellable.includes(order.status)) {
        return NextResponse.json({ error: `Cannot cancel order in ${order.status} status` }, { status: 409 });
      }

      // Release stock reservations if order was confirmed
      if (["CONFIRMED", "PARTIALLY_SHIPPED"].includes(order.status)) {
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
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await logModification(tenantId, id, userId, "STATUS_CHANGE", {
        field: "status",
        oldValue: order.status,
        newValue: "CANCELLED",
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
      return NextResponse.json({ data: updated });
    }

    // ── OMS lifecycle actions ──────────────────────────────────────────
    if (action === "submit") {
      if (order.status !== "DRAFT") {
        return NextResponse.json({ error: "Only DRAFT orders can be submitted" }, { status: 409 });
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "PENDING_SALES_REVIEW" },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await logModification(tenantId, id, userId, "STATUS_CHANGE", {
        field: "status",
        oldValue: "DRAFT",
        newValue: "PENDING_SALES_REVIEW",
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: "DRAFT",
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "review") {
      if (!["PENDING_SALES_REVIEW", "SUBMITTED", "DRAFT"].includes(order.status)) {
        return NextResponse.json({ error: "Order is not awaiting sales review" }, { status: 409 });
      }
      const body = await request.json().catch(() => ({}));
      const parsed = reviewSchema.parse(body);

      const updated = await prisma.$transaction(async (tx) => {
        if (parsed.items) {
          await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
          await tx.salesOrderItem.createMany({
            data: parsed.items.map((i) => ({
              salesOrderId: id,
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.quantity * i.unitPrice,
              remarks: i.remarks,
            })),
          });
          const subtotal = parsed.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
          return tx.salesOrder.update({
            where: { id },
            data: {
              status: "REVIEWED",
              salesRemarks: parsed.remarks ?? order.salesRemarks,
              deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : order.deliveryDate,
              subtotal,
              total: subtotal + order.tax + order.deliveryFee - order.couponDiscount,
            },
            include: { items: true, customer: { select: { id: true, name: true } } },
          });
        }
        return tx.salesOrder.update({
          where: { id },
          data: {
            status: "REVIEWED",
            salesRemarks: parsed.remarks ?? order.salesRemarks,
            deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : order.deliveryDate,
          },
          include: { items: true, customer: { select: { id: true, name: true } } },
        });
      });

      await logModification(tenantId, id, userId, "REVIEW_EDIT", {
        remarks: parsed.remarks,
        oldValue: order.status,
        newValue: "REVIEWED",
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
          remarks: parsed.remarks,
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "verify-stock") {
      if (!["REVIEWED", "STOCK_VERIFIED"].includes(order.status)) {
        return NextResponse.json({ error: "Order must be REVIEWED before stock verification" }, { status: 409 });
      }
      const body = await request.json();
      const parsed = stockVerifySchema.parse(body);

      let hasShortage = false;
      await prisma.$transaction(async (tx) => {
        for (const line of parsed.items) {
          const item = order.items.find((i) => i.id === line.orderItemId);
          if (!item) throw new Error(`Item ${line.orderItemId} not found`);
          const shortage = Math.max(0, item.quantity - line.availableQty);
          if (shortage > 0) hasShortage = true;
          await tx.salesOrderItem.update({
            where: { id: line.orderItemId },
            data: { availableQty: line.availableQty, shortageQty: shortage },
          });
        }
        await tx.salesOrder.update({
          where: { id },
          data: { status: hasShortage ? "VENDOR_REQUESTED" : "STOCK_VERIFIED" },
        });
      });

      const updated = await prisma.salesOrder.findFirst({
        where: { id },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });

      // Auto-create vendor RFQs for shortage lines
      const shortageItems = (updated?.items ?? []).filter((i) => (i.shortageQty ?? 0) > 0);
      let vendorRequests: unknown[] = [];
      if (shortageItems.length) {
        const rfq = await serviceClient.call("procurement", "/api/vendor-requests", {
          method: "POST",
          body: {
            salesOrderId: id,
            items: shortageItems.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.shortageQty,
            })),
            sendNow: true,
            channel: "WHATSAPP",
          },
          tenantId,
          userId,
        });
        vendorRequests = [rfq.data];
      } else {
        await prisma.salesOrder.update({
          where: { id },
          data: { status: "PRICING_PENDING" },
        });
      }

      await logModification(tenantId, id, userId, "STOCK_VERIFY", {
        remarks: parsed.remarks,
        newValue: hasShortage ? "VENDOR_REQUESTED" : "PRICING_PENDING",
      });

      const finalOrder = await prisma.salesOrder.findFirst({
        where: { id },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      if (finalOrder) {
        await recordWorkflowTransition(
          {
            id,
            tenantId,
            status: finalOrder.status,
            workflowId: finalOrder.workflowId,
          },
          {
            action,
            previousStatus: order.status,
            currentStatus: finalOrder.status,
            actorUserId: userId,
            actorRole: role,
            remarks: parsed.remarks,
            payload: { hasShortage, vendorRequestsCount: vendorRequests.length },
          }
        );
      }
      return NextResponse.json({ data: finalOrder, meta: { hasShortage, vendorRequests } });
    }

    if (action === "request-vendors") {
      if (!["STOCK_VERIFIED", "VENDOR_REQUESTED", "REVIEWED"].includes(order.status)) {
        return NextResponse.json({ error: "Invalid status for vendor request" }, { status: 409 });
      }
      const body = await request.json().catch(() => ({}));
      const shortageItems = order.items.filter((i) => (i.shortageQty ?? 0) > 0);
      const items =
        (body as { items?: { productId: string; productName: string; quantity: number }[] }).items ??
        shortageItems.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.shortageQty ?? i.quantity,
        }));
      if (!items.length) {
        return NextResponse.json({ error: "No shortage items to request" }, { status: 400 });
      }
      const rfq = await serviceClient.call("procurement", "/api/vendor-requests", {
        method: "POST",
        body: {
          salesOrderId: id,
          vendorId: (body as { vendorId?: string }).vendorId,
          items,
          sendNow: true,
        },
        tenantId,
        userId,
      });
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "VENDOR_REQUESTED" },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await logModification(tenantId, id, userId, "STATUS_CHANGE", {
        field: "status",
        newValue: "VENDOR_REQUESTED",
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
          payload: { vendorRequest: rfq.data },
        }
      );
      return NextResponse.json({ data: updated, meta: { vendorRequest: rfq.data } });
    }

    if (action === "start-pricing") {
      if (!["STOCK_VERIFIED", "VENDOR_REQUESTED", "REVIEWED"].includes(order.status)) {
        return NextResponse.json({ error: "Order not ready for pricing" }, { status: 409 });
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "PRICING_PENDING" },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await logModification(tenantId, id, userId, "STATUS_CHANGE", {
        oldValue: order.status,
        newValue: "PRICING_PENDING",
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "complete-pricing") {
      if (!["PRICING_PENDING", "PRICING_COMPLETED"].includes(order.status)) {
        return NextResponse.json({ error: "Order is not in pricing stage" }, { status: 409 });
      }
      const body = await request.json();
      const parsed = pricingSchema.parse(body);

      if (parsed.items) {
        for (const line of parsed.items) {
          const item = order.items.find((i) => i.id === line.orderItemId);
          if (!item) continue;
          const unitPrice = line.unitPrice ?? item.unitPrice;
          const discount = line.discount ?? item.discount;
          await prisma.salesOrderItem.update({
            where: { id: line.orderItemId },
            data: {
              purchasePrice: line.purchasePrice,
              unitPrice,
              discount,
              taxRate: line.taxRate ?? item.taxRate,
              total: item.quantity * unitPrice - discount,
            },
          });
        }
      }

      const fresh = await prisma.salesOrder.findFirst({ where: { id }, include: { items: true } });
      const purchaseSubtotal = fresh!.items.reduce((s, i) => s + (i.purchasePrice ?? 0) * i.quantity, 0);
      const subtotal = fresh!.items.reduce((s, i) => s + i.total, 0);
      const discountAmount = parsed.discountAmount ?? order.discountAmount;
      const transportationCharge = parsed.transportationCharge ?? order.transportationCharge;
      const additionalCharges = parsed.additionalCharges ?? order.additionalCharges;
      const tax = parsed.tax ?? order.tax;
      const total = subtotal - discountAmount + tax + transportationCharge + additionalCharges + order.deliveryFee;
      const marginAmount = subtotal - purchaseSubtotal - discountAmount;
      const marginPercent = purchaseSubtotal > 0 ? (marginAmount / purchaseSubtotal) * 100 : 0;

      const updated = await prisma.salesOrder.update({
        where: { id },
        data: {
          status: "PRICING_COMPLETED",
          purchaseSubtotal,
          subtotal,
          discountAmount,
          transportationCharge,
          additionalCharges,
          tax,
          total,
          marginAmount,
          marginPercent,
        },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await logModification(tenantId, id, userId, "PRICING", { remarks: parsed.remarks });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
          remarks: parsed.remarks,
          payload: {
            marginAmount,
            marginPercent,
            total,
          },
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "ready-dispatch") {
      if (order.status !== "PRICING_COMPLETED") {
        return NextResponse.json({ error: "Pricing must be completed first" }, { status: 409 });
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "READY_FOR_DISPATCH" },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await logModification(tenantId, id, userId, "STATUS_CHANGE", { newValue: "READY_FOR_DISPATCH" });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "dispatch") {
      if (!["READY_FOR_DISPATCH", "PRICING_COMPLETED"].includes(order.status)) {
        return NextResponse.json({ error: "Order not ready for dispatch" }, { status: 409 });
      }
      const body = await request.json().catch(() => ({}));
      const parsed = dispatchSchema.parse(body);
      if (!parsed.assignedDriverId) {
        return NextResponse.json(
          { error: "assignedDriverId is required to create a delivery assignment" },
          { status: 400 }
        );
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: {
          status: "DISPATCHED",
          assignedDriverId: parsed.assignedDriverId,
          vehicleInfo: parsed.vehicleInfo,
          trackingNumber: parsed.trackingNumber,
          dispatchRemarks: parsed.dispatchRemarks,
          dispatchedAt: parsed.dispatchedAt ? new Date(parsed.dispatchedAt) : new Date(),
        },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      const deliveryAssignment = await serviceClient.call("delivery", "/api/assignments", {
        method: "POST",
        body: {
          orderId: id,
          orderNumber: updated.orderNumber,
          executiveId: parsed.assignedDriverId,
          notes: parsed.dispatchRemarks,
        },
        tenantId,
        userId,
      });
      await logModification(tenantId, id, userId, "DISPATCH", { remarks: parsed.dispatchRemarks });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
          remarks: parsed.dispatchRemarks,
          payload: {
            assignedDriverId: parsed.assignedDriverId,
            vehicleInfo: parsed.vehicleInfo,
            trackingNumber: parsed.trackingNumber,
            deliveryAssignmentStatus: deliveryAssignment.status,
          },
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "deliver-oms") {
      if (order.status !== "DISPATCHED" && order.status !== "OUT_FOR_DELIVERY") {
        return NextResponse.json({ error: "Order must be DISPATCHED" }, { status: 409 });
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          paymentStatus: order.paymentMethod === "COD" ? "PAID" : order.paymentStatus,
        },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await logModification(tenantId, id, userId, "STATUS_CHANGE", { newValue: "DELIVERED" });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
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

    if (action === "close") {
      if (order.status !== "DELIVERED" && order.status !== "INVOICED") {
        return NextResponse.json({ error: "Order must be DELIVERED before close" }, { status: 409 });
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date() },
        include: { items: true, customer: { select: { id: true, name: true } }, documents: true },
      });
      await logModification(tenantId, id, userId, "STATUS_CHANGE", { newValue: "CLOSED" });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
      return NextResponse.json({ data: updated });
    }

    // Grocery-specific transitions
    if (action === "awaiting_pickup") {
      if (order.status !== "CONFIRMED") {
        return NextResponse.json({ error: "Order must be CONFIRMED" }, { status: 409 });
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "AWAITING_PICKUP" },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "out_for_delivery") {
      if (order.status !== "AWAITING_PICKUP") {
        return NextResponse.json({ error: "Order must be AWAITING_PICKUP" }, { status: 409 });
      }
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "OUT_FOR_DELIVERY" },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "delivered") {
      if (order.status !== "OUT_FOR_DELIVERY") {
        return NextResponse.json({ error: "Order must be OUT_FOR_DELIVERY" }, { status: 409 });
      }
      // Mark COD orders as paid on delivery; pre-paid orders already paid
      const paymentStatus = order.paymentMethod === "COD" ? "PAID" : order.paymentStatus;
      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "DELIVERED", paymentStatus },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
        }
      );
      return NextResponse.json({ data: updated });
    }

    if (action === "invoice") {
      if (order.status !== "DELIVERED" && order.status !== "SHIPPED") {
        return NextResponse.json({ error: "Order must be DELIVERED or SHIPPED to invoice" }, { status: 409 });
      }
      // Create AR invoice in accounting service
      const invoiceResult = await serviceClient.call("accounting", "/api/invoices", {
        method: "POST",
        body: {
          type: "RECEIVABLE",
          entityId: order.customerId,
          entityName: order.customer.name,
          sourceRef: order.id,
          date: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          notes: `Invoice for order ${order.orderNumber}`,
        },
        tenantId,
        userId,
      });

      if (invoiceResult.status !== 201) {
        const errBody = invoiceResult.data as { error?: string } | undefined;
        return NextResponse.json({ error: errBody?.error ?? "Invoice creation failed" }, { status: 502 });
      }

      const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status: "INVOICED" },
        include: { items: true, customer: { select: { id: true, name: true } } },
      });
      await recordWorkflowTransition(
        { id, tenantId, status: updated.status, workflowId: updated.workflowId },
        {
          action,
          previousStatus: order.status,
          currentStatus: updated.status,
          actorUserId: userId,
          actorRole: role,
          payload: { invoice: invoiceResult.data },
        }
      );
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({
      error:
        "Invalid action. Use ?action=confirm|ship|cancel|submit|review|verify-stock|request-vendors|start-pricing|complete-pricing|ready-dispatch|dispatch|deliver-oms|upload-document|close|awaiting_pickup|out_for_delivery|delivered|invoice",
    }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`[orders/${id}?action=${action}] Internal error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

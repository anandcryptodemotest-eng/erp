/**
 * Sales domain adapter — registered at sales app bootstrap.
 * packages/workflow never imports this module.
 * Domain side effects for task completion live in registerDefaultSalesHandlers.
 */

import type {
  WorkflowDomainAdapter,
  WorkflowContext,
  TaskInstance,
  EntitySnapshot,
  ValidationResult,
  ExecuteResult,
  ProjectionPatch,
} from "@erp/workflow";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import {
  reviewSchema,
  stockVerifySchema,
  pricingSchema,
  dispatchSchema,
  PRICE_EDIT_ROLES,
} from "@/lib/task-payloads";
import { canCompleteDispatch, normalizeDispatchPayload } from "@erp/types";
import { serviceClient } from "@erp/config";

export const salesOrderAdapter: WorkflowDomainAdapter = {
  async loadEntity(entityType, entityId): Promise<EntitySnapshot> {
    if (entityType !== "SALES_ORDER") {
      throw new Error(`Sales adapter does not support entityType ${entityType}`);
    }
    const order = await prisma.salesOrder.findFirst({
      where: { id: entityId },
      include: { items: true, customer: { select: { id: true, name: true } } },
    });
    if (!order) throw new Error("Sales order not found");
    return {
      entityType,
      entityId,
      data: order as unknown as Record<string, unknown>,
    };
  },

  async validateTask(task, payload, _ctx): Promise<ValidationResult> {
    // Inventory items may be omitted by older UI clients — handler normalizes from order lines.
    if (task.taskType === "INVENTORY_CHECK" && payload && typeof payload === "object") {
      const items = (payload as { items?: unknown }).items;
      if (items != null && !Array.isArray(items)) {
        return { ok: false, errors: ["items must be an array for inventory check"] };
      }
    }
    if (task.taskType === "DISPATCH") {
      const parsed = dispatchSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          errors: parsed.error.issues.map((i) => i.message),
        };
      }
      const gate = canCompleteDispatch(parsed.data);
      if (!gate.ok) return { ok: false, errors: [gate.error] };
    }
    return { ok: true };
  },

  async execute(task, payload, ctx): Promise<ExecuteResult> {
    const handler = getSalesTaskHandler(task.taskType);
    if (!handler) {
      return { payload: (payload as Record<string, unknown>) ?? {} };
    }
    return handler(task, payload, ctx);
  },

  async project(task, _ctx): Promise<ProjectionPatch> {
    const snap = task as TaskInstance & { projectionStatus?: string };
    const byType: Record<string, string> = {
      SALES_REVIEW: "CONFIRMED",
      INVENTORY_CHECK: "FULFILLING",
      PRICING_REVIEW: "FULFILLING",
      WAREHOUSE_PICK: "READY_FOR_DISPATCH",
      DISPATCH: "DISPATCHED",
      DELIVERY_CONFIRM: "DELIVERED",
      INVOICE_GENERATE: "INVOICED",
      PAYMENT_COLLECTION: "PAID",
      ORDER_CLOSE: "CLOSED",
    };
    return { status: snap.projectionStatus ?? byType[task.taskType] };
  },
};

type Handler = (
  task: TaskInstance,
  payload: unknown,
  ctx: WorkflowContext
) => Promise<ExecuteResult>;

const handlers = new Map<string, Handler>();

export function registerSalesTaskHandler(taskType: string, handler: Handler) {
  handlers.set(taskType, handler);
}

function getSalesTaskHandler(taskType: string) {
  return handlers.get(taskType);
}

async function loadOrder(entityId: string) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: entityId },
    include: { items: true },
  });
  if (!order) throw new Error("Sales order not found");
  return order;
}

/** Domain handlers — invoked from completePlatformTask via adapter.execute */
export function registerDefaultSalesHandlers() {
  const passthrough: Handler = async (_t, payload) => ({
    payload: (payload as Record<string, unknown>) ?? {},
  });

  for (const type of ["WAREHOUSE_PICK", "DELIVERY_CONFIRM", "ORDER_CLOSE"]) {
    registerSalesTaskHandler(type, passthrough);
  }

  registerSalesTaskHandler("PAYMENT_COLLECTION", async (_task, payload, ctx) => {
    const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
    type InvRow = { id: string; total: number; paidAmount: number; status: string };
    const invList = await serviceClient.call<{ data?: InvRow[] } | InvRow[]>(
      "accounting",
      `/api/invoices?sourceRef=${encodeURIComponent(ctx.instance.entityId)}&limit=5`,
      {
        method: "GET",
        tenantId: ctx.tenantId,
        userId: ctx.actorUserId,
      }
    );
    const invBody = invList.data;
    const invoice = Array.isArray(invBody)
      ? invBody[0]
      : invBody && "data" in invBody
        ? invBody.data?.[0]
        : undefined;
    if (!invoice) {
      return { payload: p };
    }
    if (invoice.status === "PAID" || invoice.paidAmount >= invoice.total) {
      await prisma.salesOrder.update({
        where: { id: ctx.instance.entityId },
        data: { paymentStatus: "PAID" },
      });
      return { payload: { ...p, invoiceId: invoice.id, alreadyPaid: true } };
    }
    const remaining = Math.round((invoice.total - invoice.paidAmount) * 100) / 100;
    if (remaining > 0 && (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID" || invoice.status === "OVERDUE")) {
      const pay = await serviceClient.call("accounting", `/api/invoices/${invoice.id}?action=pay`, {
        method: "PATCH",
        tenantId: ctx.tenantId,
        userId: ctx.actorUserId,
        body: {
          amount: remaining,
          method: "OTHER",
          reference: ctx.instance.entityId,
          date: new Date().toISOString(),
        },
      });
      if (pay.error || pay.status >= 400) {
        const body = pay.data as { error?: string } | undefined;
        throw new Error(pay.error || body?.error || `Invoice pay failed (${pay.status})`);
      }
    }
    await prisma.salesOrder.update({
      where: { id: ctx.instance.entityId },
      data: { paymentStatus: "PAID" },
    });
    return { payload: { ...p, invoiceId: invoice.id, paidAmount: remaining } };
  });

  registerSalesTaskHandler("INVOICE_GENERATE", async (task, payload, ctx) => {
    const orderId = ctx.instance.entityId;
    const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
    const rawRef = p.documentRef as { type?: string; id?: string; version?: number } | undefined;
    const documentRef =
      rawRef?.type === "DOCUMENT" && rawRef.id && rawRef.version
        ? { type: "DOCUMENT" as const, id: rawRef.id, version: Number(rawRef.version) }
        : { type: "DOCUMENT" as const, id: "tax-invoice", version: 1 };

    const res = await serviceClient.call<{
      data: { invoice: { id: string; number: string; pdfUrl?: string }; pdfUrl?: string };
    }>("accounting", "/api/invoices/generate", {
      method: "POST",
      tenantId: ctx.tenantId,
      userId: ctx.actorUserId,
      body: {
        salesOrderId: orderId,
        documentRef,
        issue: true,
      },
    });

    if (res.error || !res.data?.data) {
      throw new Error(res.error || "Invoice generation failed");
    }

    return {
      payload: {
        ...p,
        invoiceId: res.data.data.invoice.id,
        invoiceNumber: res.data.data.invoice.number,
        pdfUrl: res.data.data.pdfUrl ?? res.data.data.invoice.pdfUrl,
        documentRef,
      },
    };
  });

  registerSalesTaskHandler("SALES_REVIEW", async (_task, payload, ctx) => {
    const parsed = reviewSchema.parse(payload ?? {});
    const orderId = ctx.instance.entityId;
    const order = await loadOrder(orderId);
    const role = ctx.actorRole ?? null;
    const canEditPrice = role != null && PRICE_EDIT_ROLES.has(role);

    await prisma.$transaction(async (tx) => {
      if (parsed.items) {
        await tx.salesOrderItem.deleteMany({ where: { salesOrderId: orderId } });
        await tx.salesOrderItem.createMany({
          data: parsed.items.map((i) => {
            const existing = order.items.find(
              (oi) => oi.id === i.id || oi.productId === i.productId
            );
            const unitPrice = canEditPrice
              ? i.unitPrice
              : (existing?.unitPrice ?? i.unitPrice);
            const existingSnap =
              existing?.customSnapshot && typeof existing.customSnapshot === "object"
                ? (existing.customSnapshot as Record<string, unknown>)
                : null;
            const incomingSnap =
              i.customSnapshot && typeof i.customSnapshot === "object"
                ? (i.customSnapshot as Record<string, unknown>)
                : null;
            let customSnapshot: Record<string, unknown> | undefined =
              incomingSnap ?? existingSnap ?? undefined;
            if (customSnapshot?.pricing && typeof customSnapshot.pricing === "object") {
              const pricing = { ...(customSnapshot.pricing as Record<string, unknown>) };
              const quoted = Number(pricing.quotedUnitPrice);
              if (
                Number.isFinite(quoted) &&
                Math.abs(quoted - unitPrice) > 0.0001
              ) {
                const snap =
                  pricing.pricingSnapshot && typeof pricing.pricingSnapshot === "object"
                    ? { ...(pricing.pricingSnapshot as Record<string, unknown>), overridden: true }
                    : pricing.pricingSnapshot;
                pricing.pricingSnapshot = snap;
                customSnapshot = { ...customSnapshot, pricing };
              }
            }
            return {
              salesOrderId: orderId,
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice,
              total: i.quantity * unitPrice,
              remarks: i.remarks,
              ...(customSnapshot
                ? { customSnapshot: customSnapshot as Prisma.InputJsonValue }
                : {}),
            };
          }),
        });
        const subtotal = parsed.items.reduce((s, i) => {
          const existing = order.items.find(
            (oi) => oi.id === i.id || oi.productId === i.productId
          );
          const unitPrice = canEditPrice
            ? i.unitPrice
            : (existing?.unitPrice ?? i.unitPrice);
          return s + i.quantity * unitPrice;
        }, 0);
        await tx.salesOrder.update({
          where: { id: orderId },
          data: {
            salesRemarks: parsed.remarks ?? order.salesRemarks,
            deliveryDate: parsed.deliveryDate
              ? new Date(parsed.deliveryDate)
              : order.deliveryDate,
            subtotal,
            total: subtotal + order.tax + order.deliveryFee - order.couponDiscount,
          },
        });
      } else {
        await tx.salesOrder.update({
          where: { id: orderId },
          data: {
            salesRemarks: parsed.remarks ?? order.salesRemarks,
            deliveryDate: parsed.deliveryDate
              ? new Date(parsed.deliveryDate)
              : order.deliveryDate,
          },
        });
      }
    });

    return { payload: parsed as unknown as Record<string, unknown> };
  });

  registerSalesTaskHandler("INVENTORY_CHECK", async (_task, payload, ctx) => {
    const orderId = ctx.instance.entityId;
    const order = await loadOrder(orderId);
    const raw = (payload && typeof payload === "object" ? payload : {}) as {
      items?: { orderItemId?: string; id?: string; availableQty?: number }[];
      remarks?: string;
    };

    // Default: confirm full stock from order lines when UI sent no items
    const lines =
      Array.isArray(raw.items) && raw.items.length > 0
        ? raw.items.map((line) => ({
            orderItemId: String(line.orderItemId ?? line.id ?? ""),
            availableQty: Number(line.availableQty ?? 0),
          }))
        : order.items.map((i) => ({
            orderItemId: i.id,
            availableQty: Number(i.availableQty ?? i.quantity),
          }));

    const parsed = stockVerifySchema.parse({ ...raw, items: lines });
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
    });

    return {
      variablesPatch: { shortage: hasShortage, procurementRequired: hasShortage },
      payload: parsed as unknown as Record<string, unknown>,
    };
  });

  registerSalesTaskHandler("PRICING_REVIEW", async (_task, payload, ctx) => {
    const parsed = pricingSchema.parse(payload ?? {});
    const orderId = ctx.instance.entityId;
    const order = await loadOrder(orderId);

    if (parsed.items?.length) {
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

    const fresh = await prisma.salesOrder.findFirst({
      where: { id: orderId },
      include: { items: true },
    });
    if (!fresh) throw new Error("Sales order not found");
    const purchaseSubtotal = fresh.items.reduce(
      (s, i) => s + (i.purchasePrice ?? 0) * i.quantity,
      0
    );
    const subtotal = fresh.items.reduce((s, i) => s + i.total, 0);
    const discountAmount = parsed.discountAmount ?? order.discountAmount;
    const transportationCharge = parsed.transportationCharge ?? order.transportationCharge;
    const additionalCharges = parsed.additionalCharges ?? order.additionalCharges;
    const tax = parsed.tax ?? order.tax;
    const total =
      subtotal - discountAmount + tax + transportationCharge + additionalCharges + order.deliveryFee;
    const marginAmount = subtotal - purchaseSubtotal - discountAmount;
    const marginPercent = purchaseSubtotal > 0 ? (marginAmount / purchaseSubtotal) * 100 : 0;

    await prisma.salesOrder.update({
      where: { id: orderId },
      data: {
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
    });

    return { payload: parsed as unknown as Record<string, unknown> };
  });

  registerSalesTaskHandler("PROCUREMENT_REQUEST", async (_task, payload, ctx) => {
    const orderId = ctx.instance.entityId;
    const order = await loadOrder(orderId);
    const body = (payload ?? {}) as { vendorId?: string };
    const items = order.items
      .filter((i) => (i.shortageQty ?? 0) > 0)
      .map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.shortageQty ?? 0,
      }));
    let vendorRequest: unknown = null;
    if (items.length > 0) {
      const rfq = await serviceClient.call("procurement", "/api/vendor-requests", {
        method: "POST",
        body: {
          salesOrderId: orderId,
          vendorId: body.vendorId,
          items,
          sendNow: true,
        },
        tenantId: ctx.tenantId,
        userId: ctx.actorUserId,
      });
      vendorRequest = rfq.data;
    }
    return {
      payload: { ...(body as Record<string, unknown>), vendorRequest } as Record<string, unknown>,
    };
  });

  registerSalesTaskHandler("DISPATCH", async (_task, payload, ctx) => {
    const body = (payload ?? {}) as Record<string, unknown>;
    const remarks = typeof body.dispatchRemarks === "string" ? body.dispatchRemarks : undefined;
    const normalized = normalizeDispatchPayload(body);
    const gate = canCompleteDispatch(normalized);
    if (!gate.ok) throw new Error(gate.error);

    const orderId = ctx.instance.entityId;
    await prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        fulfillmentMode: normalized.fulfillmentMode,
        carrier: normalized.carrier,
        trackingNumber: normalized.trackingNumber,
        trackingUrl: normalized.trackingUrl,
        porterBookingStatus: normalized.porterBookingStatus,
        assignedDriverId: normalized.assignedDriverId,
        vehicleInfo: normalized.vehicleInfo,
        dispatchRemarks: remarks,
        dispatchedAt: new Date(),
      },
    });
    if (normalized.fulfillmentMode === "own_fleet") {
      try {
        await serviceClient.call("delivery", "/api/assignments", {
          method: "POST",
          body: {
            salesOrderId: orderId,
            driverId: normalized.assignedDriverId,
            vehicleInfo: normalized.vehicleInfo,
          },
          tenantId: ctx.tenantId,
        });
      } catch {
        /* delivery service optional during cutover */
      }
    }

    const order = await prisma.salesOrder.findFirst({
      where: { id: orderId },
      include: { items: true },
    });
    if (order?.warehouseId && order.items.length) {
      const deduct = await serviceClient.call("inventory", "/api/stock/deduct", {
        method: "POST",
        tenantId: ctx.tenantId,
        userId: ctx.actorUserId,
        body: {
          reference: orderId,
          notes: "OMS dispatch",
          items: order.items.map((item) => ({
            productId: item.productId,
            warehouseId: order.warehouseId as string,
            variantId: item.variantId ?? undefined,
            quantity: item.quantity,
          })),
        },
      });
      if (deduct.error || deduct.status >= 400) {
        const body = deduct.data as { error?: string } | undefined;
        throw new Error(deduct.error || body?.error || `Stock deduct failed (${deduct.status})`);
      }
    }

    return {
      payload: {
        ...normalized,
        dispatchRemarks: remarks,
      } as Record<string, unknown>,
    };
  });
}

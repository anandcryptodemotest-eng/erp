import { NextResponse } from "next/server";
import { createLogger, contextFromHeaders, runWithRequestContextAsync } from "@erp/logger";
import { prisma } from "@/lib/prisma";
import { getDefaultWorkflow } from "@/lib/order-workflow";
import { startSalesOrderWorkflowV5, getPublishedDefinition } from "@/lib/workflow-runtime-v5";
import { notifyPortalCustomer } from "@/lib/notify-customer";
import { withSpan, recordEvent, captureException } from "@erp/telemetry";

const log = createLogger({ service: "sales" });

const CONVERT_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "SALES_EXECUTIVE",
]);

async function nextOrderNumber(tenantId: string, tx: { salesOrder: { count: typeof prisma.salesOrder.count } }) {
  const count = await tx.salesOrder.count({ where: { tenantId } });
  return `SO-${String(count + 1).padStart(5, "0")}`;
}

// POST /api/sales-requests/:id/convert — SREQ → SO (CONFIRMED) + v5 snapshot workflow
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reqCtx = contextFromHeaders(request.headers, {
    service: "sales",
    method: "POST",
    path: "/api/sales-requests/[id]/convert",
  });

  return runWithRequestContextAsync(reqCtx, async () =>
    withSpan("SalesOrder.Convert", async () => {
      const tenantId = request.headers.get("x-tenant-id");
      const userId = request.headers.get("x-user-id");
      const role = request.headers.get("x-user-role");
      if (!tenantId || !userId) {
        return NextResponse.json({ error: "Auth context required" }, { status: 400 });
      }
      if (!role || !CONVERT_ROLES.has(role)) {
        return NextResponse.json({ error: "Only sales staff can convert requests" }, { status: 403 });
      }

      const { id } = await params;

      const published = await getPublishedDefinition(tenantId);
      if (!published) {
        log.warn("convert_blocked_no_template", { tenantId, sreqId: id });
        return NextResponse.json(
          {
            error:
              "No published SO_STANDARD workflow template. Open Configuration → Workflows and publish before converting.",
          },
          { status: 409 }
        );
      }

      try {
        const defaultWf = await getDefaultWorkflow(tenantId);

        const result = await prisma.$transaction(async (tx) => {
          // Row lock — concurrent converts cannot both create an SO
          await tx.$executeRaw`
            SELECT id FROM "SalesRequest"
            WHERE id = ${id} AND "tenantId" = ${tenantId}
            FOR UPDATE
          `;

          const sreq = await tx.salesRequest.findFirst({
            where: { id, tenantId },
            include: { items: true, customer: true },
          });
          if (!sreq) {
            return { kind: "not_found" as const };
          }

          // Idempotent: already converted → return existing SO (no second create)
          if (sreq.salesOrderId) {
            const existing = await tx.salesOrder.findFirst({
              where: { id: sreq.salesOrderId, tenantId },
              include: { items: true, customer: { select: { id: true, name: true } } },
            });
            const updatedReq = await tx.salesRequest.findFirst({
              where: { id: sreq.id },
              include: {
                items: true,
                salesOrder: {
                  select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    paymentStatus: true,
                    total: true,
                  },
                },
              },
            });
            return {
              kind: "already" as const,
              order: existing,
              updatedReq,
              sreq,
            };
          }

          if (sreq.status !== "OPEN") {
            return { kind: "bad_status" as const, status: sreq.status };
          }
          if (sreq.customer.isBlocked) {
            return {
              kind: "blocked" as const,
              reason: sreq.customer.blockedReason ?? "contact support",
            };
          }

          const orderNumber = await nextOrderNumber(tenantId, tx);
          const order = await tx.salesOrder.create({
            data: {
              tenantId,
              orderNumber,
              customerId: sreq.customerId,
              userId,
              workflowId: defaultWf?.id,
              date: new Date(),
              status: "CONFIRMED",
              isOnlineOrder: sreq.isOnlineOrder,
              deliveryAddressId: sreq.deliveryAddressId,
              deliveryAddressText: sreq.deliveryAddressText,
              deliveryFee: sreq.deliveryFee,
              paymentMethod: sreq.paymentMethod,
              paymentStatus: sreq.paymentStatus,
              couponId: sreq.couponId,
              couponDiscount: sreq.couponDiscount,
              subtotal: sreq.subtotal,
              tax: sreq.tax,
              total: sreq.total,
              notes: sreq.notes,
              items: {
                create: sreq.items.map((i) => ({
                  productId: i.productId,
                  productName: i.productName,
                  variantId: i.variantId,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  taxRate: i.taxRate,
                  total: i.total,
                })),
              },
              modifications: {
                create: {
                  tenantId,
                  userId,
                  action: "STATUS_CHANGE",
                  field: "status",
                  oldValue: "SREQ",
                  newValue: "CONFIRMED",
                  remarks: `Converted from ${sreq.requestNumber}`,
                },
              },
            },
            include: { items: true, customer: { select: { id: true, name: true } } },
          });

          const updatedReq = await tx.salesRequest.update({
            where: { id: sreq.id },
            data: {
              status: "CONVERTED",
              salesOrderId: order.id,
              convertedAt: new Date(),
              convertedBy: userId,
            },
            include: {
              items: true,
              salesOrder: {
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                  paymentStatus: true,
                  total: true,
                },
              },
            },
          });

          return { kind: "created" as const, order, updatedReq, sreq };
        });

        if (result.kind === "not_found") {
          return NextResponse.json({ error: "Sales request not found" }, { status: 404 });
        }
        if (result.kind === "bad_status") {
          return NextResponse.json(
            { error: `Request is ${result.status}, cannot convert` },
            { status: 409 }
          );
        }
        if (result.kind === "blocked") {
          return NextResponse.json(
            { error: `Customer is blocked: ${result.reason}` },
            { status: 403 }
          );
        }
        if (result.kind === "already") {
          if (!result.order || !result.updatedReq) {
            return NextResponse.json({ error: "Request already converted" }, { status: 409 });
          }
          log.info("sreq_convert_idempotent", {
            tenantId,
            sreqId: id,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
          });
          return NextResponse.json(
            {
              data: {
                salesRequest: result.updatedReq,
                salesOrder: result.order,
                soStatus: result.order.status,
                soNumber: result.order.orderNumber,
                alreadyConverted: true,
              },
            },
            { status: 200 }
          );
        }

        if (!result.order.workflowId) {
          log.error("convert_missing_workflow", { orderId: result.order.id, tenantId });
          return NextResponse.json({ error: "Order missing workflow binding" }, { status: 500 });
        }

        await startSalesOrderWorkflowV5({
          tenantId,
          salesOrderId: result.order.id,
          workflowId: result.order.workflowId,
          orderStatus: result.order.status,
        });
        recordEvent("WorkflowStarted", {
          orderId: result.order.id,
          tenantId,
          sreqId: result.sreq.id,
        });

        log.info("sreq_converted", {
          tenantId,
          userId,
          sreqId: result.sreq.id,
          orderId: result.order.id,
          orderNumber: result.order.orderNumber,
        });

        await notifyPortalCustomer({
          tenantId,
          portalUserId: result.sreq.customer.portalUserId,
          type: "ORDER_UPDATED",
          title: "Sales order created",
          body: `${result.sreq.requestNumber} converted to ${result.order.orderNumber}. Fulfillment has started.`,
          metadata: {
            salesRequestId: result.sreq.id,
            requestNumber: result.sreq.requestNumber,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
          },
        });

        return NextResponse.json(
          {
            data: {
              salesRequest: result.updatedReq,
              salesOrder: result.order,
              soStatus: result.order.status,
              soNumber: result.order.orderNumber,
            },
          },
          { status: 201 }
        );
      } catch (error) {
        captureException(error, { message: "convert_failed", tenantId, sreqId: id });
        const message =
          error instanceof Error
            ? error.message.split("\n").slice(0, 6).join(" ").slice(0, 500)
            : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    })
  );
}

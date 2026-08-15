import { NextResponse } from "next/server";
import { createLogger, contextFromHeaders, runWithRequestContextAsync } from "@erp/logger";
import { withSpan, recordEvent, captureException } from "@erp/telemetry/helpers";
import { assertSaasEntitlement } from "@/lib/assert-saas-entitlement";
import {
  createConfirmedSalesOrder,
  CreateConfirmedSalesOrderError,
  jsonError,
} from "@/lib/create-confirmed-sales-order";
import { FulfilmentSourceError } from "@/lib/fulfilment-source";
import { notifyPortalCustomer } from "@/lib/notify-customer";
import { prisma } from "@/lib/prisma";

const log = createLogger({ service: "sales" });

const CONVERT_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "SALES_EXECUTIVE",
]);

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

      const entitlementBlock = await assertSaasEntitlement(tenantId, "oms");
      if (entitlementBlock) return entitlementBlock;

      const { id } = await params;

      try {
        const result = await createConfirmedSalesOrder({
          tenantId,
          userId,
          sourceKind: "SREQ",
          salesRequestId: id,
        });

        const updatedReq = await prisma.salesRequest.findFirst({
          where: { id, tenantId },
          include: {
            items: true,
            customer: true,
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

        if (result.alreadyExisted) {
          log.info("sreq_convert_idempotent", {
            tenantId,
            sreqId: id,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
          });
          return NextResponse.json(
            {
              data: {
                salesRequest: updatedReq,
                salesOrder: result.order,
                soStatus: result.order.status,
                soNumber: result.order.orderNumber,
                alreadyConverted: true,
              },
            },
            { status: 200 }
          );
        }

        recordEvent("WorkflowStarted", {
          orderId: result.order.id,
          tenantId,
          sreqId: id,
        });

        log.info("sreq_converted", {
          tenantId,
          userId,
          sreqId: id,
          orderId: result.order.id,
          orderNumber: result.order.orderNumber,
        });

        await notifyPortalCustomer({
          tenantId,
          portalUserId: result.order.customer.portalUserId,
          type: "ORDER_UPDATED",
          title: "Sales order created",
          body: `${updatedReq?.requestNumber ?? "Request"} converted to ${result.order.orderNumber}. Fulfillment has started.`,
          metadata: {
            salesRequestId: id,
            requestNumber: updatedReq?.requestNumber,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
          },
        });

        return NextResponse.json(
          {
            data: {
              salesRequest: updatedReq,
              salesOrder: result.order,
              soStatus: result.order.status,
              soNumber: result.order.orderNumber,
            },
          },
          { status: 201 }
        );
      } catch (error) {
        if (error instanceof FulfilmentSourceError || error instanceof CreateConfirmedSalesOrderError) {
          const mapped = jsonError(error);
          return NextResponse.json(mapped.body, { status: mapped.status });
        }
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

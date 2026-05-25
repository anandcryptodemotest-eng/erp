import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";
import { z } from "zod";

const receiveSchema = z.object({
  items: z.array(z.object({
    orderItemId: z.string(),
    receivedQty: z.number().int().positive(),
  })).min(1),
  warehouseId: z.string(),
  notes: z.string().optional(),
});

// GET /api/purchase-orders/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: {
      vendor: true,
      items: true,
      returns: { select: { id: true, returnNumber: true, status: true, total: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  return NextResponse.json({ data: order });
}

// PATCH /api/purchase-orders/:id?action=submit|approve|receive|cancel
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) return NextResponse.json({ error: "Auth context required" }, { status: 400 });

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

  try {
    if (action === "submit") {
      if (order.status !== "DRAFT") {
        return NextResponse.json({ error: "Only DRAFT orders can be submitted" }, { status: 409 });
      }
      const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "SUBMITTED" } });
      return NextResponse.json({ data: updated });
    }

    if (action === "approve") {
      if (order.status !== "SUBMITTED") {
        return NextResponse.json({ error: "Only SUBMITTED orders can be approved" }, { status: 409 });
      }
      if (role !== "ADMIN" && role !== "MANAGER") {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "APPROVED" } });
      return NextResponse.json({ data: updated });
    }

    if (action === "receive") {
      if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)) {
        return NextResponse.json({ error: "Order must be APPROVED or PARTIALLY_RECEIVED to receive items" }, { status: 409 });
      }

      const body = await request.json();
      const { items: receiveItems, warehouseId, notes } = receiveSchema.parse(body);

      // Validate received quantities
      for (const ri of receiveItems) {
        const orderItem = order.items.find((i) => i.id === ri.orderItemId);
        if (!orderItem) {
          return NextResponse.json({ error: `Order item ${ri.orderItemId} not found` }, { status: 400 });
        }
        const remaining = orderItem.quantity - orderItem.receivedQty;
        if (ri.receivedQty > remaining) {
          return NextResponse.json(
            { error: `Cannot receive ${ri.receivedQty} for ${orderItem.productName}: only ${remaining} remaining` },
            { status: 409 }
          );
        }
      }

      // Add to inventory via stock receive endpoint
      const receivePayload = {
        items: receiveItems.map((ri) => {
          const orderItem = order.items.find((i) => i.id === ri.orderItemId)!;
          return {
            productId: orderItem.productId,
            warehouseId,
            variantId: orderItem.variantId ?? undefined,
            quantity: ri.receivedQty,
          };
        }),
        reference: order.id,
        notes,
      };

      const stockResult = await serviceClient.call("inventory", "/api/stock/receive", {
        method: "POST",
        body: receivePayload,
        tenantId,
        userId,
      });

      if (stockResult.status !== 201) {
        const errBody = stockResult.data as { error?: string } | undefined;
        return NextResponse.json({ error: errBody?.error ?? "Stock receive failed" }, { status: 500 });
      }

      // Update receivedQty on items and order status
      const updated = await prisma.$transaction(async (tx) => {
        for (const ri of receiveItems) {
          await tx.purchaseOrderItem.update({
            where: { id: ri.orderItemId },
            data: { receivedQty: { increment: ri.receivedQty } },
          });
        }
        const refreshed = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
        const allReceived = refreshed!.items.every((i) => i.receivedQty >= i.quantity);
        return tx.purchaseOrder.update({
          where: { id },
          data: {
            status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
            warehouseId,
          },
          include: { items: true, vendor: { select: { id: true, name: true } } },
        });
      });

      return NextResponse.json({ data: updated });
    }

    if (action === "cancel") {
      if (!["DRAFT", "SUBMITTED"].includes(order.status)) {
        return NextResponse.json({ error: `Cannot cancel order in ${order.status} status` }, { status: 409 });
      }
      const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use ?action=submit|approve|receive|cancel" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

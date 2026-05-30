import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";
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

// GET /api/orders/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const order = await prisma.salesOrder.findFirst({
    where: { id, tenantId },
    include: {
      customer: true,
      quote: { select: { id: true, quoteNumber: true } },
      items: true,
      returns: { select: { id: true, returnNumber: true, status: true, total: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ data: order });
}

// PATCH /api/orders/:id?action=confirm|ship|cancel
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
      if (!["DRAFT", "CONFIRMED", "PARTIALLY_SHIPPED"].includes(order.status)) {
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
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use ?action=confirm|ship|cancel|awaiting_pickup|out_for_delivery|delivered|invoice" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

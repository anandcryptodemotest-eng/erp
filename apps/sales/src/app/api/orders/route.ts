import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultWorkflow } from "@/lib/order-workflow";
import { startSalesOrderWorkflowV5, getPublishedDefinition } from "@/lib/workflow-runtime-v5";
import {
  applyInventoryTaxRates,
  computeTotals,
  lineItemInputSchema,
  normalizeLineItems,
} from "@/lib/order-lines";
import { z } from "zod";

const log = createLogger({ service: "sales" });

const createOrderSchema = z.object({
  customerId: z.string().optional(),
  quoteId: z.string().optional(),
  warehouseId: z.string().optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
  isOnlineOrder: z.boolean().default(false),
  deliveryAddressId: z.string().nullish(),
  deliveryAddressText: z.string().nullish(),
  deliveryFee: z.number().min(0).default(0),
  paymentMethod: z.enum(["COD", "UPI", "CARD", "WALLET", "SPLIT"]).default("COD"),
  couponId: z.string().optional(),
  couponDiscount: z.number().min(0).default(0),
  items: lineItemInputSchema,
});

// GET /api/orders
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  let customerId = url.searchParams.get("customerId") ?? undefined;
  const paymentStatus = url.searchParams.get("paymentStatus") ?? undefined;
  const isOnline = url.searchParams.get("isOnlineOrder");

  if (role === "CUSTOMER" && userId) {
    const me = await prisma.customer.findFirst({
      where: { tenantId, portalUserId: userId, isActive: true },
      select: { id: true },
    });
    if (!me) return NextResponse.json({ data: [], meta: { page, limit, total: 0, pages: 0 } });
    customerId = me.id;
  }

  const where = {
    tenantId,
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(paymentStatus && { paymentStatus }),
    ...(isOnline !== null && isOnline !== undefined && { isOnlineOrder: isOnline === "true" }),
  };
  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: {
        customer: true,
        items: true,
        salesRequest: { select: { id: true, requestNumber: true, status: true } },
        workflowTasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return NextResponse.json({ data: orders, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/orders — staff / quote conversion only (portal uses POST /api/sales-requests)
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  if (role === "CUSTOMER") {
    return NextResponse.json(
      {
        error:
          "Customer checkout creates a Sales Request (SREQ). Use POST /api/sales-requests — sales converts it to a Sales Order.",
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    if (body.submitForReview) {
      return NextResponse.json(
        {
          error:
            "submitForReview is removed. Create a Sales Request (POST /api/sales-requests) or create a DRAFT SO and activate it.",
        },
        { status: 400 }
      );
    }

    const data = createOrderSchema.parse(body);

    const customerId = data.customerId;
    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (customer.isBlocked) {
      return NextResponse.json(
        { error: `Customer is blocked: ${customer.blockedReason ?? "contact support"}` },
        { status: 403 }
      );
    }

    const normalized = normalizeLineItems(data.items);
    const items = await applyInventoryTaxRates(normalized, { tenantId, userId });
    const { subtotal, tax, total } = computeTotals(items, {
      couponDiscount: data.couponDiscount,
      deliveryFee: data.deliveryFee,
    });

    const count = await prisma.salesOrder.count({ where: { tenantId } });
    const orderNumber = `SO-${String(count + 1).padStart(5, "0")}`;
    const defaultWf = await getDefaultWorkflow(tenantId);

    const order = await prisma.salesOrder.create({
      data: {
        tenantId,
        orderNumber,
        customerId,
        quoteId: data.quoteId,
        warehouseId: data.warehouseId,
        workflowId: defaultWf?.id,
        userId,
        date: new Date(data.date ?? new Date().toISOString()),
        status: "DRAFT",
        isOnlineOrder: data.isOnlineOrder,
        deliveryAddressId: data.deliveryAddressId,
        deliveryAddressText: data.deliveryAddressText,
        deliveryFee: data.deliveryFee,
        paymentMethod: data.paymentMethod,
        couponId: data.couponId,
        couponDiscount: data.couponDiscount,
        subtotal,
        tax,
        total,
        notes: data.notes,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            total: i.total,
          })),
        },
      },
      include: {
        items: true,
        customer: { select: { id: true, name: true } },
        workflow: true,
        salesRequest: true,
      },
    });

    const published = await getPublishedDefinition(tenantId);
    if (!published || !order.workflowId) {
      return NextResponse.json(
        {
          error:
            "No published SO_STANDARD workflow template. Publish in Configuration → Workflows before creating orders.",
        },
        { status: 409 }
      );
    }
    await startSalesOrderWorkflowV5({
      tenantId,
      salesOrderId: order.id,
      workflowId: order.workflowId,
      orderStatus: order.status,
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    log.error("post_api_orders", { err: error });
    const message =
      error instanceof Error ? error.message.split("\n").slice(0, 6).join(" ").slice(0, 500) : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

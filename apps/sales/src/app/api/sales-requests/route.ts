import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPortalCustomer } from "@/lib/notify-customer";
import {
  applyInventoryTaxRates,
  computeTotals,
  lineItemInputSchema,
  normalizeLineItems,
} from "@/lib/order-lines";
import { z } from "zod";

const log = createLogger({ service: "sales" });

const createRequestSchema = z.object({
  customerId: z.string().optional(),
  notes: z.string().optional(),
  isOnlineOrder: z.boolean().default(true),
  deliveryAddressId: z.string().nullish(),
  deliveryAddressText: z.string().nullish(),
  deliveryFee: z.number().min(0).default(0),
  paymentMethod: z.enum(["COD", "UPI", "CARD", "WALLET", "SPLIT"]).default("COD"),
  couponId: z.string().optional(),
  couponDiscount: z.number().min(0).default(0),
  items: lineItemInputSchema,
});

async function nextRequestNumber(tenantId: string) {
  const count = await prisma.salesRequest.count({ where: { tenantId } });
  return `SREQ-${String(count + 1).padStart(5, "0")}`;
}

// GET /api/sales-requests
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
  };

  const [rows, total] = await Promise.all([
    prisma.salesRequest.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
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
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.salesRequest.count({ where }),
  ]);

  return NextResponse.json({ data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/sales-requests — portal checkout / staff request desk
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = createRequestSchema.parse(body);

    let customerId = data.customerId;
    if (role === "CUSTOMER") {
      const me = await prisma.customer.findFirst({
        where: { tenantId, portalUserId: userId, isActive: true },
      });
      if (!me) {
        return NextResponse.json({ error: "No customer profile linked to this login" }, { status: 404 });
      }
      customerId = me.id;
    }

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
    if (role === "CUSTOMER" && customer.portalUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const normalized = normalizeLineItems(data.items);
    const items = await applyInventoryTaxRates(normalized, { tenantId, userId });
    const { subtotal, tax, total } = computeTotals(items, {
      couponDiscount: data.couponDiscount,
      deliveryFee: data.deliveryFee,
    });

    const requestNumber = await nextRequestNumber(tenantId);
    const sreq = await prisma.salesRequest.create({
      data: {
        tenantId,
        requestNumber,
        customerId,
        userId,
        status: "OPEN",
        isOnlineOrder: data.isOnlineOrder || role === "CUSTOMER",
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
        salesOrder: true,
      },
    });

    await notifyPortalCustomer({
      tenantId,
      portalUserId: customer.portalUserId,
      type: "ORDER_PLACED",
      title: "Sales request submitted",
      body: `${sreq.requestNumber} is with sales. A sales order will be created after review.`,
      metadata: { salesRequestId: sreq.id, requestNumber: sreq.requestNumber },
    });

    return NextResponse.json({ data: sreq }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    log.error("post_api_sales_requests", { err: error });
    const message =
      error instanceof Error ? error.message.split("\n").slice(0, 6).join(" ").slice(0, 500) : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

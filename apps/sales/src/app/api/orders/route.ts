import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultWorkflow } from "@/lib/order-workflow";
import { ensureWorkflowRuntimeForOrder } from "@/lib/workflow-runtime";
import { z } from "zod";

const createOrderSchema = z.object({
  customerId: z.string().optional(), // required for staff; portal resolves from JWT
  quoteId: z.string().optional(),
  warehouseId: z.string().optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
  isOnlineOrder: z.boolean().default(false),
  /** Portal checkout: create then auto-submit into OMS review queue */
  submitForReview: z.boolean().default(false),
  deliveryAddressId: z.string().nullish(),
  deliveryAddressText: z.string().nullish(),
  deliveryFee: z.number().min(0).default(0),
  paymentMethod: z.enum(["COD", "UPI", "CARD", "WALLET", "SPLIT"]).default("COD"),
  couponId: z.string().optional(),
  couponDiscount: z.number().min(0).default(0),
  items: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string().optional(),
        name: z.string().optional(), // portal alias
        variantId: z.string().nullish(),
        quantity: z.number().int().positive().optional(),
        qty: z.number().int().positive().optional(), // portal alias
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1),
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

  // Portal customers only see their own orders
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
      include: { customer: true, items: true, workflowTasks: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } } },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return NextResponse.json({ data: orders, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/orders
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = createOrderSchema.parse(body);

    let customerId = data.customerId;
    if (role === "CUSTOMER" || data.submitForReview) {
      const me = await prisma.customer.findFirst({
        where: { tenantId, portalUserId: userId, isActive: true },
      });
      if (role === "CUSTOMER") {
        if (!me) {
          return NextResponse.json({ error: "No customer profile linked to this login" }, { status: 404 });
        }
        customerId = me.id;
      } else if (!customerId && me) {
        customerId = me.id;
      }
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

    // Portal users may only order for themselves
    if (role === "CUSTOMER" && customer.portalUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items = data.items.map((item) => {
      const quantity = item.quantity ?? item.qty;
      const productName = item.productName ?? item.name;
      if (!quantity || !productName) {
        throw new z.ZodError([
          {
            code: "custom",
            message: "Each item needs productName/name and quantity/qty",
            path: ["items"],
          },
        ]);
      }
      return {
        productId: item.productId,
        productName,
        variantId: item.variantId ?? undefined,
        quantity,
        unitPrice: item.unitPrice,
        total: quantity * item.unitPrice,
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const discountedSubtotal = Math.max(0, subtotal - data.couponDiscount);
    const TAX_RATE = parseFloat(process.env.TAX_RATE ?? "0.10");
    const tax = discountedSubtotal * TAX_RATE;
    const total = discountedSubtotal + tax + data.deliveryFee;

    const count = await prisma.salesOrder.count({ where: { tenantId } });
    const orderNumber = `SO-${String(count + 1).padStart(5, "0")}`;
    const defaultWf = await getDefaultWorkflow(tenantId);

    const shouldSubmit = data.submitForReview || role === "CUSTOMER";
    const initialStatus = shouldSubmit ? "PENDING_SALES_REVIEW" : "DRAFT";

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
        status: initialStatus,
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
        items: { create: items },
        ...(shouldSubmit
          ? {
              modifications: {
                create: {
                  tenantId,
                  userId,
                  action: "STATUS_CHANGE",
                  field: "status",
                  oldValue: "DRAFT",
                  newValue: "PENDING_SALES_REVIEW",
                  remarks: "Placed by customer portal",
                },
              },
            }
          : {}),
      },
      include: { items: true, customer: { select: { id: true, name: true } }, workflow: true },
    });

    await ensureWorkflowRuntimeForOrder({
      id: order.id,
      tenantId,
      status: order.status,
      workflowId: order.workflowId,
      orderNumber: order.orderNumber,
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

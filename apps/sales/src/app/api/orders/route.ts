import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createOrderSchema = z.object({
  customerId: z.string(),
  quoteId: z.string().optional(),
  warehouseId: z.string().optional(),
  date: z.string(),
  notes: z.string().optional(),
  isOnlineOrder: z.boolean().default(false),
  deliveryAddressId: z.string().optional(),
  deliveryFee: z.number().min(0).default(0),
  paymentMethod: z.enum(["COD", "UPI", "CARD", "WALLET", "SPLIT"]).default("COD"),
  couponId: z.string().optional(),
  couponDiscount: z.number().min(0).default(0),
  items: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
});

// GET /api/orders
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? undefined;
  const customerId = url.searchParams.get("customerId") ?? undefined;
  const paymentStatus = url.searchParams.get("paymentStatus") ?? undefined;
  const isOnline = url.searchParams.get("isOnlineOrder");

  const where = {
    tenantId,
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(paymentStatus && { paymentStatus }),
    ...(isOnline !== null && { isOnlineOrder: isOnline === "true" }),
  };
  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: { customer: true, items: true },
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
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data = createOrderSchema.parse(body);

    // Reject orders from blocked customers
    const customer = await prisma.customer.findFirst({ where: { id: data.customerId, tenantId } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (customer.isBlocked) {
      return NextResponse.json({ error: `Customer is blocked: ${customer.blockedReason ?? "contact support"}` }, { status: 403 });
    }

    const items = data.items.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const discountedSubtotal = Math.max(0, subtotal - data.couponDiscount);
    const TAX_RATE = parseFloat(process.env.TAX_RATE ?? "0.10");
    const tax = discountedSubtotal * TAX_RATE;
    const total = discountedSubtotal + tax + data.deliveryFee;

    // Generate tenant-scoped order number
    const count = await prisma.salesOrder.count({ where: { tenantId } });
    const orderNumber = `SO-${String(count + 1).padStart(5, "0")}`;

    const order = await prisma.salesOrder.create({
      data: {
        tenantId,
        orderNumber,
        customerId: data.customerId,
        quoteId: data.quoteId,
        warehouseId: data.warehouseId,
        userId,
        date: new Date(data.date),
        isOnlineOrder: data.isOnlineOrder,
        deliveryAddressId: data.deliveryAddressId,
        deliveryFee: data.deliveryFee,
        paymentMethod: data.paymentMethod,
        couponId: data.couponId,
        couponDiscount: data.couponDiscount,
        subtotal,
        tax,
        total,
        notes: data.notes,
        items: { create: items },
      },
      include: { items: true, customer: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

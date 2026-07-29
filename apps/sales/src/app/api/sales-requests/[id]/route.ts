import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPortalCustomer } from "@/lib/notify-customer";
import { z } from "zod";

const log = createLogger({ service: "sales" });

const STAFF_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "ORG_ADMIN",
  "SUPER_ADMIN",
  "BRANCH_ADMIN",
  "SALES_EXECUTIVE",
  "SALES_REP",
]);

const updateOpenSchema = z.object({
  notes: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        variantId: z.string().nullish(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        taxRate: z.number().nonnegative().optional(),
      })
    )
    .min(1)
    .optional(),
});

const rejectSchema = z.object({
  rejectReason: z.string().min(3, "Reject reason is required"),
});

async function loadRequest(tenantId: string, id: string) {
  return prisma.salesRequest.findFirst({
    where: { id, tenantId },
    include: {
      customer: {
        include: {
          addresses: { where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        },
      },
      items: true,
      salesOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          salesRemarks: true,
          deliveryDate: true,
          workflowTasks: {
            where: { status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] } },
            select: {
              id: true,
              action: true,
              title: true,
              assignedRole: true,
              status: true,
              phase: true,
              completedAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
}

function formatAddress(addr: {
  label?: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  pincode: string;
} | null | undefined) {
  if (!addr) return null;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
}

// GET /api/sales-requests/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const sreq = await loadRequest(tenantId, id);
  if (!sreq) return NextResponse.json({ error: "Sales request not found" }, { status: 404 });

  if (role === "CUSTOMER" && userId && sreq.customer.portalUserId !== userId) {
    return NextResponse.json({ error: "Sales request not found" }, { status: 404 });
  }

  const deliveryAddress =
    (sreq.deliveryAddressId
      ? sreq.customer.addresses.find((a) => a.id === sreq.deliveryAddressId)
      : sreq.customer.addresses.find((a) => a.isDefault)) ?? sreq.customer.addresses[0];

  const recentOrders = await prisma.salesOrder.findMany({
    where: {
      tenantId,
      customerId: sreq.customerId,
      status: { notIn: ["CANCELLED"] },
    },
    select: { id: true, orderNumber: true, status: true, total: true, date: true },
    orderBy: { date: "desc" },
    take: 5,
  });

  const outstanding = await prisma.salesOrder.aggregate({
    where: {
      tenantId,
      customerId: sreq.customerId,
      status: {
        in: ["CONFIRMED", "FULFILLING", "READY_FOR_DISPATCH", "DISPATCHED", "PARTIALLY_SHIPPED"],
      },
    },
    _sum: { total: true },
  });

  return NextResponse.json({
    data: {
      ...sreq,
      soStatus: sreq.salesOrder?.status ?? null,
      soNumber: sreq.salesOrder?.orderNumber ?? null,
      deliveryAddressResolved: formatAddress(deliveryAddress) ?? sreq.deliveryAddressText,
      deliveryAddressDetail: deliveryAddress ?? null,
      customerSummary: {
        id: sreq.customer.id,
        name: sreq.customer.name,
        phone: sreq.customer.phone,
        email: sreq.customer.email,
        creditLimit: sreq.customer.creditLimit,
        isBlocked: sreq.customer.isBlocked,
        blockedReason: sreq.customer.blockedReason,
        portalLinked: Boolean(sreq.customer.portalUserId),
        outstandingBalance: outstanding._sum.total ?? 0,
      },
      recentOrders,
    },
  });
}

// PATCH /api/sales-requests/:id?action=reject|cancel|update
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const sreq = await loadRequest(tenantId, id);
  if (!sreq) return NextResponse.json({ error: "Sales request not found" }, { status: 404 });

  if (role === "CUSTOMER") {
    if (sreq.customer.portalUserId !== userId) {
      return NextResponse.json({ error: "Sales request not found" }, { status: 404 });
    }
    if (action !== "cancel") {
      return NextResponse.json({ error: "Customers can only cancel open requests" }, { status: 403 });
    }
  }

  if (sreq.status !== "OPEN") {
    return NextResponse.json({ error: `Cannot ${action ?? "update"} a ${sreq.status} request` }, { status: 409 });
  }

  try {
    if (action === "cancel") {
      const updated = await prisma.salesRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { items: true, customer: { select: { id: true, name: true } }, salesOrder: true },
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "reject") {
      if (!role || !STAFF_ROLES.has(role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      const body = await request.json().catch(() => ({}));
      const data = rejectSchema.parse(body);
      const updated = await prisma.salesRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectReason: data.rejectReason.trim(),
        },
        include: { items: true, customer: { select: { id: true, name: true } }, salesOrder: true },
      });
      await notifyPortalCustomer({
        tenantId,
        portalUserId: sreq.customer.portalUserId,
        type: "ORDER_UPDATED",
        title: "Sales request rejected",
        body: `${updated.requestNumber} was rejected. ${updated.rejectReason ?? ""}`.trim(),
        metadata: { salesRequestId: id, requestNumber: updated.requestNumber },
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "update") {
      if (!role || !STAFF_ROLES.has(role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      const body = await request.json();
      const data = updateOpenSchema.parse(body);

      const updated = await prisma.$transaction(async (tx) => {
        if (data.items) {
          await tx.salesRequestItem.deleteMany({ where: { salesRequestId: id } });
          const items = data.items.map((i) => ({
            salesRequestId: id,
            productId: i.productId,
            productName: i.productName,
            variantId: i.variantId ?? undefined,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate ?? 0,
            total: i.quantity * i.unitPrice,
          }));
          await tx.salesRequestItem.createMany({ data: items });
          const subtotal = items.reduce((s, i) => s + i.total, 0);
          const tax = items.reduce((s, i) => s + i.total * i.taxRate, 0);
          return tx.salesRequest.update({
            where: { id },
            data: {
              notes: data.notes ?? sreq.notes,
              subtotal,
              tax,
              total: subtotal + tax + sreq.deliveryFee - sreq.couponDiscount,
            },
            include: {
              items: true,
              customer: { select: { id: true, name: true, phone: true, email: true } },
              salesOrder: true,
            },
          });
        }
        return tx.salesRequest.update({
          where: { id },
          data: { notes: data.notes ?? sreq.notes },
          include: {
            items: true,
            customer: { select: { id: true, name: true, phone: true, email: true } },
            salesOrder: true,
          },
        });
      });

      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "action must be cancel, reject, or update" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    log.error("patch_api_sales_requests_id", { err: error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

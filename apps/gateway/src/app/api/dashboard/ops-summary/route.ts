import { NextResponse } from "next/server";
import { extractToken, getServiceSecret, verifyToken } from "@erp/auth";

const SALES_URL = process.env.SALES_SERVICE_URL ?? "http://127.0.0.1:3001";
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL ?? "http://127.0.0.1:3002";
const ACCOUNTING_URL = process.env.ACCOUNTING_SERVICE_URL ?? "http://127.0.0.1:3003";
const DELIVERY_URL = process.env.DELIVERY_SERVICE_URL ?? "http://127.0.0.1:3006";

type JsonRecord = Record<string, unknown>;

async function serviceGet<T>(
  base: string,
  path: string,
  headers: HeadersInit
): Promise<T | null> {
  try {
    const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function statusCount(
  rows: Array<{ status?: string; _count?: { id?: number } }> | undefined,
  status: string
): number {
  return rows?.find((r) => r.status === status)?._count?.id ?? 0;
}

/**
 * GET /api/dashboard/ops-summary
 * Aggregated KPI + attention lists for role dashboards.
 * Downstream APIs stay JWT/role/service gated — this BFF does not use nav keys.
 */
export async function GET(request: Request) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const tenantId = request.headers.get("x-tenant-id") || auth.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-service-key": getServiceSecret(),
    "x-tenant-id": tenantId,
    "x-user-id": auth.userId,
    "x-user-role": auth.role,
  };

  const todayFrom = startOfTodayIso();
  const todayQs = `from=${encodeURIComponent(todayFrom)}`;

  const [
    salesReport,
    todaySalesReport,
    sreqList,
    sreqOpen,
    orderList,
    taskList,
    customerList,
    productList,
    categoryList,
    brandList,
    attrList,
    priceList,
    deliveryReport,
    todayDelivery,
    recon,
  ] = await Promise.all([
    serviceGet<{ data?: JsonRecord }>(SALES_URL, "/api/reports/sales", headers),
    serviceGet<{ data?: JsonRecord }>(SALES_URL, `/api/reports/sales?${todayQs}`, headers),
    serviceGet<{ data?: JsonRecord[]; meta?: { total?: number } }>(
      SALES_URL,
      "/api/sales-requests?limit=8",
      headers
    ),
    serviceGet<{ meta?: { total?: number } }>(
      SALES_URL,
      "/api/sales-requests?status=OPEN&limit=1",
      headers
    ),
    serviceGet<{ data?: JsonRecord[]; meta?: { total?: number } }>(
      SALES_URL,
      "/api/orders?limit=8",
      headers
    ),
    serviceGet<{ data?: JsonRecord[]; meta?: JsonRecord }>(
      SALES_URL,
      "/api/workflow-tasks",
      headers
    ),
    serviceGet<{ data?: JsonRecord[]; meta?: { total?: number } }>(
      SALES_URL,
      "/api/customers?limit=8",
      headers
    ),
    serviceGet<{ data?: JsonRecord[]; meta?: { total?: number } }>(
      INVENTORY_URL,
      "/api/products?limit=8",
      headers
    ),
    serviceGet<{ meta?: { total?: number } }>(
      INVENTORY_URL,
      "/api/products/categories?limit=1",
      headers
    ),
    serviceGet<{ meta?: { total?: number } }>(INVENTORY_URL, "/api/brands?limit=1", headers),
    serviceGet<{ data?: unknown[] }>(INVENTORY_URL, "/api/attribute-definitions", headers),
    serviceGet<{ data?: JsonRecord[]; meta?: { total?: number } }>(
      INVENTORY_URL,
      "/api/price-lists?limit=20",
      headers
    ),
    serviceGet<{ data?: JsonRecord }>(DELIVERY_URL, "/api/reports", headers),
    serviceGet<{ data?: JsonRecord }>(DELIVERY_URL, `/api/reports?${todayQs}`, headers),
    serviceGet<{ data?: JsonRecord }>(ACCOUNTING_URL, "/api/reports/reconciliation", headers),
  ]);

  const salesSummary = (salesReport?.data?.summary ?? {}) as JsonRecord;
  const todaySummary = (todaySalesReport?.data?.summary ?? {}) as JsonRecord;
  const taskMeta = (taskList?.meta ?? {}) as JsonRecord;
  const deliverySummary = (deliveryReport?.data?.summary ?? {}) as JsonRecord;
  const todayDeliverySummary = (todayDelivery?.data?.summary ?? {}) as JsonRecord;
  const deliveryByStatus = (deliveryReport?.data?.byStatus ?? []) as Array<{
    status?: string;
    _count?: { id?: number };
  }>;
  const invoices = (recon?.data?.invoices ?? {}) as JsonRecord;

  const sreqs = (sreqList?.data ?? []).map((row) => {
    const customer = (row.customer ?? {}) as JsonRecord;
    const so = (row.salesOrder ?? {}) as JsonRecord;
    return {
      id: String(row.id ?? ""),
      requestNumber: String(row.requestNumber ?? ""),
      status: String(row.status ?? ""),
      total: num(row.total),
      customerName: String(customer.name ?? "—"),
      createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
      salesOrderId: typeof so.id === "string" ? so.id : undefined,
    };
  });

  const orders = (orderList?.data ?? []).map((row) => {
    const customer = (row.customer ?? {}) as JsonRecord;
    return {
      id: String(row.id ?? ""),
      orderNumber: String(row.orderNumber ?? ""),
      status: String(row.status ?? ""),
      total: num(row.total),
      customerName: String(customer.name ?? "—"),
      createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
    };
  });

  const tasks = (taskList?.data ?? []).slice(0, 12).map((row) => {
    const order = (row.order ?? {}) as JsonRecord;
    return {
      id: String(row.id ?? ""),
      title: String(row.title ?? row.action ?? "Task"),
      status: String(row.status ?? ""),
      action: String(row.action ?? ""),
      salesOrderId: typeof row.salesOrderId === "string" ? row.salesOrderId : undefined,
      orderNumber: typeof order.orderNumber === "string" ? order.orderNumber : undefined,
      dueAt: typeof row.dueAt === "string" ? row.dueAt : undefined,
    };
  });

  const customers = (customerList?.data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? "—"),
    email: typeof row.email === "string" ? row.email : undefined,
    phone: typeof row.phone === "string" ? row.phone : undefined,
  }));

  const products = (productList?.data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? "—"),
    sku: typeof row.sku === "string" ? row.sku : undefined,
  }));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const priceLists = (priceList?.data ?? []).map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? "—"),
    isDefault: Boolean(row.isDefault),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  }));
  const priceUpdates = priceLists.filter((p) => p.updatedAt && Date.parse(p.updatedAt) >= weekAgo)
    .length;

  const openTasks = num(taskMeta.pending) + num(taskMeta.inProgress);
  const activity = [
    ...sreqs.slice(0, 4).map((s) => ({
      id: `sreq-${s.id}`,
      kind: "sreq",
      title: s.requestNumber || "Sales request",
      subtitle: `${s.status} · ${s.customerName}`,
      href: `/admin/sales-desk?sreqId=${encodeURIComponent(s.id)}`,
      at: s.createdAt,
    })),
    ...orders.slice(0, 3).map((o) => ({
      id: `so-${o.id}`,
      kind: "order",
      title: o.orderNumber || "Sales order",
      subtitle: `${o.status} · ${o.customerName}`,
      href: `/admin/sales-desk?salesOrderId=${encodeURIComponent(o.id)}`,
      at: o.createdAt,
    })),
    ...tasks.slice(0, 3).map((t) => ({
      id: `task-${t.id}`,
      kind: "task",
      title: t.title,
      subtitle: t.orderNumber ? `${t.status} · ${t.orderNumber}` : t.status,
      href: t.salesOrderId
        ? `/admin/sales-desk?salesOrderId=${encodeURIComponent(t.salesOrderId)}`
        : "/admin/sales-desk",
      at: t.dueAt,
    })),
  ];

  return NextResponse.json({
    data: {
      kpis: {
        revenue: num(salesSummary.revenue),
        salesOrders: num(salesSummary.totalOrders),
        sreqs: num(sreqList?.meta?.total),
        sreqsOpen: num(sreqOpen?.meta?.total),
        openTasks,
        customers: num(customerList?.meta?.total),
        todaySales: num(todaySummary.revenue),
        mySreqs: num(sreqOpen?.meta?.total),
        myOrders: num(orderList?.meta?.total),
        myTasks: openTasks,
        priceLists: num(priceList?.meta?.total),
        priceUpdates,
        priceRequests: 0,
        pendingDispatches: statusCount(deliveryByStatus, "ASSIGNED"),
        todayDispatches: num(todayDeliverySummary.deliveredCount),
        delayedOrders: num(deliverySummary.failedCount),
        outForDelivery:
          statusCount(deliveryByStatus, "PICKED_UP") + statusCount(deliveryByStatus, "ACCEPTED"),
        deliveredToday: num(todayDeliverySummary.deliveredCount),
        delayedDeliveries: num(todayDeliverySummary.failedCount) || num(deliverySummary.failedCount),
        pendingInvoices: num(invoices.count),
        receivables: num(invoices.outstanding),
        payments: num(invoices.paymentTotal),
        products: num(productList?.meta?.total),
        categories: num(categoryList?.meta?.total),
        brands: num(brandList?.meta?.total),
        attributes: Array.isArray(attrList?.data) ? attrList.data.length : 0,
      },
      activity,
      sreqs,
      orders,
      tasks,
      customers,
      priceLists,
      products,
    },
  });
}

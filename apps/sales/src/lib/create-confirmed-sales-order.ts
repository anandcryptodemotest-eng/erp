import { serviceClient } from "@erp/config";
import { createLogger } from "@erp/logger";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { normalizeCustomerPhone } from "@/lib/customer-phone";
import { getDefaultWorkflow } from "@/lib/order-workflow";
import {
  applyInventoryTaxRates,
  computeTotals,
  type ResolvedLine,
} from "@/lib/order-lines";
import { startSalesOrderWorkflowV5, getPublishedDefinition } from "@/lib/workflow-runtime-v5";
import {
  assertFulfilmentSource,
  FulfilmentSourceError,
  type FulfilmentSource,
  type FulfilmentSourceInput,
} from "@/lib/fulfilment-source";

const log = createLogger({ service: "sales" });

const orderInclude = {
  items: true,
  customer: { select: { id: true, name: true, portalUserId: true, isBlocked: true, blockedReason: true, creditLimit: true } },
  salesRequest: { select: { id: true, requestNumber: true, status: true } },
} satisfies Prisma.SalesOrderInclude;

export class CreateConfirmedSalesOrderError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body: Record<string, unknown>;

  constructor(message: string, status: number, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "CreateConfirmedSalesOrderError";
    this.status = status;
    this.code = typeof extra.code === "string" ? extra.code : undefined;
    this.body = { error: message, ...extra };
  }
}

export type ConfirmedOrderLine = {
  productId: string;
  productName: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxTreatment: string;
  total: number;
  customSnapshot?: Prisma.InputJsonValue;
};

export type CreateConfirmedSalesOrderInput = FulfilmentSourceInput & {
  tenantId: string;
  userId: string;
  warehouseId?: string | null;
  notes?: string | null;
  items?: Array<{
    productId: string;
    productName?: string;
    name?: string;
    variantId?: string | null;
    quantity?: number;
    qty?: number;
    unitPrice: number;
  }>;
};

export type CreateConfirmedSalesOrderResult = {
  alreadyExisted: boolean;
  order: Prisma.SalesOrderGetPayload<{ include: typeof orderInclude }>;
};

async function nextOrderNumber(tenantId: string, tx: { salesOrder: { count: typeof prisma.salesOrder.count } }) {
  const count = await tx.salesOrder.count({ where: { tenantId } });
  return `SO-${String(count + 1).padStart(5, "0")}`;
}

async function resolveWarehouseId(tenantId: string, userId: string, preferred?: string | null) {
  if (preferred) return preferred;
  const warehouses = await serviceClient.call<{ data?: { id: string }[] } | { id: string }[]>(
    "inventory",
    "/api/warehouses?limit=1",
    { method: "GET", tenantId, userId }
  );
  const whBody = warehouses.data;
  return Array.isArray(whBody)
    ? whBody[0]?.id
    : whBody && "data" in whBody
      ? whBody.data?.[0]?.id
      : undefined;
}

async function assertCredit(opts: {
  tenantId: string;
  userId: string;
  customerId: string;
  creditLimit: number;
  additionalAmount: number;
}) {
  if (opts.creditLimit <= 0) return;
  const credit = await serviceClient.call<{
    data: { outstanding: number; projected: number };
  }>("accounting", "/api/ar/credit-check", {
    method: "POST",
    tenantId: opts.tenantId,
    userId: opts.userId,
    body: { customerId: opts.customerId, additionalAmount: opts.additionalAmount },
  });
  const projected = credit.data?.data?.projected;
  const outstanding = credit.data?.data?.outstanding;
  if (typeof projected === "number" && projected > opts.creditLimit) {
    throw new CreateConfirmedSalesOrderError(
      `Credit limit exceeded: outstanding ₹${outstanding ?? 0} + order would be ₹${projected} (limit ₹${opts.creditLimit})`,
      403,
      { code: "CREDIT_LIMIT", outstanding, projected, limit: opts.creditLimit }
    );
  }
}

function linesFromResolved(items: ResolvedLine[]): ConfirmedOrderLine[] {
  return items.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    variantId: i.variantId,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    taxRate: i.taxRate,
    taxTreatment: i.taxTreatment,
    total: i.total,
    customSnapshot: i.customSnapshot as Prisma.InputJsonValue | undefined,
  }));
}

async function reserveStock(opts: {
  tenantId: string;
  userId: string;
  orderId: string;
  warehouseId?: string;
  items: { productId: string; variantId?: string | null; quantity: number }[];
}) {
  if (!opts.warehouseId || !opts.items.length) return;
  const reserve = await serviceClient.call("inventory", "/api/stock/reserve", {
    method: "POST",
    tenantId: opts.tenantId,
    userId: opts.userId,
    body: {
      reference: opts.orderId,
      items: opts.items.map((item) => ({
        productId: item.productId,
        warehouseId: opts.warehouseId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
      })),
    },
  });
  if (reserve.status !== 201 && reserve.status !== 200) {
    log.warn("confirmed_so_stock_reserve_failed", {
      tenantId: opts.tenantId,
      orderId: opts.orderId,
      status: reserve.status,
      error: reserve.error,
    });
  }
}

async function startWorkflow(opts: {
  tenantId: string;
  orderId: string;
  workflowId: string;
  orderStatus: string;
}) {
  await startSalesOrderWorkflowV5({
    tenantId: opts.tenantId,
    salesOrderId: opts.orderId,
    workflowId: opts.workflowId,
    orderStatus: opts.orderStatus,
  });
}

async function createOrderRow(opts: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  userId: string;
  customerId: string;
  sourceKind: FulfilmentSource["sourceKind"];
  quoteId?: string;
  warehouseId?: string;
  workflowId: string;
  notes?: string | null;
  items: ConfirmedOrderLine[];
  subtotal: number;
  tax: number;
  total: number;
  isOnlineOrder?: boolean;
  deliveryAddressId?: string | null;
  deliveryAddressText?: string | null;
  deliveryFee?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  couponId?: string | null;
  couponDiscount?: number;
  remarks: string;
  oldValue: string;
}) {
  const orderNumber = await nextOrderNumber(opts.tenantId, opts.tx);
  return opts.tx.salesOrder.create({
    data: {
      tenantId: opts.tenantId,
      orderNumber,
      customerId: opts.customerId,
      userId: opts.userId,
      quoteId: opts.quoteId,
      warehouseId: opts.warehouseId,
      workflowId: opts.workflowId,
      date: new Date(),
      status: "CONFIRMED",
      sourceKind: opts.sourceKind,
      isOnlineOrder: opts.isOnlineOrder ?? false,
      deliveryAddressId: opts.deliveryAddressId,
      deliveryAddressText: opts.deliveryAddressText,
      deliveryFee: opts.deliveryFee ?? 0,
      paymentMethod: opts.paymentMethod ?? "COD",
      paymentStatus: opts.paymentStatus ?? "PENDING",
      couponId: opts.couponId,
      couponDiscount: opts.couponDiscount ?? 0,
      subtotal: opts.subtotal,
      tax: opts.tax,
      total: opts.total,
      notes: opts.notes,
      items: {
        create: opts.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
          taxTreatment: i.taxTreatment,
          total: i.total,
          customSnapshot: i.customSnapshot,
        })),
      },
      modifications: {
        create: {
          tenantId: opts.tenantId,
          userId: opts.userId,
          action: "STATUS_CHANGE",
          field: "status",
          oldValue: opts.oldValue,
          newValue: "CONFIRMED",
          remarks: opts.remarks,
        },
      },
    },
    include: orderInclude,
  });
}

/**
 * Canonical fulfilment-bound SO builder. All capture channels (SREQ, Walk-in, Quote)
 * must enter here. Quick Bill must not.
 */
export async function createConfirmedSalesOrder(
  input: CreateConfirmedSalesOrderInput
): Promise<CreateConfirmedSalesOrderResult> {
  const source = assertFulfilmentSource(input);
  const { tenantId, userId } = input;

  const published = await getPublishedDefinition(tenantId);
  const defaultWf = await getDefaultWorkflow(tenantId);
  if (!published || !defaultWf?.id) {
    throw new CreateConfirmedSalesOrderError(
      "No published SO_STANDARD workflow template. Open Configuration → Workflows and publish before creating orders.",
      409
    );
  }

  const warehouseId = await resolveWarehouseId(tenantId, userId, input.warehouseId);

  if (source.sourceKind === "SREQ") {
    return createFromSreq({ tenantId, userId, source, warehouseId, workflowId: defaultWf.id });
  }
  if (source.sourceKind === "QUOTE") {
    return createFromQuote({ tenantId, userId, source, warehouseId, workflowId: defaultWf.id, notes: input.notes });
  }
  return createFromWalkIn({
    tenantId,
    userId,
    source,
    warehouseId,
    workflowId: defaultWf.id,
    notes: input.notes,
    rawItems: input.items,
  });
}

async function createFromSreq(opts: {
  tenantId: string;
  userId: string;
  source: Extract<FulfilmentSource, { sourceKind: "SREQ" }>;
  warehouseId?: string;
  workflowId: string;
}): Promise<CreateConfirmedSalesOrderResult> {
  const { tenantId, userId, source, warehouseId, workflowId } = opts;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT id FROM "SalesRequest"
      WHERE id = ${source.salesRequestId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;

    const sreq = await tx.salesRequest.findFirst({
      where: { id: source.salesRequestId, tenantId },
      include: { items: true, customer: true, documents: true },
    });
    if (!sreq) {
      throw new CreateConfirmedSalesOrderError("Sales request not found", 404);
    }

    if (sreq.salesOrderId) {
      const existing = await tx.salesOrder.findFirst({
        where: { id: sreq.salesOrderId, tenantId },
        include: orderInclude,
      });
      if (!existing) {
        throw new CreateConfirmedSalesOrderError("Request already converted", 409);
      }
      return { alreadyExisted: true as const, order: existing, sreq };
    }

    if (sreq.status !== "OPEN") {
      throw new CreateConfirmedSalesOrderError(`Request is ${sreq.status}, cannot convert`, 409);
    }
    if (sreq.customer.isBlocked) {
      throw new CreateConfirmedSalesOrderError(
        `Customer is blocked: ${sreq.customer.blockedReason ?? "contact support"}`,
        403
      );
    }

    await assertCredit({
      tenantId,
      userId,
      customerId: sreq.customerId,
      creditLimit: sreq.customer.creditLimit,
      additionalAmount: sreq.total,
    });

    const items: ConfirmedOrderLine[] = sreq.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      variantId: i.variantId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      taxTreatment: i.taxTreatment,
      total: i.total,
      customSnapshot: (i.customSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
    }));

    const order = await createOrderRow({
      tx,
      tenantId,
      userId,
      customerId: sreq.customerId,
      sourceKind: "SREQ",
      warehouseId,
      workflowId,
      notes: sreq.notes,
      items,
      subtotal: sreq.subtotal,
      tax: sreq.tax,
      total: sreq.total,
      isOnlineOrder: sreq.isOnlineOrder,
      deliveryAddressId: sreq.deliveryAddressId,
      deliveryAddressText: sreq.deliveryAddressText,
      deliveryFee: sreq.deliveryFee,
      paymentMethod: sreq.paymentMethod,
      paymentStatus: sreq.paymentStatus,
      couponId: sreq.couponId,
      couponDiscount: sreq.couponDiscount,
      remarks: `Converted from ${sreq.requestNumber}`,
      oldValue: "SREQ",
    });

    await tx.salesRequest.update({
      where: { id: sreq.id },
      data: {
        status: "CONVERTED",
        salesOrderId: order.id,
        convertedAt: new Date(),
        convertedBy: userId,
      },
    });

    // Buyer checkout attachments → SO Attachments widget
    for (const doc of sreq.documents) {
      await tx.orderDocument.create({
        data: {
          tenantId,
          salesOrderId: order.id,
          type: "OTHER",
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          mimeType: doc.mimeType,
          uploadedBy: doc.uploadedBy,
        },
      });
    }

    // Buyer checkout note → desk Notes widget (SO.notes already set from sreq.notes)
    const buyerNote = String(sreq.notes ?? "").trim();
    if (buyerNote) {
      await tx.orderNote.create({
        data: {
          tenantId,
          salesOrderId: order.id,
          body: buyerNote,
          authorUserId: sreq.userId,
          authorRole: "CUSTOMER",
          sourceStep: "customer-checkout",
        },
      });
    }

    return { alreadyExisted: false as const, order, sreq };
  });

  if (!result.alreadyExisted) {
    await reserveStock({
      tenantId,
      userId,
      orderId: result.order.id,
      warehouseId,
      items: result.order.items,
    });
    await startWorkflow({
      tenantId,
      orderId: result.order.id,
      workflowId,
      orderStatus: result.order.status,
    });
  }

  return { alreadyExisted: result.alreadyExisted, order: result.order };
}

async function createFromQuote(opts: {
  tenantId: string;
  userId: string;
  source: Extract<FulfilmentSource, { sourceKind: "QUOTE" }>;
  warehouseId?: string;
  workflowId: string;
  notes?: string | null;
}): Promise<CreateConfirmedSalesOrderResult> {
  const { tenantId, userId, source, warehouseId, workflowId } = opts;

  const existing = await prisma.salesOrder.findFirst({
    where: { tenantId, quoteId: source.quoteId },
    include: orderInclude,
  });
  if (existing) {
    return { alreadyExisted: true, order: existing };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: source.quoteId, tenantId, isActive: true },
    include: { items: true, customer: true },
  });
  if (!quote) {
    throw new CreateConfirmedSalesOrderError("Quote not found", 404);
  }
  if (quote.status !== "ACCEPTED") {
    throw new CreateConfirmedSalesOrderError(`Quote is ${quote.status}, only ACCEPTED quotes can convert`, 409);
  }
  if (quote.customer.isBlocked) {
    throw new CreateConfirmedSalesOrderError(
      `Customer is blocked: ${quote.customer.blockedReason ?? "contact support"}`,
      403
    );
  }

  const normalized = quote.items.map((i) => {
    const net = i.unitPrice * (1 - (i.discount ?? 0) / 100);
    return {
      productId: i.productId,
      productName: i.productName,
      variantId: i.variantId ?? undefined,
      quantity: i.quantity,
      unitPrice: net,
      total: i.quantity * net,
    };
  });
  const resolved = await applyInventoryTaxRates(normalized, { tenantId, userId });
  const items = linesFromResolved(resolved);
  const totals = computeTotals(resolved);

  await assertCredit({
    tenantId,
    userId,
    customerId: quote.customerId,
    creditLimit: quote.customer.creditLimit,
    additionalAmount: totals.total,
  });

  const order = await prisma.$transaction(async (tx) => {
    const raced = await tx.salesOrder.findFirst({
      where: { tenantId, quoteId: source.quoteId },
      include: orderInclude,
    });
    if (raced) return { alreadyExisted: true as const, order: raced };

    const created = await createOrderRow({
      tx,
      tenantId,
      userId,
      customerId: quote.customerId,
      sourceKind: "QUOTE",
      quoteId: quote.id,
      warehouseId,
      workflowId,
      notes: opts.notes ?? quote.notes,
      items,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      remarks: `Converted from ${quote.quoteNumber}`,
      oldValue: "QUOTE",
    });
    return { alreadyExisted: false as const, order: created };
  });

  if (!order.alreadyExisted) {
    await reserveStock({
      tenantId,
      userId,
      orderId: order.order.id,
      warehouseId,
      items: order.order.items,
    });
    await startWorkflow({
      tenantId,
      orderId: order.order.id,
      workflowId,
      orderStatus: order.order.status,
    });
  }

  return { alreadyExisted: order.alreadyExisted, order: order.order };
}

async function createFromWalkIn(opts: {
  tenantId: string;
  userId: string;
  source: Extract<FulfilmentSource, { sourceKind: "WALK_IN" }>;
  warehouseId?: string;
  workflowId: string;
  notes?: string | null;
  rawItems?: CreateConfirmedSalesOrderInput["items"];
}): Promise<CreateConfirmedSalesOrderResult> {
  const { tenantId, userId, source, warehouseId, workflowId } = opts;
  if (!opts.rawItems?.length) {
    throw new CreateConfirmedSalesOrderError("WALK_IN requires at least one line item", 400);
  }

  let customerId = source.customerId;
  if (!customerId) {
    const name = source.walkInName ?? "Walk-in Customer";
    const created = await prisma.customer.create({
      data: {
        tenantId,
        name,
        phone: source.walkInPhone,
        phoneNormalized: normalizeCustomerPhone(source.walkInPhone),
        customerGroup: "WALK_IN",
      },
    });
    customerId = created.id;
  }

  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) {
    throw new CreateConfirmedSalesOrderError("Customer not found", 404);
  }
  if (customer.isBlocked) {
    throw new CreateConfirmedSalesOrderError(
      `Customer is blocked: ${customer.blockedReason ?? "contact support"}`,
      403
    );
  }

  const normalized = opts.rawItems.map((item) => {
    const quantity = item.quantity ?? item.qty;
    const productName = item.productName ?? item.name;
    if (!quantity || !productName) {
      throw new CreateConfirmedSalesOrderError("Each item needs productName/name and quantity/qty", 400);
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
  const resolved = await applyInventoryTaxRates(normalized, { tenantId, userId });
  const items = linesFromResolved(resolved);
  const totals = computeTotals(resolved);

  await assertCredit({
    tenantId,
    userId,
    customerId,
    creditLimit: customer.creditLimit,
    additionalAmount: totals.total,
  });

  const order = await prisma.$transaction(async (tx) =>
    createOrderRow({
      tx,
      tenantId,
      userId,
      customerId,
      sourceKind: "WALK_IN",
      warehouseId,
      workflowId,
      notes: opts.notes,
      items,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      remarks: "Walk-in counter order",
      oldValue: "WALK_IN",
    })
  );

  await reserveStock({
    tenantId,
    userId,
    orderId: order.id,
    warehouseId,
    items: order.items,
  });
  await startWorkflow({
    tenantId,
    orderId: order.id,
    workflowId,
    orderStatus: order.status,
  });

  return { alreadyExisted: false, order };
}

export function jsonError(error: unknown) {
  if (error instanceof FulfilmentSourceError) {
    return { body: { error: error.message }, status: error.status };
  }
  if (error instanceof CreateConfirmedSalesOrderError) {
    return { body: error.body, status: error.status };
  }
  throw error;
}

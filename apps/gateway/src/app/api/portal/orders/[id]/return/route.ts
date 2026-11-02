import { NextResponse } from "next/server";
import { portalSales, resolvePortalTenantId } from "@/lib/portal-upstream";

type Ctx = { params: Promise<{ id: string }> };

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
};

/**
 * POST /api/portal/orders/:id/return — buyer-initiated return request.
 *
 * Body: { reason?, notes?, items: [{ productId, quantity } | { orderItemId, quantity }] }.
 * We resolve the order's lines (to map productId -> orderItemId/unitPrice), then
 * create a PENDING SalesReturn via the sales service as the CUSTOMER — which feeds
 * the existing staff approve → complete (restock + credit note) flow.
 */
export async function POST(request: Request, { params }: Ctx) {
  const tenantId = await resolvePortalTenantId(request);
  const userId = request.headers.get("x-user-id");
  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Sign in to request a return" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    reason?: string;
    notes?: string;
    items?: { productId?: string; orderItemId?: string; quantity?: number }[];
  };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Select at least one item to return" }, { status: 400 });
  }

  // Fetch the order (as the customer) to map lines + verify ownership happens in sales.
  const orderRes = await portalSales<{ data?: { items?: OrderItem[] } }>(
    tenantId,
    `/api/orders/${encodeURIComponent(id)}`,
    { headers: { "x-user-id": userId, "x-user-role": "CUSTOMER" } }
  );
  const orderItems = orderRes.json?.data?.items ?? [];
  if (orderRes.status !== 200 || orderItems.length === 0) {
    return NextResponse.json({ error: "Order not found" }, { status: orderRes.status === 200 ? 404 : orderRes.status });
  }

  // Resolve each requested line against the order.
  const items: {
    orderItemId: string;
    productId: string;
    productName: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
  }[] = [];
  for (const req of body.items) {
    const qty = Number(req.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const match = req.orderItemId
      ? orderItems.find((o) => o.id === req.orderItemId)
      : orderItems.find((o) => o.productId === req.productId);
    if (!match) {
      return NextResponse.json({ error: `Item not on this order: ${req.productId ?? req.orderItemId}` }, { status: 400 });
    }
    items.push({
      orderItemId: match.id,
      productId: match.productId,
      productName: match.productName,
      variantId: match.variantId ?? undefined,
      quantity: qty,
      unitPrice: match.unitPrice,
    });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "No valid return items" }, { status: 400 });
  }

  const created = await portalSales<{ data?: unknown; error?: string }>(
    tenantId,
    "/api/returns",
    {
      method: "POST",
      headers: { "x-user-id": userId, "x-user-role": "CUSTOMER" },
      body: JSON.stringify({ orderId: id, reason: body.reason, notes: body.notes, items }),
    }
  );
  if (created.status >= 400) {
    return NextResponse.json({ error: created.json?.error ?? "Return request failed" }, { status: created.status });
  }
  return NextResponse.json(created.json, { status: 201 });
}

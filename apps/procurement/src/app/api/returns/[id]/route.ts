import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";
import { z } from "zod";

const dispatchSchema = z.object({
  warehouseId: z.string(),
  notes: z.string().optional(),
});

// GET /api/returns/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const purchaseReturn = await prisma.purchaseReturn.findFirst({
    where: { id, tenantId },
    include: {
      order: { select: { id: true, orderNumber: true } },
      vendor: true,
      items: true,
    },
  });

  if (!purchaseReturn) return NextResponse.json({ error: "Purchase return not found" }, { status: 404 });
  return NextResponse.json({ data: purchaseReturn });
}

// PATCH /api/returns/:id?action=approve|reject|dispatch
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId || !userId) return NextResponse.json({ error: "Auth context required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  const purchaseReturn = await prisma.purchaseReturn.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
  if (!purchaseReturn) return NextResponse.json({ error: "Purchase return not found" }, { status: 404 });

  try {
    if (action === "approve") {
      if (purchaseReturn.status !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING returns can be approved" }, { status: 409 });
      }
      const updated = await prisma.purchaseReturn.update({ where: { id }, data: { status: "APPROVED" } });
      return NextResponse.json({ data: updated });
    }

    if (action === "reject") {
      if (purchaseReturn.status !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING returns can be rejected" }, { status: 409 });
      }
      const updated = await prisma.purchaseReturn.update({ where: { id }, data: { status: "REJECTED" } });
      return NextResponse.json({ data: updated });
    }

    if (action === "dispatch") {
      if (purchaseReturn.status !== "APPROVED") {
        return NextResponse.json({ error: "Only APPROVED returns can be dispatched" }, { status: 409 });
      }

      const body = await request.json();
      const { warehouseId, notes } = dispatchSchema.parse(body);

      // Deduct stock from inventory (items are leaving the warehouse back to vendor)
      const deductPayload = {
        items: purchaseReturn.items.map((item) => ({
          productId: item.productId,
          warehouseId,
          variantId: item.variantId ?? undefined,
          quantity: item.quantity,
        })),
        reference: `PR-${purchaseReturn.id}`,
        notes: notes ?? `Purchase return ${purchaseReturn.returnNumber} dispatched to vendor`,
      };

      const deductResult = await serviceClient.call("inventory", "/api/stock/deduct", {
        method: "POST",
        body: deductPayload,
        tenantId,
        userId,
      });

      if (deductResult.status !== 201) {
        const errBody = deductResult.data as { error?: string } | undefined;
        return NextResponse.json({ error: errBody?.error ?? "Stock deduction failed" }, { status: 500 });
      }

      const updated = await prisma.purchaseReturn.update({ where: { id }, data: { status: "DISPATCHED" } });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use ?action=approve|reject|dispatch" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

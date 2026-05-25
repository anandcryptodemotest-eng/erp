import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serviceClient } from "@erp/config";
import { z } from "zod";

const approveSchema = z.object({
  warehouseId: z.string(),
});

// GET /api/returns/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const salesReturn = await prisma.salesReturn.findFirst({
    where: { id, tenantId },
    include: {
      order: { select: { id: true, orderNumber: true } },
      customer: true,
      items: true,
    },
  });

  if (!salesReturn) return NextResponse.json({ error: "Sales return not found" }, { status: 404 });
  return NextResponse.json({ data: salesReturn });
}

// PATCH /api/returns/:id?action=approve|reject|complete
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

  const salesReturn = await prisma.salesReturn.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
  if (!salesReturn) return NextResponse.json({ error: "Sales return not found" }, { status: 404 });

  try {
    if (action === "approve") {
      if (salesReturn.status !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING returns can be approved" }, { status: 409 });
      }
      const updated = await prisma.salesReturn.update({ where: { id }, data: { status: "APPROVED" } });
      return NextResponse.json({ data: updated });
    }

    if (action === "reject") {
      if (salesReturn.status !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING returns can be rejected" }, { status: 409 });
      }
      const updated = await prisma.salesReturn.update({ where: { id }, data: { status: "REJECTED" } });
      return NextResponse.json({ data: updated });
    }

    if (action === "complete") {
      if (salesReturn.status !== "APPROVED") {
        return NextResponse.json({ error: "Only APPROVED returns can be completed" }, { status: 409 });
      }

      const body = await request.json();
      const { warehouseId } = approveSchema.parse(body);

      // Restock inventory
      const receivePayload = {
        items: salesReturn.items.map((item) => ({
          productId: item.productId,
          warehouseId,
          variantId: item.variantId ?? undefined,
          quantity: item.quantity,
        })),
        reference: `SR-${salesReturn.id}`,
        notes: `Sales return ${salesReturn.returnNumber} restocked`,
      };

      const receiveResult = await serviceClient.call("inventory", "/api/stock/receive", {
        method: "POST",
        body: receivePayload,
        tenantId,
        userId,
      });

      if (receiveResult.status !== 201) {
        const errBody = receiveResult.data as { error?: string } | undefined;
        return NextResponse.json({ error: errBody?.error ?? "Stock restock failed" }, { status: 500 });
      }

      const updated = await prisma.salesReturn.update({ where: { id }, data: { status: "COMPLETED" } });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Invalid action. Use ?action=approve|reject|complete" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

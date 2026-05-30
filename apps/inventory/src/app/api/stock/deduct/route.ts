import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const deductSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    warehouseId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().positive(), // Float supports kg-based selling (e.g. 0.75 kg)
  })).min(1),
  reference: z.string().min(1),
  notes: z.string().optional(),
});

// POST /api/stock/deduct — deduct stock and release reservation on shipment
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const { items, reference, notes } = deductSchema.parse(body);

    const movements = await prisma.$transaction(async (tx) => {
      const ms = [];
      for (const item of items) {
        // Release reservation for this item
        await tx.stockReservation.updateMany({
          where: { tenantId, reference, productId: item.productId, warehouseId: item.warehouseId, isReleased: false },
          data: { isReleased: true },
        });

        // Guard against underflow
        const current = await tx.warehouseStock.findFirst({
          where: { tenantId, productId: item.productId, warehouseId: item.warehouseId },
          select: { quantity: true },
        });
        if (!current || current.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }

        // Deduct stock
        await tx.warehouseStock.update({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
          data: { tenantId, quantity: { decrement: item.quantity } },
        });

        // Record movement
        const m = await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            variantId: item.variantId,
            type: "OUT",
            quantity: item.quantity,
            reference,
            notes,
          },
        });
        ms.push(m);
      }
      return ms;
    });

    return NextResponse.json({ data: movements }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

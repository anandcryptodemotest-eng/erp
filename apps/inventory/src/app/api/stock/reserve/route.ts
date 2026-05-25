import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const reserveSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    warehouseId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
  })).min(1),
  reference: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

// POST /api/stock/reserve — called by sales service when order is confirmed
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const { items, reference, expiresAt } = reserveSchema.parse(body);

    // Check available stock (stock - existing reservations) for each item
    for (const item of items) {
      const stock = await prisma.warehouseStock.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
      });
      const currentQty = stock?.quantity ?? 0;

      const existingReservations = await prisma.stockReservation.aggregate({
        where: { productId: item.productId, warehouseId: item.warehouseId, isReleased: false, tenantId },
        _sum: { reservedQty: true },
      });
      const reserved = existingReservations._sum.reservedQty ?? 0;
      const available = currentQty - reserved;

      if (available < item.quantity) {
        const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { sku: true } });
        return NextResponse.json(
          { error: `Insufficient stock for product ${product?.sku ?? item.productId}: available ${available}, requested ${item.quantity}` },
          { status: 409 }
        );
      }
    }

    // Create reservations and movements in a transaction
    const reservations = await prisma.$transaction(
      items.map((item) =>
        prisma.stockReservation.create({
          data: {
            tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            variantId: item.variantId,
            reservedQty: item.quantity,
            reference,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        })
      )
    );

    return NextResponse.json({ data: reservations }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

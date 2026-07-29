import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const log = createLogger({ service: "inventory" });

const receiveSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    warehouseId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().positive(), // Float supports kg-based receiving (e.g. 50.5 kg)
  })).min(1),
  reference: z.string().min(1),
  notes: z.string().optional(),
});

// POST /api/stock/receive — add stock when PO is received or return is restocked
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const { items, reference, notes } = receiveSchema.parse(body);

    const movements = await prisma.$transaction(async (tx) => {
      const ms = [];
      for (const item of items) {
        await tx.warehouseStock.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
          update: { quantity: { increment: item.quantity } },
          create: { tenantId, productId: item.productId, warehouseId: item.warehouseId, quantity: item.quantity },
        });

        const m = await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            variantId: item.variantId,
            type: "IN",
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
    const msg = error instanceof Error ? error.message : "Internal server error";
    // Common: warehouse/product FK missing after catalog wipe
    if (/Foreign key constraint|WarehouseStock_warehouseId|WarehouseStock_productId/i.test(msg)) {
      return NextResponse.json(
        { error: "Invalid warehouse or product. Create a warehouse first, then receive stock." },
        { status: 400 }
      );
    }
    log.error("stock_receive", { err: error });
    return NextResponse.json({ error: msg || "Internal server error" }, { status: 500 });
  }
}

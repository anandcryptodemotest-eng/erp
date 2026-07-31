import { createLogger } from "@erp/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  assertVariantStockScope,
  normalizeVariantId,
  upsertStockDelta,
} from "@/lib/warehouse-stock";

const log = createLogger({ service: "inventory" });

const receiveSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        warehouseId: z.string(),
        variantId: z.string().optional(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
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

    for (const item of items) {
      const scope = await assertVariantStockScope(prisma, {
        tenantId,
        productId: item.productId,
        variantId: item.variantId,
      });
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
    }

    const movements = await prisma.$transaction(async (tx) => {
      const ms = [];
      for (const item of items) {
        const variantId = normalizeVariantId(item.variantId);
        await upsertStockDelta(tx, {
          tenantId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          variantId,
          quantityDelta: item.quantity,
        });

        const m = await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            variantId,
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

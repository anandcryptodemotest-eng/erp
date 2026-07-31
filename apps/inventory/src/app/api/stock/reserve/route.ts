import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  createLogger,
  contextFromHeaders,
  runWithRequestContextAsync,
} from "@erp/logger";
import { withSpan, captureException } from "@erp/telemetry";
import {
  assertVariantStockScope,
  availableQty,
  normalizeVariantId,
} from "@/lib/warehouse-stock";

const log = createLogger({ service: "inventory" });

const reserveSchema = z.object({
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
  expiresAt: z.string().datetime().optional(),
});

// POST /api/stock/reserve — called by sales service when order is confirmed
export async function POST(request: Request) {
  const reqCtx = contextFromHeaders(request.headers, {
    service: "inventory",
    method: "POST",
    path: "/api/stock/reserve",
  });

  return runWithRequestContextAsync(reqCtx, async () =>
    withSpan("Inventory.Reserve", async () => {
      const tenantId = request.headers.get("x-tenant-id");
      if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

      try {
        const body = await request.json();
        const { items, reference, expiresAt } = reserveSchema.parse(body);

        for (const item of items) {
          const scope = await assertVariantStockScope(prisma, {
            tenantId,
            productId: item.productId,
            variantId: item.variantId,
          });
          if (!scope.ok) {
            return NextResponse.json({ error: scope.error }, { status: scope.status });
          }

          const { available } = await availableQty(prisma, {
            tenantId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            variantId: item.variantId,
          });

          if (available < item.quantity) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { sku: true },
            });
            const variant = item.variantId
              ? await prisma.productVariant.findUnique({
                  where: { id: item.variantId },
                  select: { sku: true },
                })
              : null;
            const label = variant?.sku ?? product?.sku ?? item.productId;
            return NextResponse.json(
              {
                error: `Insufficient stock for ${label}: available ${available}, requested ${item.quantity}`,
              },
              { status: 409 }
            );
          }
        }

        const reservations = await prisma.$transaction(
          items.map((item) =>
            prisma.stockReservation.create({
              data: {
                tenantId,
                productId: item.productId,
                warehouseId: item.warehouseId,
                variantId: normalizeVariantId(item.variantId),
                reservedQty: item.quantity,
                reference,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
              },
            })
          )
        );

        log.info("stock_reserved", { tenantId, reference, count: reservations.length });
        return NextResponse.json({ data: reservations }, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
        }
        captureException(error, { message: "stock_reserve_failed" });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    })
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const rowSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().default("pcs"),
  costPrice: z.coerce.number().nonnegative(),
  sellPrice: z.coerce.number().nonnegative(),
  reorderLevel: z.coerce.number().int().min(0).default(10),
  initialStock: z.coerce.number().int().min(0).default(0),
  warehouseId: z.string().optional(),
});

const importSchema = z.object({
  products: z.array(rowSchema).min(1).max(500),
});

// POST /api/products/import — bulk create products from CSV upload
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const { products } = importSchema.parse(body);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of products) {
      try {
        const existing = await prisma.product.findFirst({ where: { tenantId, sku: row.sku } });
        if (existing) { skipped++; continue; }

        const product = await prisma.product.create({
          data: {
            tenantId,
            sku: row.sku,
            name: row.name,
            unit: row.unit,
            costPrice: row.costPrice,
            sellPrice: row.sellPrice,
            reorderLevel: row.reorderLevel,
          },
        });
        created++;

        if (row.initialStock > 0) {
          const warehouseId = row.warehouseId ?? "seed-warehouse-main";
          await prisma.warehouseStock.upsert({
            where: { productId_warehouseId: { productId: product.id, warehouseId } },
            update: { quantity: { increment: row.initialStock } },
            create: { tenantId, productId: product.id, warehouseId, quantity: row.initialStock },
          });
          await prisma.stockMovement.create({
            data: { tenantId, productId: product.id, warehouseId, type: "IN", quantity: row.initialStock, reference: "CSV_IMPORT" },
          });
        }
      } catch {
        errors.push(`Row ${row.sku}: failed to create`);
      }
    }

    return NextResponse.json({ data: { created, skipped, errors, total: products.length } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

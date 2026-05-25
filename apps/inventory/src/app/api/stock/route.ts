import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const stockMovementSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  type: z.enum(["IN", "OUT", "TRANSFER", "ADJUSTMENT"]),
  quantity: z.number().int().positive(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/stock — Get stock levels
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const stocks = await prisma.warehouseStock.findMany({
    where: { product: { tenantId } },
    include: { product: true, warehouse: true },
  });

  return NextResponse.json({ data: stocks });
}

// POST /api/stock — Record stock movement
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  try {
    const body = await request.json();
    const data = stockMovementSchema.parse(body);

    // Create movement record
    const movement = await prisma.stockMovement.create({
      data: { ...data, tenantId },
    });

    // Update stock level
    const quantityChange = data.type === "OUT" ? -data.quantity : data.quantity;
    await prisma.warehouseStock.upsert({
      where: {
        productId_warehouseId: {
          productId: data.productId,
          warehouseId: data.warehouseId,
        },
      },
      update: { quantity: { increment: quantityChange } },
      create: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        quantity: quantityChange,
      },
    });

    // Check reorder level
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    const totalStock = await prisma.warehouseStock.aggregate({
      where: { productId: data.productId },
      _sum: { quantity: true },
    });

    if (product && (totalStock._sum.quantity ?? 0) <= product.reorderLevel) {
      // TODO: Emit STOCK_LOW event to procurement service
      console.log(`[ALERT] Stock low for product ${product.name}: ${totalStock._sum.quantity}/${product.reorderLevel}`);
    }

    return NextResponse.json({ data: movement }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

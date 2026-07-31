import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createVariantSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean()])),
  costPrice: z.number().nonnegative().nullable().optional(),
  sellPrice: z.number().nonnegative().nullable().optional(),
  barcode: z.string().optional(),
});

const generateSchema = z.object({
  /** Axis key → allowed values, e.g. { size: ["8x4","7x3"] } */
  axes: z.record(z.array(z.string().min(1)).min(1)).refine((o) => Object.keys(o).length > 0, {
    message: "At least one axis required",
  }),
  /** Optional SKU prefix; defaults to product.sku */
  skuPrefix: z.string().optional(),
  /** Optional per-variant cost */
  costPrice: z.number().nonnegative().nullable().optional(),
});

function cartesian(axes: Record<string, string[]>): Record<string, string>[] {
  const keys = Object.keys(axes);
  if (keys.length === 0) return [];
  return keys.reduce<Record<string, string>[]>(
    (acc, key) => {
      const values = axes[key];
      if (!acc.length) return values.map((v) => ({ [key]: v }));
      return acc.flatMap((row) => values.map((v) => ({ ...row, [key]: v })));
    },
    []
  );
}

function skuSuffix(attrs: Record<string, string>): string {
  return Object.values(attrs)
    .map((v) =>
      String(v)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 12)
    )
    .filter(Boolean)
    .join("-");
}

// GET /api/products/:id/variants
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, tenantId } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = { productId: id, tenantId, isActive: true };
  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      include: {
        stocks: {
          include: { warehouse: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.productVariant.count({ where }),
  ]);

  return NextResponse.json({ data: variants, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// POST /api/products/:id/variants — create one variant, or { generate: true, axes } to expand
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Generate combinations from axes
    if (body?.generate === true) {
      const gen = generateSchema.parse(body);
      const combos = cartesian(gen.axes);
      const axisKeys = Object.keys(gen.axes);
      const prefix = (gen.skuPrefix ?? product.sku).replace(/-$/, "");

      const created = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            productStructure: "VARIANT",
            variantAxes: axisKeys,
          },
        });

        const rows = [];
        for (const attrs of combos) {
          const suffix = skuSuffix(attrs);
          const sku = `${prefix}-${suffix}`.slice(0, 64);
          const name = `${product.name} ${Object.values(attrs).join(" / ")}`.slice(0, 200);
          const existing = await tx.productVariant.findFirst({
            where: { tenantId, sku },
          });
          if (existing) {
            if (!existing.isActive) {
              rows.push(
                await tx.productVariant.update({
                  where: { id: existing.id },
                  data: {
                    isActive: true,
                    name,
                    attributes: attrs,
                    costPrice: gen.costPrice ?? existing.costPrice,
                  },
                })
              );
            } else {
              rows.push(existing);
            }
            continue;
          }
          rows.push(
            await tx.productVariant.create({
              data: {
                tenantId,
                productId: id,
                sku,
                name,
                attributes: attrs,
                costPrice: gen.costPrice ?? null,
              },
            })
          );
        }
        return rows;
      });

      return NextResponse.json({ data: created, meta: { generated: created.length } }, { status: 201 });
    }

    const data = createVariantSchema.parse(body);
    const variant = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          productStructure: "VARIANT",
          ...(Object.keys(data.attributes).length
            ? {
                variantAxes: Array.from(
                  new Set([
                    ...((product.variantAxes as string[] | null) ?? []),
                    ...Object.keys(data.attributes),
                  ])
                ),
              }
            : {}),
        },
      });
      return tx.productVariant.create({
        data: {
          tenantId,
          productId: id,
          sku: data.sku,
          name: data.name,
          attributes: data.attributes,
          costPrice: data.costPrice ?? null,
          sellPrice: data.sellPrice ?? null,
          barcode: data.barcode,
        },
      });
    });
    return NextResponse.json({ data: variant }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Variant SKU already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

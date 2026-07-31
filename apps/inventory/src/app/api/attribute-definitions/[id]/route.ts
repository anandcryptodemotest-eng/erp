import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      regex: z.string().optional(),
      maxLength: z.number().int().positive().optional(),
    })
    .nullable()
    .optional(),
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isVariantAxis: z.boolean().optional(),
  isIdentity: z.boolean().optional(),
  showOnLabel: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  categoryIds: z.array(z.string()).optional(),
  /** Per-category SELECT lists — same key (e.g. size), different values per category */
  categoryOptions: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        options: z.array(z.string()).nullable(),
      })
    )
    .optional(),
});

// GET /api/attribute-definitions/:id
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const { id } = await params;
  const def = await prisma.productAttributeDefinition.findFirst({
    where: { id, tenantId },
    include: {
      categoryLinks: { include: { category: { select: { id: true, name: true } } } },
    },
  });
  if (!def) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: def });
}

// PATCH /api/attribute-definitions/:id  (key is immutable)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role && !["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.productAttributeDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    const { categoryIds, categoryOptions, ...rest } = parsed;

    if (categoryIds) {
      await prisma.attributeCategoryLink.deleteMany({ where: { attributeId: id, tenantId } });
      if (categoryIds.length) {
        await prisma.attributeCategoryLink.createMany({
          data: categoryIds.map((categoryId) => ({ tenantId, attributeId: id, categoryId })),
        });
      }
    }

    if (categoryOptions) {
      for (const row of categoryOptions) {
        const cat = await prisma.productCategory.findFirst({
          where: { id: row.categoryId, tenantId },
        });
        if (!cat) {
          return NextResponse.json({ error: `Category not found: ${row.categoryId}` }, { status: 400 });
        }
        await prisma.attributeCategoryLink.upsert({
          where: { attributeId_categoryId: { attributeId: id, categoryId: row.categoryId } },
          create: {
            tenantId,
            attributeId: id,
            categoryId: row.categoryId,
            optionsOverride: row.options ?? undefined,
          },
          update: { optionsOverride: row.options },
        });
      }
    }

    const def = await prisma.productAttributeDefinition.update({
      where: { id },
      data: {
        ...rest,
        options: rest.options === undefined ? undefined : rest.options,
        validation: rest.validation === undefined ? undefined : rest.validation,
      },
      include: {
        categoryLinks: { include: { category: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ data: def });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/attribute-definitions/:id — soft delete
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role && !["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.productAttributeDefinition.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const def = await prisma.productAttributeDefinition.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ data: def });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTemplate, INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { z } from "zod";

const applySchema = z.object({
  templateId: z.string().min(1),
  createCategories: z.boolean().default(true),
});

// GET /api/attribute-templates
export async function GET() {
  return NextResponse.json({
    data: INDUSTRY_TEMPLATES.map((t) => ({
      templateId: t.templateId,
      name: t.name,
      version: t.version,
      description: t.description,
      attributeCount: t.attributes.length,
      categories: t.categories.map((c) => c.name),
      attributes: t.attributes.map((a) => ({
        key: a.key,
        label: a.label,
        dataType: a.dataType,
      })),
    })),
  });
}

// POST /api/attribute-templates  { templateId, createCategories? }
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role && !["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { templateId, createCategories } = applySchema.parse(body);
    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Unknown template" }, { status: 404 });
    }

    const createdAttrs: string[] = [];
    const createdCats: string[] = [];
    const keyToId = new Map<string, string>();

    for (const attr of template.attributes) {
      const existing = await prisma.productAttributeDefinition.findUnique({
        where: { tenantId_key: { tenantId, key: attr.key } },
      });
      if (existing) {
        keyToId.set(attr.key, existing.id);
        if (attr.measureRole || attr.sizePattern || attr.measureUnit) {
          await prisma.productAttributeDefinition.update({
            where: { id: existing.id },
            data: {
              measureRole: attr.measureRole ?? existing.measureRole,
              measureUnit: attr.measureUnit ?? existing.measureUnit,
              sizePattern: attr.sizePattern ?? existing.sizePattern,
            },
          });
        }
        continue;
      }
      const def = await prisma.productAttributeDefinition.create({
        data: {
          tenantId,
          key: attr.key,
          label: attr.label,
          dataType: attr.dataType,
          unit: attr.unit,
          options: attr.options ?? undefined,
          validation: attr.validation ?? undefined,
          isRequired: attr.isRequired ?? false,
          isFilterable: attr.isFilterable ?? true,
          isSearchable: attr.isSearchable ?? false,
          isVariantAxis: attr.isVariantAxis ?? false,
          isIdentity: attr.isIdentity ?? false,
          showOnLabel: attr.showOnLabel ?? false,
          sortOrder: attr.sortOrder ?? 0,
          measureRole: attr.measureRole,
          measureUnit: attr.measureUnit ?? attr.unit,
          sizePattern: attr.sizePattern,
        },
      });
      keyToId.set(attr.key, def.id);
      createdAttrs.push(attr.key);
    }

    if (createCategories) {
      for (const cat of template.categories) {
        let category = await prisma.productCategory.findFirst({
          where: { tenantId, name: cat.name, isActive: true },
        });
        if (!category) {
          category = await prisma.productCategory.create({
            data: { tenantId, name: cat.name },
          });
          createdCats.push(cat.name);
        }

        for (const key of cat.attributeKeys) {
          const attributeId = keyToId.get(key);
          if (!attributeId) continue;
          const optionsOverride = cat.optionOverrides?.[key] ?? null;
          await prisma.attributeCategoryLink.upsert({
            where: {
              attributeId_categoryId: { attributeId, categoryId: category.id },
            },
            create: {
              tenantId,
              attributeId,
              categoryId: category.id,
              ...(optionsOverride ? { optionsOverride } : {}),
            },
            update: optionsOverride ? { optionsOverride } : {},
          });
        }
      }
    }

    return NextResponse.json({
      data: {
        templateId,
        createdAttributes: createdAttrs,
        createdCategories: createdCats,
        message: `Applied ${template.name}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

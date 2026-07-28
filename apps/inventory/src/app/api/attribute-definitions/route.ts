import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const dataTypes = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "UNIT_NUMBER",
] as const;

const createSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "key must be snake_case starting with a letter"),
  label: z.string().min(1),
  description: z.string().optional(),
  dataType: z.enum(dataTypes),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      regex: z.string().optional(),
      maxLength: z.number().int().positive().optional(),
    })
    .optional(),
  isRequired: z.boolean().default(false),
  isFilterable: z.boolean().default(true),
  isSearchable: z.boolean().default(false),
  isVariantAxis: z.boolean().default(false),
  showOnLabel: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  categoryIds: z.array(z.string()).optional(), // empty / omit = global
});

// GET /api/attribute-definitions?categoryId=
export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  // When creating/editing a product for a category, return defs with resolved per-category options
  if (categoryId) {
    const { resolveAttributeDefinitions } = await import("@/lib/attributes");
    const data = await resolveAttributeDefinitions(tenantId, categoryId);
    return NextResponse.json({ data });
  }

  const defs = await prisma.productAttributeDefinition.findMany({
    where: {
      tenantId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      categoryLinks: {
        include: { category: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return NextResponse.json({ data: defs });
}

// POST /api/attribute-definitions
export async function POST(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const role = request.headers.get("x-user-role");
  if (!tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 400 });
  if (role && !["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);

    if (
      (parsed.dataType === "SELECT" || parsed.dataType === "MULTI_SELECT") &&
      (!parsed.options || parsed.options.length === 0)
    ) {
      return NextResponse.json({ error: "options required for SELECT types" }, { status: 400 });
    }

    if (parsed.categoryIds?.length) {
      const count = await prisma.productCategory.count({
        where: { tenantId, id: { in: parsed.categoryIds } },
      });
      if (count !== parsed.categoryIds.length) {
        return NextResponse.json({ error: "One or more categories not found" }, { status: 400 });
      }
    }

    const { categoryIds, ...rest } = parsed;
    const def = await prisma.productAttributeDefinition.create({
      data: {
        ...rest,
        tenantId,
        options: rest.options ?? undefined,
        validation: rest.validation ?? undefined,
        categoryLinks: categoryIds?.length
          ? {
              create: categoryIds.map((categoryId) => ({
                tenantId,
                categoryId,
              })),
            }
          : undefined,
      },
      include: { categoryLinks: true },
    });

    return NextResponse.json({ data: def }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Attribute key already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { prisma } from "@/lib/prisma";

export type AttributeDataType =
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "SELECT"
  | "MULTI_SELECT"
  | "UNIT_NUMBER";

export type AttributeDefinition = {
  id: string;
  key: string;
  label: string;
  dataType: string;
  unit: string | null;
  options: unknown;
  validation: unknown;
  isRequired: boolean;
  isFilterable: boolean;
  isVariantAxis: boolean;
  showOnLabel: boolean;
  sortOrder: number;
};

type ValidationRules = {
  min?: number;
  max?: number;
  regex?: string;
  maxLength?: number;
};

/**
 * Resolve attribute definitions for a tenant + optional category.
 * Global defs (no category links) always apply; category-linked defs apply when category matches.
 */
export async function resolveAttributeDefinitions(
  tenantId: string,
  categoryId?: string | null
): Promise<AttributeDefinition[]> {
  const all = await prisma.productAttributeDefinition.findMany({
    where: { tenantId, isActive: true },
    include: { categoryLinks: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return all
    .filter((def) => {
      if (def.categoryLinks.length === 0) return true;
      if (!categoryId) return false;
      return def.categoryLinks.some((l) => l.categoryId === categoryId);
    })
    .map((def) => {
      const link = categoryId
        ? def.categoryLinks.find((l) => l.categoryId === categoryId)
        : undefined;
      const categoryOptions = link?.optionsOverride;
      const options =
        categoryOptions !== null && categoryOptions !== undefined
          ? categoryOptions
          : def.options;
      return {
        id: def.id,
        key: def.key,
        label: def.label,
        dataType: def.dataType,
        unit: def.unit,
        options,
        validation: def.validation,
        isRequired: link?.isRequiredOverride ?? def.isRequired,
        isFilterable: def.isFilterable,
        isVariantAxis: def.isVariantAxis,
        showOnLabel: def.showOnLabel,
        sortOrder: def.sortOrder,
      };
    });
}

export function validateCustomAttributes(
  definitions: AttributeDefinition[],
  values: Record<string, unknown> | null | undefined,
  opts: { stripUnknown?: boolean } = {}
): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const input = values ?? {};
  const stripUnknown = opts.stripUnknown ?? true;
  const result: Record<string, unknown> = stripUnknown ? {} : { ...input };

  const knownKeys = new Set(definitions.map((d) => d.key));
  if (!stripUnknown) {
    for (const key of Object.keys(input)) {
      if (!knownKeys.has(key)) {
        return { ok: false, error: `Unknown attribute "${key}"` };
      }
    }
  }

  for (const def of definitions) {
    const raw = input[def.key];
    const missing = raw === undefined || raw === null || raw === "";

    if (missing) {
      if (def.isRequired) {
        return { ok: false, error: `${def.label} is required` };
      }
      continue;
    }

    const validated = coerceAndValidate(def, raw);
    if (!validated.ok) return validated;
    result[def.key] = validated.value;
  }

  return { ok: true, values: result };
}

function coerceAndValidate(
  def: AttributeDefinition,
  raw: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  const rules = (def.validation ?? {}) as ValidationRules;
  const options = Array.isArray(def.options) ? (def.options as string[]) : [];

  switch (def.dataType) {
    case "TEXT":
    case "DATE": {
      if (typeof raw !== "string") {
        return { ok: false, error: `${def.label} must be text` };
      }
      if (rules.maxLength && raw.length > rules.maxLength) {
        return { ok: false, error: `${def.label} exceeds max length` };
      }
      if (rules.regex && !new RegExp(rules.regex).test(raw)) {
        return { ok: false, error: `${def.label} has invalid format` };
      }
      return { ok: true, value: raw };
    }
    case "NUMBER":
    case "UNIT_NUMBER": {
      const num = typeof raw === "number" ? raw : Number(raw);
      if (Number.isNaN(num)) {
        return { ok: false, error: `${def.label} must be a number` };
      }
      if (rules.min !== undefined && num < rules.min) {
        return { ok: false, error: `${def.label} must be ≥ ${rules.min}` };
      }
      if (rules.max !== undefined && num > rules.max) {
        return { ok: false, error: `${def.label} must be ≤ ${rules.max}` };
      }
      return { ok: true, value: num };
    }
    case "BOOLEAN": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true" || raw === "false") return { ok: true, value: raw === "true" };
      return { ok: false, error: `${def.label} must be true/false` };
    }
    case "SELECT": {
      if (typeof raw !== "string") {
        return { ok: false, error: `${def.label} must be a string` };
      }
      if (options.length && !options.includes(raw)) {
        return { ok: false, error: `${def.label} must be one of: ${options.join(", ")}` };
      }
      return { ok: true, value: raw };
    }
    case "MULTI_SELECT": {
      const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",").map((s) => s.trim()) : null;
      if (!arr || !arr.every((v) => typeof v === "string")) {
        return { ok: false, error: `${def.label} must be a list of values` };
      }
      if (options.length && arr.some((v) => !options.includes(v as string))) {
        return { ok: false, error: `${def.label} contains invalid option` };
      }
      return { ok: true, value: arr };
    }
    default:
      return { ok: false, error: `Unsupported data type for ${def.label}` };
  }
}

/** Sync filterable attribute values into ProductAttributeIndex */
export async function syncAttributeIndex(
  tenantId: string,
  productId: string,
  definitions: AttributeDefinition[],
  values: Record<string, unknown>
) {
  await prisma.productAttributeIndex.deleteMany({ where: { tenantId, productId } });

  const rows = definitions
    .filter((d) => d.isFilterable && values[d.key] !== undefined && values[d.key] !== null)
    .map((d) => {
      const v = values[d.key];
      if (typeof v === "number") {
        return { tenantId, productId, key: d.key, valueNum: v, valueText: String(v), valueBool: null as boolean | null };
      }
      if (typeof v === "boolean") {
        return { tenantId, productId, key: d.key, valueBool: v, valueText: String(v), valueNum: null as number | null };
      }
      if (Array.isArray(v)) {
        return { tenantId, productId, key: d.key, valueText: v.join(","), valueNum: null, valueBool: null };
      }
      return { tenantId, productId, key: d.key, valueText: String(v), valueNum: null, valueBool: null };
    });

  if (rows.length) {
    await prisma.productAttributeIndex.createMany({ data: rows });
  }
}

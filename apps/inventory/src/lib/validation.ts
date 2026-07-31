import { MAX_PRODUCT_NAME_LENGTH, MAX_SKU_LENGTH } from "./sku-template";

export type GenerationIssueCode =
  | "MISSING_IDENTITY"
  | "MISSING_AXIS"
  | "INVALID_VALUE"
  | "BAD_SKU_TEMPLATE"
  | "SKU_TOO_LONG"
  | "NAME_TOO_LONG"
  | "DUPLICATE_CONFIG_KEY_BATCH"
  | "DUPLICATE_CONFIG_KEY_DB"
  | "DUPLICATE_SKU_BATCH"
  | "DUPLICATE_SKU_DB"
  | "MISSING_PRICING_DEFAULTS"
  | "EMPTY_AXES"
  | "DEFINITION_NOT_ACTIVE";

export type GenerationIssue = {
  code: GenerationIssueCode;
  message: string;
  sku?: string;
  configKey?: string;
  attributeKey?: string;
  index?: number;
};

export type PreviewRow = {
  index: number;
  sku: string;
  name: string;
  configKey: string;
  customAttributes: Record<string, string>;
};

const MEASURED_BASES = new Set(["PER_AREA", "PER_WEIGHT", "PER_VOLUME", "FORMULA", "CUSTOM"]);

export function allowedValuesAsStringAxes(
  allowedValues: Record<string, unknown>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(allowedValues)) {
    if (!Array.isArray(raw) || raw.length === 0) continue;
    out[key] = raw.map((v) => String(v));
  }
  return out;
}

export function validatePricingDefaults(input: {
  defaultPricingBasis: string;
  defaultPricingUom?: string | null;
  defaultBaseRate?: number | null;
}): GenerationIssue | null {
  if (!MEASURED_BASES.has(input.defaultPricingBasis)) return null;
  if (input.defaultBaseRate == null || Number.isNaN(input.defaultBaseRate)) {
    return {
      code: "MISSING_PRICING_DEFAULTS",
      message: `Generation default baseRate required for pricingBasis ${input.defaultPricingBasis}`,
    };
  }
  if (!input.defaultPricingUom) {
    return {
      code: "MISSING_PRICING_DEFAULTS",
      message: `Generation default pricingUom required for pricingBasis ${input.defaultPricingBasis}`,
    };
  }
  return null;
}

export function validateRowAgainstAllowed(
  attrs: Record<string, string>,
  axes: Record<string, string[]>,
  identityKeys: string[],
  index: number
): GenerationIssue[] {
  const issues: GenerationIssue[] = [];
  for (const key of Object.keys(axes)) {
    if (attrs[key] === undefined || attrs[key] === "") {
      issues.push({
        code: "MISSING_AXIS",
        message: `Missing axis value for ${key}`,
        attributeKey: key,
        index,
      });
      continue;
    }
    const allowed = axes[key].map(String);
    if (!allowed.includes(attrs[key]) && !allowed.includes(String(attrs[key]))) {
      // also allow numeric string match
      const ok = allowed.some((a) => String(a) === String(attrs[key]));
      if (!ok) {
        issues.push({
          code: "INVALID_VALUE",
          message: `Value "${attrs[key]}" not in allowedValues for ${key}`,
          attributeKey: key,
          index,
        });
      }
    }
  }
  for (const key of identityKeys) {
    if (attrs[key] === undefined || attrs[key] === "") {
      issues.push({
        code: "MISSING_IDENTITY",
        message: `Missing identity attribute ${key}`,
        attributeKey: key,
        index,
      });
    }
  }
  return issues;
}

export function validateOutputLengths(row: PreviewRow): GenerationIssue[] {
  const issues: GenerationIssue[] = [];
  if (!row.sku || row.sku.length > MAX_SKU_LENGTH) {
    issues.push({
      code: "SKU_TOO_LONG",
      message: `SKU missing or longer than ${MAX_SKU_LENGTH} chars`,
      sku: row.sku,
      index: row.index,
    });
  }
  if (!row.name || row.name.length > MAX_PRODUCT_NAME_LENGTH) {
    issues.push({
      code: "NAME_TOO_LONG",
      message: `Name missing or longer than ${MAX_PRODUCT_NAME_LENGTH} chars`,
      sku: row.sku,
      index: row.index,
    });
  }
  return issues;
}

export function findBatchDuplicates(rows: PreviewRow[]): GenerationIssue[] {
  const issues: GenerationIssue[] = [];
  const byConfig = new Map<string, number>();
  const bySku = new Map<string, number>();
  for (const row of rows) {
    if (byConfig.has(row.configKey)) {
      issues.push({
        code: "DUPLICATE_CONFIG_KEY_BATCH",
        message: `Duplicate configKey in batch: ${row.configKey}`,
        configKey: row.configKey,
        index: row.index,
      });
    } else {
      byConfig.set(row.configKey, row.index);
    }
    const skuKey = row.sku.toUpperCase();
    if (bySku.has(skuKey)) {
      issues.push({
        code: "DUPLICATE_SKU_BATCH",
        message: `Duplicate SKU in batch: ${row.sku}`,
        sku: row.sku,
        index: row.index,
      });
    } else {
      bySku.set(skuKey, row.index);
    }
  }
  return issues;
}

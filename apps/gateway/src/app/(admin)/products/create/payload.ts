import type { CreateProductForm } from "./schema";

export function buildCreatePayload(values: CreateProductForm) {
  const axes: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(values.selected ?? {})) {
    if (v.length) axes[k] = v;
  }

  const base =
    values.pricingBasis === "PER_EACH"
      ? values.sellPrice === ""
        ? null
        : Number(values.sellPrice)
      : values.baseRate === ""
        ? null
        : Number(values.baseRate);

  const overrides: Record<string, number> = {};
  for (const [k, v] of Object.entries(values.rowOverrides ?? {})) {
    if (v !== "" && Number.isFinite(Number(v))) overrides[k] = Number(v);
  }

  let pricingPolicy:
    | {
        type: "SAME" | "CONFIGURATION";
        basePrice: number | null;
        attribute?: string;
        values?: Record<string, number>;
        overrides?: Record<string, number>;
      }
    | undefined;

  if (values.pricingBasis === "PER_EACH") {
    const priceValues: Record<string, number> = {};
    if (values.priceVariation === "CONFIGURATION" && values.priceVariesBy) {
      for (const opt of values.selected[values.priceVariesBy] ?? []) {
        const raw = values.configPrices[opt];
        if (raw !== undefined && raw !== "" && Number.isFinite(Number(raw))) {
          priceValues[opt] = Number(raw);
        }
      }
    }
    pricingPolicy = {
      type: values.priceVariation === "CONFIGURATION" && values.priceVariesBy ? "CONFIGURATION" : "SAME",
      basePrice: base,
      ...(values.priceVariation === "CONFIGURATION" && values.priceVariesBy
        ? { attribute: values.priceVariesBy, values: priceValues }
        : {}),
      ...(Object.keys(overrides).length ? { overrides } : {}),
    };
  }

  const cost =
    values.costPrice.trim() === ""
      ? null
      : Number.isFinite(Number(values.costPrice))
        ? Number(values.costPrice)
        : null;
  const reorder =
    values.reorderLevel.trim() === ""
      ? 10
      : Number.isFinite(Number(values.reorderLevel))
        ? Number(values.reorderLevel)
        : 10;
  const opening =
    values.openingStock.trim() === ""
      ? 0
      : Number.isFinite(Number(values.openingStock))
        ? Number(values.openingStock)
        : 0;

  let media:
    | {
        images: string[];
        variation?: {
          type: "CONFIGURATION";
          attributes: string[];
          values: Record<string, string[]>;
        };
      }
    | null = null;

  const defaultImages = (values.mediaImages ?? []).filter(Boolean);
  if (values.mediaVariation === "CONFIGURATION" && values.mediaVariesBy) {
    const mediaValues: Record<string, string[]> = {};
    for (const opt of values.selected[values.mediaVariesBy] ?? []) {
      const urls = (values.mediaByValue[opt] ?? []).filter(Boolean);
      if (urls.length) mediaValues[opt] = urls;
    }
    if (defaultImages.length || Object.keys(mediaValues).length) {
      media = {
        images: defaultImages,
        variation: {
          type: "CONFIGURATION",
          attributes: [values.mediaVariesBy],
          values: mediaValues,
        },
      };
    }
  } else if (defaultImages.length) {
    media = { images: defaultImages };
  }

  // GST: only send when author entered a rate or tax code. Empty → 0% at order time.
  const taxCode = values.taxCode?.trim() || undefined;
  const hsnCode = values.hsnCode?.trim() || undefined;
  let taxRate: number | undefined;
  const pctRaw = values.taxRatePercent?.trim() ?? "";
  if (pctRaw !== "" && Number.isFinite(Number(pctRaw))) {
    const n = Number(pctRaw);
    // Allow "18" (percent) or "0.18" (fraction)
    taxRate = n > 1 ? n / 100 : n;
  }

  return {
    categoryId: values.categoryId,
    brandId: values.brandId || null,
    productName: values.productName.trim() || null,
    axes,
    skuTemplate: values.skuTemplate.trim() || null,
    nameTemplate: values.nameTemplate.trim() || null,
    barcodeTemplate: values.barcodeTemplate.trim() || null,
    groupCode: values.groupCode.trim() || null,
    groupName: values.groupName.trim() || values.productName.trim() || null,
    description: values.description.trim() || null,
    media,
    costPrice: cost,
    reorderLevel: reorder,
    openingStock: opening > 0 ? opening : null,
    pricingBasis: values.pricingBasis,
    pricingUom: values.pricingBasis === "PER_EACH" ? "each" : values.pricingUom,
    baseRate: base,
    sellPrice: values.pricingBasis === "PER_EACH" ? base : null,
    pricingPolicy,
    ...(taxRate !== undefined ? { taxRate } : {}),
    ...(taxCode ? { taxCode } : {}),
    ...(hsnCode ? { hsnCode } : {}),
  };
}

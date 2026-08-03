"use client";

import { MediaPreviewBlock, ProductSummaryBlock, VariantPreviewGrid } from "@erp/ui";
import { useFormContext, useWatch } from "react-hook-form";
import { useProductMeta } from "../ProductMeta";
import type { CreateProductForm } from "../schema";

export function IdentitySummary() {
  const { control } = useFormContext<CreateProductForm>();
  const categoryId = useWatch({ control, name: "categoryId" });
  const brandId = useWatch({ control, name: "brandId" });
  const productName = useWatch({ control, name: "productName" });
  const groupName = useWatch({ control, name: "groupName" });
  const { categories, brands } = useProductMeta();
  return (
    <ProductSummaryBlock
      title="Product"
      rows={[
        { label: "Name", value: productName || "—" },
        { label: "Display", value: groupName || "—" },
        { label: "Category", value: categories.find((c) => c.id === categoryId)?.name || "—" },
        { label: "Brand", value: brands.find((b) => b.id === brandId)?.name || "—" },
      ]}
    />
  );
}

export function ConfigurationSummary() {
  const { plan } = useProductMeta();
  return (
    <>
      <ProductSummaryBlock
        title="Variants"
        rows={[
          { label: "Total", value: plan ? String(plan.total) : "—" },
          { label: "Create", value: plan ? String(plan.create) : "—" },
        ]}
      />
      <VariantPreviewGrid
        items={(plan?.products ?? []).slice(0, 24).map((p) => ({
          id: String(p.index),
          label: p.name,
          status: p.status,
        }))}
      />
    </>
  );
}

export function CommercialSummary() {
  const { control } = useFormContext<CreateProductForm>();
  const images = useWatch({ control, name: "mediaImages" }) ?? [];
  const mediaVariation = useWatch({ control, name: "mediaVariation" });
  const mediaVariesBy = useWatch({ control, name: "mediaVariesBy" });
  const { attrs } = useProductMeta();
  const imagesLabel =
    mediaVariation === "CONFIGURATION" && mediaVariesBy
      ? `Varies by ${attrs.find((a) => a.key === mediaVariesBy)?.label || mediaVariesBy}`
      : images.length
        ? "Shared across all"
        : "None";
  return (
    <>
      <ProductSummaryBlock
        title="Media"
        rows={[
          { label: "Images", value: String(images.length) },
          { label: "Mode", value: imagesLabel },
        ]}
      />
      <MediaPreviewBlock images={images} />
    </>
  );
}

export function PricingSummary() {
  const { control } = useFormContext<CreateProductForm>();
  const basis = useWatch({ control, name: "pricingBasis" });
  const sell = useWatch({ control, name: "sellPrice" });
  const rate = useWatch({ control, name: "baseRate" });
  const priceVariation = useWatch({ control, name: "priceVariation" });
  const value = basis === "PER_EACH" ? sell || "—" : rate || "—";
  return (
    <ProductSummaryBlock
      title="Pricing"
      rows={[
        { label: "Basis", value: basis?.replace("PER_", "") || "—" },
        { label: "Rate", value },
        { label: "Variation", value: priceVariation === "CONFIGURATION" ? "By config" : "Same" },
      ]}
    />
  );
}

export function InventorySummary() {
  const { control } = useFormContext<CreateProductForm>();
  const opening = useWatch({ control, name: "openingStock" });
  const reorder = useWatch({ control, name: "reorderLevel" });
  const cost = useWatch({ control, name: "costPrice" });
  return (
    <ProductSummaryBlock
      title="Inventory"
      rows={[
        { label: "Cost", value: cost || "—" },
        { label: "Opening", value: opening || "0" },
        { label: "Reorder", value: reorder || "—" },
      ]}
    />
  );
}

export function StatusSummary() {
  const { plan, previewing } = useProductMeta();
  return (
    <ProductSummaryBlock
      title="Status"
      rows={[
        { label: "Preview", value: previewing ? "Updating…" : plan ? "Ready" : "Draft" },
        { label: "Create", value: plan ? String(plan.create) : "—" },
        { label: "Invalid", value: plan ? String(plan.invalid) : "—" },
      ]}
    />
  );
}

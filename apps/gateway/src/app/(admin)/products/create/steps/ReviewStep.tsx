"use client";

import { FormField, MetricTile } from "@erp/ui";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useProductMeta } from "../ProductMeta";
import type { CreateProductForm } from "../schema";
import { useFieldTouch } from "../useProgressiveSuggestions";
import { fieldClass, formatPrice } from "../utils";

export function ReviewStep() {
  const { register, watch, setValue } = useFormContext<CreateProductForm>();
  const { markTouched } = useFieldTouch();
  const { plan, categories, brands, previewing } = useProductMeta();
  const [optionalOpen, setOptionalOpen] = useState(false);
  const categoryId = watch("categoryId");
  const brandId = watch("brandId");
  const productName = watch("productName");
  const groupName = watch("groupName");
  const description = watch("description") ?? "";
  const pricingBasis = watch("pricingBasis");
  const mediaImages = watch("mediaImages") ?? [];
  const rowOverrides = watch("rowOverrides") ?? {};
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "—";
  const brandName = brands.find((b) => b.id === brandId)?.name ?? "—";
  const displayProduct = (groupName || productName || brandName || "Untitled").trim();
  const shortDesc = description.slice(0, 160);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="To create" value={plan ? String(plan.create) : "—"} tone="success" />
        <MetricTile label="Skip" value={plan ? String(plan.skip) : "—"} tone="muted" />
        <MetricTile label="Invalid" value={plan ? String(plan.invalid) : "—"} tone={plan && plan.invalid > 0 ? "warning" : "muted"} />
        <MetricTile label="Images" value={String(mediaImages.length)} />
      </div>

      {previewing ? <p className="text-xs text-[var(--ink-soft)]">Refreshing create plan…</p> : null}

      {plan && plan.products.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]">
          <div className="flex items-start gap-3 border-b border-[var(--line)] bg-[var(--mist)]/50 px-4 py-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]">
              {mediaImages[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaImages[0]} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-light text-[var(--ink-soft)]">
                  {displayProduct.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-[var(--ink)]">{displayProduct}</div>
              {shortDesc ? (
                <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-soft)]">{shortDesc}</p>
              ) : null}
              <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
                {categoryName} · {brandName}
              </p>
            </div>
          </div>
          <div className="max-h-[280px] divide-y divide-[var(--line)] overflow-y-auto">
            {plan.products.map((p) => (
              <div key={p.index} className="flex items-start gap-3 px-4 py-3">
                <div className="w-5 shrink-0 pt-0.5 text-center">
                  {p.status === "willCreate" ? (
                    <span className="font-semibold text-emerald-600">✓</span>
                  ) : p.status === "alreadyExists" ? (
                    <span className="text-[var(--ink-soft)]">○</span>
                  ) : (
                    <span className="text-amber-600">⚠</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--ink)]">{p.name}</div>
                  {p.status !== "alreadyExists" && (
                    <div className="mt-0.5 font-mono text-xs text-[var(--ink-soft)]">{p.sku}</div>
                  )}
                </div>
                {p.status === "willCreate" && pricingBasis === "PER_EACH" ? (
                  <input
                    className="w-28 shrink-0 rounded-lg border border-[var(--line)] px-2 py-1 text-right text-sm tabular-nums"
                    value={
                      rowOverrides[String(p.index)] !== undefined
                        ? rowOverrides[String(p.index)]
                        : p.unitPrice != null
                          ? String(p.unitPrice)
                          : ""
                    }
                    onChange={(e) =>
                      setValue(
                        "rowOverrides",
                        { ...rowOverrides, [String(p.index)]: e.target.value },
                        { shouldDirty: true }
                      )
                    }
                  />
                ) : p.status !== "alreadyExists" ? (
                  <div className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatPrice(p.unitPrice)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--line)] p-4">
        <button
          type="button"
          onClick={() => setOptionalOpen((o) => !o)}
          className="text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          {optionalOpen ? "▾" : "▸"} Optional Settings
        </button>
        {optionalOpen && (
          <div className="mt-3 grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--mist)] p-4">
            <FormField label="Product Name Template">
              <input
                className={`${fieldClass} font-mono`}
                {...register("productNameTemplate", {
                  onChange: () => markTouched("productNameTemplate"),
                })}
              />
            </FormField>
            <FormField label="Display Name Template">
              <input
                className={`${fieldClass} font-mono`}
                {...register("groupNameTemplate", {
                  onChange: () => markTouched("groupNameTemplate"),
                })}
              />
            </FormField>
            <FormField label="SKU Pattern">
              <input
                className={`${fieldClass} font-mono`}
                {...register("skuTemplate", { onChange: () => markTouched("skuTemplate") })}
              />
            </FormField>
            <FormField label="Name Pattern">
              <input
                className={`${fieldClass} font-mono`}
                {...register("nameTemplate", { onChange: () => markTouched("nameTemplate") })}
              />
            </FormField>
            <FormField label="Barcode Pattern">
              <input className={`${fieldClass} font-mono`} placeholder="Optional" {...register("barcodeTemplate")} />
            </FormField>
          </div>
        )}
      </div>
    </div>
  );
}

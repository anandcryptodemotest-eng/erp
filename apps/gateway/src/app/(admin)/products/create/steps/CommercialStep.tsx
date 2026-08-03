"use client";

import { FormField } from "@erp/ui";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { ProductMediaGallery } from "@/components/ProductMediaGallery";
import { useProductMeta } from "../ProductMeta";
import type { CreateProductForm } from "../schema";
import { fieldClass } from "../utils";

/**
 * Commercial = media only. Listing (display name/group) lives on Identity.
 * Per-configuration media requires multi-valued axes from Configuration.
 */
export function CommercialStep() {
  const { watch, setValue } = useFormContext<CreateProductForm>();
  const { attrs } = useProductMeta();
  const mediaImages = watch("mediaImages") ?? [];
  const mediaVariation = watch("mediaVariation");
  const mediaVariesBy = watch("mediaVariesBy");
  const mediaByValue = watch("mediaByValue") ?? {};
  const selected = watch("selected") ?? {};
  const categoryId = watch("categoryId");

  const hasConfig = Object.values(selected).some((v) => v.length > 0);
  const multiValuedAxes = Object.entries(selected)
    .filter(([, v]) => v.length >= 2)
    .map(([k]) => ({
      key: k,
      label: attrs.find((a) => a.key === k)?.label || k,
      values: selected[k] ?? [],
    }));

  useEffect(() => {
    if (mediaVariation !== "CONFIGURATION") return;
    if (!multiValuedAxes.length) {
      setValue("mediaVariation", "SAME");
      setValue("mediaVariesBy", "");
      return;
    }
    if (!multiValuedAxes.some((a) => a.key === mediaVariesBy)) {
      setValue("mediaVariesBy", multiValuedAxes[0]!.key);
    }
  }, [multiValuedAxes, mediaVariation, mediaVariesBy, setValue]);

  if (!categoryId) {
    return <p className="text-sm text-[var(--ink-soft)]">Select a category on Identity first.</p>;
  }

  if (!hasConfig) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--ink-soft)]">
        Complete <span className="font-semibold text-[var(--ink)]">Configuration</span> first.
        Media that varies by attribute needs selected options (2+ values on an axis).
        You can still add shared images after selecting configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="min-h-[12rem]">
        <ProductMediaGallery
          variant="studio"
          value={mediaImages}
          onChange={(images) => setValue("mediaImages", images, { shouldDirty: true })}
          helperText={
            mediaVariation === "SAME"
              ? "These images will be shared by all products created here."
              : "Default images used when a configuration value has no gallery."
          }
        />
      </div>

      <div className="space-y-3 border-t border-[var(--line)] pt-4">
        <div className="text-sm font-medium text-[var(--ink)]">Media Variation</div>
        <p className="text-xs text-[var(--ink-soft)]">
          Based on your configuration{multiValuedAxes.length === 0 ? " — select 2+ options on an attribute to vary media" : ""}.
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              checked={mediaVariation === "SAME"}
              onChange={() => setValue("mediaVariation", "SAME", { shouldDirty: true })}
            />
            Same images for all products in this batch
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              checked={mediaVariation === "CONFIGURATION"}
              disabled={multiValuedAxes.length === 0}
              onChange={() => {
                setValue("mediaVariation", "CONFIGURATION", { shouldDirty: true });
                if (!mediaVariesBy && multiValuedAxes[0]) {
                  setValue("mediaVariesBy", multiValuedAxes[0].key);
                }
              }}
            />
            Images vary by configuration
            {multiValuedAxes.length === 0 && (
              <span className="text-xs text-[var(--ink-soft)]">(need 2+ values on an attribute)</span>
            )}
          </label>
        </div>

        {mediaVariation === "CONFIGURATION" && multiValuedAxes.length > 0 && (
          <div className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--mist)] p-3">
            <FormField label="Media varies by">
              <select
                className={fieldClass}
                value={mediaVariesBy || multiValuedAxes[0]?.key || ""}
                onChange={(e) => {
                  setValue("mediaVariesBy", e.target.value, { shouldDirty: true });
                  setValue("mediaByValue", {}, { shouldDirty: true });
                }}
              >
                {multiValuedAxes.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </FormField>
            {(selected[mediaVariesBy || multiValuedAxes[0]?.key || ""] ?? []).map((opt) => (
              <div key={opt} className="space-y-1">
                <div className="text-sm font-medium text-[var(--ink)]">{opt}</div>
                <ProductMediaGallery
                  value={mediaByValue[opt] ?? []}
                  onChange={(urls) =>
                    setValue("mediaByValue", { ...mediaByValue, [opt]: urls }, { shouldDirty: true })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

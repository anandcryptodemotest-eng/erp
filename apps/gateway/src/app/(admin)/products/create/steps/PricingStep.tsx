"use client";

import { FormField } from "@erp/ui";
import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useProductMeta } from "../ProductMeta";
import type { CreateProductForm } from "../schema";
import { fieldClass } from "../utils";

export function PricingStep() {
  const { register, watch, setValue } = useFormContext<CreateProductForm>();
  const { attrs } = useProductMeta();
  const pricingBasis = watch("pricingBasis");
  const priceVariation = watch("priceVariation");
  const priceVariesBy = watch("priceVariesBy");
  const selected = watch("selected") ?? {};
  const sellPrice = watch("sellPrice");
  const configPrices = watch("configPrices") ?? {};
  const configPriceTouched = useRef<Record<string, boolean>>({});

  const hasConfig = Object.values(selected).some((v) => v.length > 0);

  const multiValuedAxes = Object.entries(selected)
    .filter(([, v]) => v.length >= 2)
    .map(([k]) => ({
      key: k,
      label: attrs.find((a) => a.key === k)?.label || k,
      values: selected[k] ?? [],
    }));

  const rateLabel =
    pricingBasis === "PER_AREA"
      ? `Rate per ${watch("pricingUom") || "sq_ft"}`
      : pricingBasis === "PER_WEIGHT"
        ? `Rate per ${watch("pricingUom") || "kg"}`
        : pricingBasis === "PER_VOLUME"
          ? `Rate per ${watch("pricingUom") || "m3"}`
          : "Rate";

  useEffect(() => {
    if (pricingBasis !== "PER_EACH" || priceVariation !== "CONFIGURATION") return;
    if (!multiValuedAxes.length) {
      setValue("priceVariation", "SAME");
      setValue("priceVariesBy", "");
      return;
    }
    const axis = multiValuedAxes.find((a) => a.key === priceVariesBy) ?? multiValuedAxes[0]!;
    if (axis.key !== priceVariesBy) setValue("priceVariesBy", axis.key);
    const next = { ...configPrices };
    let changed = false;
    for (const v of axis.values) {
      const touchKey = `${axis.key}:${v}`;
      if (!configPriceTouched.current[touchKey] && (next[v] == null || next[v] === "")) {
        next[v] = sellPrice ?? "";
        changed = true;
      }
    }
    if (changed) setValue("configPrices", next);
  }, [multiValuedAxes, priceVariation, pricingBasis, priceVariesBy, sellPrice, configPrices, setValue]);

  if (!hasConfig) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--ink-soft)]">
        Complete <span className="font-semibold text-[var(--ink)]">Configuration</span> first.
        Base and per-configuration prices unlock after you select attribute options.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--ink-soft)]">
        Pricing follows your configuration
        {multiValuedAxes.length === 0
          ? " — select 2+ values on an attribute to vary price by option"
          : ""}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Basis">
          <select
            className={fieldClass}
            value={pricingBasis}
            onChange={(e) => {
              const next = e.target.value;
              setValue("pricingBasis", next, { shouldDirty: true });
              setValue("rowOverrides", {}, { shouldDirty: true });
              if (next === "PER_AREA") setValue("pricingUom", "sq_ft");
              if (next === "PER_WEIGHT") setValue("pricingUom", "kg");
              if (next === "PER_VOLUME") setValue("pricingUom", "m3");
              if (next !== "PER_EACH") setValue("priceVariation", "SAME");
            }}
          >
            <option value="PER_EACH">PER_EACH</option>
            <option value="PER_AREA">PER_AREA</option>
            <option value="PER_WEIGHT">PER_WEIGHT</option>
            <option value="PER_VOLUME">PER_VOLUME</option>
          </select>
        </FormField>
        {pricingBasis === "PER_EACH" ? (
          <FormField label="Base Price">
            <input className={fieldClass} placeholder="₹" {...register("sellPrice")} />
          </FormField>
        ) : (
          <FormField label={rateLabel}>
            <input className={fieldClass} {...register("baseRate")} />
          </FormField>
        )}
      </div>

      {pricingBasis === "PER_EACH" && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-[var(--ink)]">Price Variation</div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={priceVariation === "SAME"}
                onChange={() => {
                  setValue("priceVariation", "SAME", { shouldDirty: true });
                  setValue("rowOverrides", {});
                }}
              />
              Same price for all products
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={priceVariation === "CONFIGURATION"}
                disabled={multiValuedAxes.length === 0}
                onChange={() => setValue("priceVariation", "CONFIGURATION", { shouldDirty: true })}
              />
              Different price by configuration
              {multiValuedAxes.length === 0 && (
                <span className="text-xs text-[var(--ink-soft)]">(need 2+ values on an attribute)</span>
              )}
            </label>
          </div>
          {priceVariation === "CONFIGURATION" && multiValuedAxes.length > 0 && (
            <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--mist)] p-3">
              <FormField label="Price varies by">
                <select
                  className={fieldClass}
                  value={priceVariesBy}
                  onChange={(e) => {
                    setValue("priceVariesBy", e.target.value, { shouldDirty: true });
                    setValue("rowOverrides", {});
                    configPriceTouched.current = {};
                  }}
                >
                  {multiValuedAxes.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </FormField>
              {(selected[priceVariesBy] ?? []).map((opt) => (
                <div key={opt} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-[var(--ink)]">{opt}</span>
                  <input
                    className={`flex-1 ${fieldClass}`}
                    value={configPrices[opt] ?? ""}
                    placeholder="₹"
                    onChange={(e) => {
                      configPriceTouched.current[`${priceVariesBy}:${opt}`] = true;
                      setValue(
                        "configPrices",
                        { ...configPrices, [opt]: e.target.value },
                        { shouldDirty: true }
                      );
                      setValue("rowOverrides", {});
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

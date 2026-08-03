"use client";

import { FormField } from "@erp/ui";
import { useFormContext } from "react-hook-form";
import { InlineCatalogCreates } from "../InlineQuickCreate";
import { useProductMeta } from "../ProductMeta";
import type { CreateProductForm } from "../schema";
import { useFieldTouch } from "../useProgressiveSuggestions";
import { fieldClass } from "../utils";

export function IdentityStep() {
  const { register, watch, setValue } = useFormContext<CreateProductForm>();
  const { categories, brands } = useProductMeta();
  const { markTouched } = useFieldTouch();
  const categoryId = watch("categoryId");
  const description = watch("description") ?? "";
  const productName = watch("productName");

  return (
    <div className="space-y-4">
      <InlineCatalogCreates />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Category" required>
          <select className={fieldClass} {...register("categoryId")}>
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Brand">
          <select className={fieldClass} {...register("brandId")}>
            <option value="">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Product Name"
          hint="Suggested from brand, category & configuration"
          className="sm:col-span-2"
        >
          <input
            className={fieldClass}
            {...register("productName", {
              onChange: () => markTouched("productName"),
            })}
            disabled={!categoryId}
            placeholder="Suggested from brand, category & configuration"
          />
        </FormField>
        <FormField label="Display Name" hint="Shown in Customer Portal">
          <input
            className={fieldClass}
            placeholder={productName || "Customer-facing family title"}
            {...register("groupName", { onChange: () => markTouched("groupName") })}
          />
        </FormField>
        <FormField label="Display Group">
          <input
            className={fieldClass}
            placeholder="Slug / group code"
            {...register("groupCode", { onChange: () => markTouched("groupCode") })}
          />
        </FormField>
        <FormField label="Short Description" className="sm:col-span-2">
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            maxLength={160}
            value={description.slice(0, 160)}
            onChange={(e) => setValue("description", e.target.value.slice(0, 160), { shouldDirty: true })}
            placeholder="Optional short description for catalog cards"
          />
          <span className="mt-1 block text-right text-[11px] text-[var(--ink-soft)] tabular-nums">
            {description.slice(0, 160).length}/160
          </span>
        </FormField>
      </div>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--mist)]/70 px-3 py-2.5 text-xs text-[var(--ink-soft)] leading-relaxed">
        Next: configure variants. Media and pricing options that vary by attribute unlock after configuration.
      </div>
    </div>
  );
}

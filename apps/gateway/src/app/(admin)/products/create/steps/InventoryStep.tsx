"use client";

import { FormField } from "@erp/ui";
import { useFormContext } from "react-hook-form";
import type { CreateProductForm } from "../schema";
import { fieldClass } from "../utils";

export function InventoryStep() {
  const { register } = useFormContext<CreateProductForm>();
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--ink-soft)]">Applies across every product in this batch.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Cost">
          <input className={fieldClass} placeholder="Optional" {...register("costPrice")} />
        </FormField>
        <FormField label="Opening Stock">
          <input className={fieldClass} placeholder="0" {...register("openingStock")} />
        </FormField>
        <FormField label="Reorder">
          <input className={fieldClass} {...register("reorderLevel")} />
        </FormField>
      </div>
    </div>
  );
}

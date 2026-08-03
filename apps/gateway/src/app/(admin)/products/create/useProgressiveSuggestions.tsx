"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useProductMeta } from "./ProductMeta";
import type { CreateProductForm } from "./schema";
import {
  buildProgressiveTokens,
  defaultNamePattern,
  defaultProductNameTemplate,
  defaultSkuPattern,
  expandTemplate,
  slugify,
} from "./utils";

export type TouchedKey =
  | "productName"
  | "groupName"
  | "groupCode"
  | "productNameTemplate"
  | "groupNameTemplate"
  | "skuTemplate"
  | "nameTemplate";

type TouchedCtx = {
  markTouched: (key: TouchedKey) => void;
  isTouched: (key: TouchedKey) => boolean;
};

const Ctx = createContext<TouchedCtx | null>(null);

export function useFieldTouch() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFieldTouch requires ProgressiveSuggestionsProvider");
  return ctx;
}

/** Shared touch-guards + progressive name/display suggestions for the studio session. */
export function ProgressiveSuggestionsProvider({ children }: { children: ReactNode }) {
  const { setValue, getValues, control } = useFormContext<CreateProductForm>();
  const { categories, brands, attrs } = useProductMeta();
  const touched = useRef<Partial<Record<TouchedKey, boolean>>>({});
  const categoryId = useWatch({ control, name: "categoryId" });
  const brandId = useWatch({ control, name: "brandId" });
  const selected = useWatch({ control, name: "selected" });
  const productName = useWatch({ control, name: "productName" });
  const productNameTemplate = useWatch({ control, name: "productNameTemplate" });
  const groupNameTemplate = useWatch({ control, name: "groupNameTemplate" });

  const api = useMemo<TouchedCtx>(
    () => ({
      markTouched: (key) => {
        touched.current[key] = true;
      },
      isTouched: (key) => Boolean(touched.current[key]),
    }),
    []
  );

  useEffect(() => {
    if (!attrs.length) return;
    const keys = attrs.map((a) => a.key);
    if (!touched.current.productNameTemplate) {
      setValue("productNameTemplate", defaultProductNameTemplate(keys));
    }
    if (!touched.current.skuTemplate) {
      setValue("skuTemplate", defaultSkuPattern(keys));
    }
    if (!touched.current.nameTemplate) {
      setValue("nameTemplate", defaultNamePattern(keys));
    }
  }, [attrs, setValue]);

  useEffect(() => {
    const brandName = brands.find((b) => b.id === brandId)?.name ?? "";
    const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "";
    const attrKeys = attrs.map((a) => a.key);
    const baseTokens = buildProgressiveTokens(brandName, categoryName, "", selected ?? {}, attrKeys);
    const tmpl = productNameTemplate || defaultProductNameTemplate(attrKeys);
    const suggestedName = expandTemplate(tmpl, baseTokens);

    if (!touched.current.productName && suggestedName) {
      if (getValues("productName") !== suggestedName) setValue("productName", suggestedName);
    }

    const resolvedProductName = touched.current.productName
      ? (productName ?? "").trim()
      : suggestedName || (productName ?? "").trim();

    if (!touched.current.groupName) {
      const gTokens = { ...baseTokens, productName: resolvedProductName };
      const gTmpl = groupNameTemplate || "{productName}";
      const suggestedGroup = expandTemplate(gTmpl, gTokens) || resolvedProductName;
      if (suggestedGroup && getValues("groupName") !== suggestedGroup) {
        setValue("groupName", suggestedGroup);
      }
    }

    if (!touched.current.groupCode) {
      const code = slugify(brandName, categoryName);
      if (code && getValues("groupCode") !== code) setValue("groupCode", code);
    }
  }, [
    brandId,
    categoryId,
    selected,
    attrs,
    brands,
    categories,
    productName,
    productNameTemplate,
    groupNameTemplate,
    getValues,
    setValue,
  ]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

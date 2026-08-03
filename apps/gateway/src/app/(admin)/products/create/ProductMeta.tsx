"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { api } from "@/lib/admin-api";
import type { CreatePlan } from "./ProductDomain";
import type { CreateProductForm } from "./schema";

export type AttrDef = {
  id: string;
  key: string;
  label: string;
  dataType: string;
  options?: string[] | null;
  isIdentity?: boolean;
  unit?: string | null;
};

type ProductMeta = {
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  attrs: AttrDef[];
  plan: CreatePlan | null;
  setPlan: (p: CreatePlan | null) => void;
  previewing: boolean;
  setPreviewing: (v: boolean) => void;
  refreshCatalog: () => Promise<void>;
  refreshAttrs: (categoryId: string) => Promise<void>;
};

const Ctx = createContext<ProductMeta | null>(null);

export function useProductMeta() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProductMeta requires ProductMetaProvider");
  return ctx;
}

function isConfigAttr(a: AttrDef) {
  return (
    a.dataType === "SELECT" ||
    a.dataType === "MULTI_SELECT" ||
    a.isIdentity ||
    a.dataType === "NUMBER"
  );
}

export function ProductMetaProvider({
  children,
  plan,
  setPlan,
}: {
  children: ReactNode;
  plan: CreatePlan | null;
  setPlan: (p: CreatePlan | null) => void;
}) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [attrs, setAttrs] = useState<AttrDef[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const { control, setValue, getValues } = useFormContext<CreateProductForm>();
  const categoryId = useWatch({ control, name: "categoryId" });
  const selected = useWatch({ control, name: "selected" });

  const refreshCatalog = useCallback(async () => {
    const [c, b] = await Promise.all([api("/api/categories?limit=100"), api("/api/brands?limit=100")]);
    setCategories(c.data ?? []);
    setBrands(b.data ?? []);
  }, []);

  const refreshAttrs = useCallback(
    async (catId: string) => {
      const r = await api(`/api/attribute-definitions?categoryId=${catId}`);
      const list = (r.data ?? []) as AttrDef[];
      setAttrs(list);
      const prev = getValues("selected") ?? {};
      const init: Record<string, string[]> = {};
      for (const a of list) {
        if (isConfigAttr(a)) init[a.key] = prev[a.key] ?? [];
      }
      setValue("selected", init);
    },
    [getValues, setValue]
  );

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (!categoryId) {
      setAttrs([]);
      return;
    }
    void refreshAttrs(categoryId);
  }, [categoryId, refreshAttrs]);

  useEffect(() => {
    if (!categoryId || !Object.values(selected ?? {}).some((v) => v.length)) {
      setPlan(null);
      return;
    }
    const t = setTimeout(() => {
      setPreviewing(true);
      const values = getValues();
      import("./payload")
        .then(({ buildCreatePayload }) =>
          api("/api/products/preview", {
            method: "POST",
            body: JSON.stringify(buildCreatePayload(values)),
          })
        )
        .then((r) => setPlan((r.data as CreatePlan) ?? null))
        .catch(() => setPlan(null))
        .finally(() => setPreviewing(false));
    }, 280);
    return () => clearTimeout(t);
  }, [categoryId, selected, getValues, setPlan]);

  const value = useMemo(
    () => ({
      categories,
      brands,
      attrs,
      plan,
      setPlan,
      previewing,
      setPreviewing,
      refreshCatalog,
      refreshAttrs,
    }),
    [categories, brands, attrs, plan, setPlan, previewing, refreshCatalog, refreshAttrs]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

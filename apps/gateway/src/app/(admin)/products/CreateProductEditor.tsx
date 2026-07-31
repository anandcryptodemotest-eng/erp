"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/admin-api";
import { ProductMediaGallery } from "@/components/ProductMediaGallery";

type AttrDef = {
  id: string;
  key: string;
  label: string;
  dataType: string;
  options?: string[] | null;
  isIdentity?: boolean;
  unit?: string | null;
};

type PlanProduct = {
  index: number;
  status: "willCreate" | "alreadyExists" | "invalid";
  sku: string;
  name: string;
  unitPrice: number | null;
  sellPrice?: number | null;
  priceSource?: "OVERRIDE" | "CONFIGURATION" | "BASE" | "MEASURED" | null;
  priceDetail?: string;
  existingSku?: string;
};

type CreatePlan = {
  total: number;
  create: number;
  skip: number;
  invalid: number;
  warnings: string[];
  products: PlanProduct[];
};

type TouchedKey =
  | "productName"
  | "groupName"
  | "groupCode"
  | "productNameTemplate"
  | "groupNameTemplate"
  | "skuTemplate"
  | "nameTemplate";

const DEFAULT_PRODUCT_NAME_TEMPLATE = "{brand} {grade} {thickness_mm}mm {size} {category}";
const DEFAULT_GROUP_NAME_TEMPLATE = "{productName}";

function optionList(options: unknown): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "object" && options !== null && Array.isArray((options as { values?: unknown }).values)) {
    return ((options as { values: unknown[] }).values).map(String);
  }
  return [];
}

function formatPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function slugify(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Expand template; omit empty tokens; tidy whitespace. */
function expandTemplate(template: string, tokens: Record<string, string>): string {
  let out = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const v = tokens[key];
    return v != null && String(v).trim() !== "" ? String(v).trim() : "";
  });
  // Collapse spaces left by omitted tokens; keep "18mm" glued when template has `{thickness_mm}mm`
  out = out
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+mm\b/gi, "$1mm")
    .replace(/^\s*mm\s+/i, "")
    .replace(/\s+mm\s*$/i, "")
    .replace(/\s+mm\s+/gi, " ")
    .trim();
  return out;
}

/**
 * Progressive family name: brand/category always;
 * attribute tokens only when exactly one value is selected.
 */
function buildProgressiveTokens(
  brandName: string,
  categoryName: string,
  productName: string,
  selected: Record<string, string[]>,
  attrKeys: string[]
): Record<string, string> {
  const tokens: Record<string, string> = {
    brand: brandName,
    category: categoryName,
    productName,
  };
  for (const key of attrKeys) {
    const vals = selected[key] ?? [];
    if (vals.length === 1) {
      tokens[key] = vals[0];
      // Friendly aliases
      if (key === "thickness_mm") tokens.thickness = vals[0];
    }
  }
  return tokens;
}

function defaultSkuPattern(attrKeys: string[]): string {
  const preferred = ["brand", "grade", "thickness_mm", "size"].filter(
    (k) => k === "brand" || attrKeys.includes(k)
  );
  const keys = preferred.length > 1 ? preferred : ["brand", ...attrKeys.slice(0, 3)];
  return keys.map((k) => `{${k}}`).join("-");
}

function defaultNamePattern(attrKeys: string[]): string {
  const parts: string[] = ["{brand}"];
  if (attrKeys.includes("grade")) parts.push("{grade}");
  if (attrKeys.includes("thickness_mm")) parts.push("{thickness_mm}mm");
  else if (attrKeys.includes("thickness")) parts.push("{thickness}");
  if (attrKeys.includes("size")) parts.push("{size}");
  if (attrKeys.includes("color")) parts.push("{color}");
  if (attrKeys.includes("storage")) parts.push("{storage}");
  if (parts.length === 1) parts.push(...attrKeys.slice(0, 3).map((k) => `{${k}}`));
  return parts.join(" ");
}

function defaultProductNameTemplate(attrKeys: string[]): string {
  // Include common keys; expandTemplate omits empty / multi-valued dims
  const parts = ["{brand}"];
  if (attrKeys.includes("grade")) parts.push("{grade}");
  if (attrKeys.includes("thickness_mm")) parts.push("{thickness_mm}mm");
  if (attrKeys.includes("size")) parts.push("{size}");
  if (attrKeys.includes("color")) parts.push("{color}");
  if (attrKeys.includes("storage")) parts.push("{storage}");
  parts.push("{category}");
  return parts.join(" ") || DEFAULT_PRODUCT_NAME_TEMPLATE;
}

export function CreateProductEditor({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [attrs, setAttrs] = useState<AttrDef[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [productName, setProductName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [description, setDescription] = useState("");
  const [mediaImages, setMediaImages] = useState<string[]>([]);
  const [costPrice, setCostPrice] = useState("");
  const [openingStock, setOpeningStock] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [pricingBasis, setPricingBasis] = useState("PER_AREA");
  const [pricingUom, setPricingUom] = useState("sq_ft");
  const [baseRate, setBaseRate] = useState("50");
  const [sellPrice, setSellPrice] = useState("");
  const [priceVariation, setPriceVariation] = useState<"SAME" | "CONFIGURATION">("SAME");
  const [priceVariesBy, setPriceVariesBy] = useState("");
  const [configPrices, setConfigPrices] = useState<Record<string, string>>({});
  const [rowOverrides, setRowOverrides] = useState<Record<string, string>>({});
  const configPriceTouched = useRef<Record<string, boolean>>({});
  const [productNameTemplate, setProductNameTemplate] = useState(DEFAULT_PRODUCT_NAME_TEMPLATE);
  const [groupNameTemplate, setGroupNameTemplate] = useState(DEFAULT_GROUP_NAME_TEMPLATE);
  const [skuTemplate, setSkuTemplate] = useState("");
  const [nameTemplate, setNameTemplate] = useState("");
  const [barcodeTemplate, setBarcodeTemplate] = useState("");
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [plan, setPlan] = useState<CreatePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [doneMsg, setDoneMsg] = useState("");

  const touched = useRef<Partial<Record<TouchedKey, boolean>>>({});
  const markTouched = (key: TouchedKey) => {
    touched.current[key] = true;
  };

  useEffect(() => {
    Promise.all([api("/api/categories?limit=100"), api("/api/brands?limit=100")]).then(([c, b]) => {
      setCategories(c.data ?? []);
      setBrands(b.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setAttrs([]);
      setSelected({});
      return;
    }
    api(`/api/attribute-definitions?categoryId=${categoryId}`).then((r) => {
      const list = (r.data ?? []) as AttrDef[];
      setAttrs(list);
      const init: Record<string, string[]> = {};
      for (const a of list) {
        if (a.dataType === "SELECT" || a.dataType === "MULTI_SELECT" || a.isIdentity) {
          init[a.key] = [];
        }
      }
      setSelected(init);

      const keys = list.map((a) => a.key);
      if (!touched.current.productNameTemplate) {
        setProductNameTemplate(defaultProductNameTemplate(keys));
      }
      if (!touched.current.skuTemplate) {
        setSkuTemplate(defaultSkuPattern(keys));
      }
      if (!touched.current.nameTemplate) {
        setNameTemplate(defaultNamePattern(keys));
      }
    });
  }, [categoryId]);

  const brandName = useMemo(() => brands.find((b) => b.id === brandId)?.name ?? "", [brands, brandId]);
  const categoryName = useMemo(
    () => categories.find((c) => c.id === categoryId)?.name ?? "",
    [categories, categoryId]
  );
  const attrKeys = useMemo(() => attrs.map((a) => a.key), [attrs]);

  const axes = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(selected)) {
      if (v.length) out[k] = v;
    }
    return out;
  }, [selected]);

  // Progressive Product Name / Group Name / Display Group
  useEffect(() => {
    const baseTokens = buildProgressiveTokens(brandName, categoryName, "", selected, attrKeys);
    const suggestedName = expandTemplate(productNameTemplate, baseTokens);

    if (!touched.current.productName && suggestedName) {
      setProductName((prev) => (prev === suggestedName ? prev : suggestedName));
    }

    const resolvedProductName = touched.current.productName
      ? productName.trim()
      : suggestedName || productName.trim();

    if (!touched.current.groupName) {
      const gTokens = { ...baseTokens, productName: resolvedProductName };
      const suggestedGroup = expandTemplate(groupNameTemplate, gTokens) || resolvedProductName;
      if (suggestedGroup) {
        setGroupName((prev) => (prev === suggestedGroup ? prev : suggestedGroup));
      }
    }

    if (!touched.current.groupCode) {
      const code = slugify(brandName, categoryName);
      if (code) setGroupCode((prev) => (prev === code ? prev : code));
    }
  }, [
    brandName,
    categoryName,
    selected,
    attrKeys,
    productNameTemplate,
    groupNameTemplate,
    productName,
  ]);

  const multiValuedAxes = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v.length >= 2)
      .map(([k]) => ({
        key: k,
        label: attrs.find((a) => a.key === k)?.label || k,
        values: selected[k] ?? [],
      }));
  }, [selected, attrs]);

  // Keep price-varies-by on a multi-valued axis; seed empty config prices from Base Price
  useEffect(() => {
    if (pricingBasis !== "PER_EACH" || priceVariation !== "CONFIGURATION") return;
    if (!multiValuedAxes.length) {
      setPriceVariesBy("");
      return;
    }
    const axis = multiValuedAxes.find((a) => a.key === priceVariesBy) ?? multiValuedAxes[0];
    if (axis.key !== priceVariesBy) setPriceVariesBy(axis.key);
    setConfigPrices((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const v of axis.values) {
        const touchKey = `${axis.key}:${v}`;
        if (!configPriceTouched.current[touchKey] && (next[v] == null || next[v] === "")) {
          next[v] = sellPrice;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [multiValuedAxes, priceVariation, pricingBasis, priceVariesBy, sellPrice]);

  const payload = useCallback(() => {
    const base =
      pricingBasis === "PER_EACH"
        ? sellPrice === ""
          ? null
          : Number(sellPrice)
        : baseRate === ""
          ? null
          : Number(baseRate);

    const overrides: Record<string, number> = {};
    for (const [k, v] of Object.entries(rowOverrides)) {
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

    if (pricingBasis === "PER_EACH") {
      const values: Record<string, number> = {};
      if (priceVariation === "CONFIGURATION" && priceVariesBy) {
        for (const opt of selected[priceVariesBy] ?? []) {
          const raw = configPrices[opt];
          if (raw !== undefined && raw !== "" && Number.isFinite(Number(raw))) {
            values[opt] = Number(raw);
          }
        }
      }
      pricingPolicy = {
        type: priceVariation === "CONFIGURATION" && priceVariesBy ? "CONFIGURATION" : "SAME",
        basePrice: base,
        ...(priceVariation === "CONFIGURATION" && priceVariesBy
          ? { attribute: priceVariesBy, values }
          : {}),
        ...(Object.keys(overrides).length ? { overrides } : {}),
      };
    }

    const cost =
      costPrice.trim() === "" ? null : Number.isFinite(Number(costPrice)) ? Number(costPrice) : null;
    const reorder =
      reorderLevel.trim() === ""
        ? 10
        : Number.isFinite(Number(reorderLevel))
          ? Number(reorderLevel)
          : 10;
    const opening =
      openingStock.trim() === ""
        ? 0
        : Number.isFinite(Number(openingStock))
          ? Number(openingStock)
          : 0;

    return {
      categoryId,
      brandId: brandId || null,
      productName: productName.trim() || null,
      axes,
      skuTemplate: skuTemplate.trim() || null,
      nameTemplate: nameTemplate.trim() || null,
      barcodeTemplate: barcodeTemplate.trim() || null,
      groupCode: groupCode.trim() || null,
      groupName: groupName.trim() || productName.trim() || null,
      description: description.trim() || null,
      media: mediaImages.length ? { images: mediaImages } : null,
      costPrice: cost,
      reorderLevel: reorder,
      openingStock: opening > 0 ? opening : null,
      pricingBasis,
      pricingUom: pricingBasis === "PER_EACH" ? "each" : pricingUom,
      baseRate: base,
      sellPrice: pricingBasis === "PER_EACH" ? base : null,
      pricingPolicy,
    };
  }, [
    categoryId,
    brandId,
    productName,
    axes,
    skuTemplate,
    nameTemplate,
    barcodeTemplate,
    groupCode,
    groupName,
    description,
    mediaImages,
    costPrice,
    reorderLevel,
    openingStock,
    pricingBasis,
    pricingUom,
    baseRate,
    sellPrice,
    priceVariation,
    priceVariesBy,
    configPrices,
    rowOverrides,
    selected,
  ]);

  useEffect(() => {
    if (!categoryId || Object.keys(axes).length === 0) {
      setPlan(null);
      return;
    }
    const t = setTimeout(() => {
      setPreviewing(true);
      setError("");
      api("/api/products/preview", {
        method: "POST",
        body: JSON.stringify(payload()),
      })
        .then((r) => {
          setPlan((r.data as CreatePlan) ?? null);
        })
        .catch((err: unknown) => {
          setPlan(null);
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setPreviewing(false));
    }, 280);
    return () => clearTimeout(t);
  }, [categoryId, axes, payload]);

  function toggleValue(key: string, value: string) {
    setSelected((prev) => {
      const cur = prev[key] ?? [];
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
      return { ...prev, [key]: next };
    });
  }

  async function ensureDefaultWarehouse(): Promise<string> {
    const list = await api("/api/warehouses?limit=20");
    const existing = (list.data ?? []) as { id: string; name: string }[];
    if (existing[0]?.id) return existing[0].id;
    const created = await api("/api/warehouses", {
      method: "POST",
      body: JSON.stringify({ name: "Main Warehouse", location: "Primary" }),
    });
    const id = created.data?.id as string;
    if (!id) throw new Error("Could not create default warehouse");
    return id;
  }

  async function onCreate() {
    if (!plan || plan.create === 0) return;
    setBusy(true);
    setError("");
    try {
      const body = payload();
      const r = await api("/api/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const createdRows = (r.data?.created ?? []) as { id: string }[];
      const opening = body.openingStock != null ? Number(body.openingStock) : 0;
      if (opening > 0 && createdRows.length > 0) {
        try {
          const warehouseId = await ensureDefaultWarehouse();
          await api("/api/stock/receive", {
            method: "POST",
            body: JSON.stringify({
              items: createdRows.map((p) => ({
                productId: p.id,
                warehouseId,
                quantity: opening,
              })),
              reference: "INITIAL",
            }),
          });
        } catch (stockErr: unknown) {
          console.warn("Opening stock receive failed", stockErr);
        }
      }
      const created = r.data?.summary?.createdCount ?? createdRows.length ?? plan.create;
      const skipped = r.data?.summary?.skippedCount ?? plan.skip;
      setDoneMsg(
        skipped
          ? `${created} product${created === 1 ? "" : "s"} created · ${skipped} already existed`
          : `${created} product${created === 1 ? "" : "s"} created`
      );
      setTimeout(() => {
        onDone();
        onClose();
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const configurableAttrs = attrs.filter(
    (a) =>
      optionList(a.options).length > 0 ||
      a.dataType === "SELECT" ||
      a.dataType === "MULTI_SELECT" ||
      a.isIdentity
  );

  const rateLabel =
    pricingBasis === "PER_AREA"
      ? `Rate per ${pricingUom || "sq_ft"}`
      : pricingBasis === "PER_WEIGHT"
        ? `Rate per ${pricingUom || "kg"}`
        : pricingBasis === "PER_VOLUME"
          ? `Rate per ${pricingUom || "m3"}`
          : "Rate";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Create Product</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-7 flex-1">
          {/* Identity */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Identity</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Category
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Select category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Brand
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                >
                  <option value="">No brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
                Product Name
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={productName}
                  onChange={(e) => {
                    markTouched("productName");
                    setProductName(e.target.value);
                  }}
                  placeholder="Suggested from brand, category & configuration"
                />
              </label>
            </div>
          </section>

          {/* Commercial */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Commercial
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Media</div>
                <ProductMediaGallery
                  value={mediaImages}
                  onChange={setMediaImages}
                  helperText="These images will be shared by all products created here."
                  onError={(msg) => setError(msg)}
                />
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Display Name
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={groupName}
                  onChange={(e) => {
                    markTouched("groupName");
                    setGroupName(e.target.value);
                  }}
                  placeholder={productName || "Customer-facing family title"}
                />
                <span className="mt-1 block text-xs text-gray-400">Shown in Customer Portal</span>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Description
                <textarea
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[72px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional marketing description"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Display Group
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  value={groupCode}
                  onChange={(e) => {
                    markTouched("groupCode");
                    setGroupCode(e.target.value.toUpperCase().replace(/\s+/g, "-"));
                  }}
                  placeholder="CENTURY-PLYWOOD"
                />
                <span className="mt-1 block text-xs text-gray-400">Stable catalog key (auto-filled)</span>
              </label>
            </div>
          </section>

          {/* Configuration */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Configuration
            </h3>
            <p className="text-xs text-gray-400 mb-3">Options come from the selected category.</p>
            {!categoryId ? (
              <p className="text-sm text-gray-400">Select a category to configure options.</p>
            ) : configurableAttrs.length === 0 ? (
              <p className="text-sm text-gray-400">No configuration options for this category.</p>
            ) : (
              <div className="space-y-4">
                {configurableAttrs.map((a) => {
                  const opts = optionList(a.options);
                  return (
                    <div key={a.key}>
                      <div className="text-sm font-medium text-gray-800 mb-2">{a.label}</div>
                      {opts.length === 0 ? (
                        <p className="text-xs text-gray-400">No options defined</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {opts.map((opt) => {
                            const on = (selected[a.key] ?? []).includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => toggleValue(a.key, opt)}
                                className={`px-3 py-1.5 rounded-lg text-sm border ${
                                  on
                                    ? "bg-gray-900 text-white border-gray-900"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Pricing — adaptive + Price Variation */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Pricing</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Basis
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={pricingBasis}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPricingBasis(next);
                    setRowOverrides({});
                    if (next === "PER_AREA") setPricingUom("sq_ft");
                    if (next === "PER_WEIGHT") setPricingUom("kg");
                    if (next === "PER_VOLUME") setPricingUom("m3");
                    if (next !== "PER_EACH") setPriceVariation("SAME");
                  }}
                >
                  <option value="PER_EACH">PER_EACH</option>
                  <option value="PER_AREA">PER_AREA</option>
                  <option value="PER_WEIGHT">PER_WEIGHT</option>
                  <option value="PER_VOLUME">PER_VOLUME</option>
                </select>
              </label>
              {pricingBasis === "PER_EACH" ? (
                <label className="block text-sm font-medium text-gray-700">
                  Base Price
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="₹"
                  />
                </label>
              ) : (
                <label className="block text-sm font-medium text-gray-700">
                  {rateLabel}
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    value={baseRate}
                    onChange={(e) => setBaseRate(e.target.value)}
                  />
                </label>
              )}
            </div>

            {pricingBasis === "PER_EACH" && (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-medium text-gray-800">Price Variation</div>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priceVariation"
                      checked={priceVariation === "SAME"}
                      onChange={() => {
                        setPriceVariation("SAME");
                        setRowOverrides({});
                      }}
                    />
                    Same price for all products
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priceVariation"
                      checked={priceVariation === "CONFIGURATION"}
                      onChange={() => setPriceVariation("CONFIGURATION")}
                      disabled={multiValuedAxes.length === 0}
                    />
                    Different price by configuration
                    {multiValuedAxes.length === 0 && (
                      <span className="text-xs text-gray-400">(select 2+ options on a field first)</span>
                    )}
                  </label>
                </div>

                {priceVariation === "CONFIGURATION" && multiValuedAxes.length > 0 && (
                  <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Price varies by
                      <select
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                        value={priceVariesBy}
                        onChange={(e) => {
                          setPriceVariesBy(e.target.value);
                          setRowOverrides({});
                          configPriceTouched.current = {};
                        }}
                      >
                        {multiValuedAxes.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-2">
                      {(selected[priceVariesBy] ?? []).map((opt) => (
                        <div key={opt} className="flex items-center gap-3">
                          <span className="text-sm text-gray-800 w-28 shrink-0 truncate" title={opt}>
                            {opt}
                          </span>
                          <input
                            className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-white"
                            value={configPrices[opt] ?? ""}
                            onChange={(e) => {
                              configPriceTouched.current[`${priceVariesBy}:${opt}`] = true;
                              setConfigPrices((p) => ({ ...p, [opt]: e.target.value }));
                              setRowOverrides({});
                            }}
                            placeholder="₹"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Inventory */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Inventory
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-medium text-gray-700">
                Cost
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Opening Stock
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Reorder
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Cost and reorder apply to every product in this batch. Opening stock is received per product.
            </p>
          </section>

          {/* Optional Settings */}
          <section>
            <button
              type="button"
              onClick={() => setOptionalOpen((o) => !o)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              {optionalOpen ? "▾" : "▸"} Optional Settings
            </button>
            {optionalOpen && (
              <div className="mt-3 grid gap-3 border rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700">
                  Product Name Template
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono bg-white"
                    value={productNameTemplate}
                    onChange={(e) => {
                      markTouched("productNameTemplate");
                      setProductNameTemplate(e.target.value);
                    }}
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Display Name Template
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono bg-white"
                    value={groupNameTemplate}
                    onChange={(e) => {
                      markTouched("groupNameTemplate");
                      setGroupNameTemplate(e.target.value);
                    }}
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  SKU Pattern
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono bg-white"
                    value={skuTemplate}
                    onChange={(e) => {
                      markTouched("skuTemplate");
                      setSkuTemplate(e.target.value);
                    }}
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Name Pattern
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono bg-white"
                    value={nameTemplate}
                    onChange={(e) => {
                      markTouched("nameTemplate");
                      setNameTemplate(e.target.value);
                    }}
                  />
                  <span className="mt-1 block text-xs text-gray-400">
                    Per-product names in Preview
                  </span>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Barcode Pattern
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono bg-white"
                    value={barcodeTemplate}
                    onChange={(e) => setBarcodeTemplate(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>
            )}
          </section>

          {/* Preview — hero with primary media */}
          <section className="min-h-[220px]">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Preview
                {plan ? (
                  <span className="font-normal text-gray-500">
                    {" "}
                    ({plan.total} Product{plan.total === 1 ? "" : "s"})
                  </span>
                ) : null}
              </h3>
              {previewing && <span className="text-xs text-gray-400">Updating…</span>}
            </div>
            {!plan || plan.products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-14 text-center text-sm text-gray-400">
                Select configuration options to see what will be created.
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                <div className="flex gap-4 p-4 border-b border-gray-100 items-center bg-gray-50/80">
                  <div className="h-20 w-20 shrink-0 rounded-xl overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                    {mediaImages[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaImages[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl text-gray-300 font-light">
                        {(groupName || productName || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 text-base leading-snug truncate">
                      {groupName || productName || "Untitled product"}
                    </div>
                    {description.trim() ? (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{description.trim()}</p>
                    ) : null}
                  </div>
                </div>
                <div className="divide-y divide-gray-100 max-h-[280px] overflow-y-auto">
                  {plan.products.map((p) => (
                    <div key={p.index} className="px-4 py-3 flex gap-3 items-start">
                      <div className="pt-0.5 w-5 shrink-0 text-center">
                        {p.status === "willCreate" ? (
                          <span className="text-emerald-600 font-semibold">✓</span>
                        ) : p.status === "alreadyExists" ? (
                          <span className="text-amber-600">⚠</span>
                        ) : (
                          <span className="text-red-500">×</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm leading-snug">{p.name}</div>
                        {p.status === "alreadyExists" ? (
                          <div className="text-xs text-amber-700 mt-0.5">Already exists</div>
                        ) : (
                          <>
                            <div className="text-xs font-mono text-gray-500 mt-0.5">{p.sku}</div>
                            {p.priceDetail && (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {p.priceSource === "OVERRIDE"
                                  ? "Manual Override"
                                  : p.priceSource === "CONFIGURATION"
                                    ? `Configuration · ${p.priceDetail}`
                                    : p.priceDetail}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {p.status === "willCreate" && pricingBasis === "PER_EACH" ? (
                        <input
                          className="w-28 border rounded-lg px-2 py-1 text-sm text-right tabular-nums shrink-0"
                          value={
                            rowOverrides[String(p.index)] !== undefined
                              ? rowOverrides[String(p.index)]
                              : p.unitPrice != null
                                ? String(p.unitPrice)
                                : ""
                          }
                          onChange={(e) =>
                            setRowOverrides((prev) => ({ ...prev, [String(p.index)]: e.target.value }))
                          }
                          title="Override this row’s price"
                        />
                      ) : p.status !== "alreadyExists" ? (
                        <div className="text-sm font-semibold tabular-nums text-gray-800 shrink-0">
                          {formatPrice(p.unitPrice)}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {doneMsg && <p className="text-sm text-emerald-700">{doneMsg}</p>}
        </div>

        <div className="border-t px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-gray-50 rounded-b-xl">
          <div className="text-sm text-gray-600">
            {plan && plan.total > 0 ? (
              <>
                <div>
                  {plan.create} Product{plan.create === 1 ? "" : "s"} will be created
                </div>
                {plan.skip > 0 && (
                  <div className="text-amber-700">
                    {plan.skip} already exists
                  </div>
                )}
              </>
            ) : (
              <span className="text-gray-400">Select configuration to continue</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !plan || plan.create === 0}
              onClick={() => void onCreate()}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

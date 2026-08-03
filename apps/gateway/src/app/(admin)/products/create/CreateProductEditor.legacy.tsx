"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  StudioLayout,
  StepRail,
  SummaryPanel,
  ProductSummaryBlock,
  VariantPreviewGrid,
  MediaPreviewBlock,
  WorkspaceCard,
  MetricTile,
  FooterActions,
  FooterStat,
  StudioSectionCollapse,
  type StudioStep,
  type WarningItem,
} from "@erp/ui";
import { api, getTenantId } from "@/lib/admin-api";
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

type StudioStepId = "identity" | "configuration" | "commercial" | "pricing" | "review";

const STEPS: { id: StudioStepId; label: string; hint: string }[] = [
  { id: "identity", label: "Identity", hint: "Basic information about the product" },
  { id: "configuration", label: "Configuration", hint: "Attributes & variants" },
  { id: "commercial", label: "Commercial", hint: "Media & listing" },
  { id: "pricing", label: "Pricing & Inventory", hint: "How you sell & stock" },
  { id: "review", label: "Review", hint: "Confirm & create" },
];

const DEFAULT_PRODUCT_NAME_TEMPLATE = "{brand} {grade} {thickness_mm}mm {size} {category}";
const DEFAULT_GROUP_NAME_TEMPLATE = "{productName}";

const fieldClass =
  "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition-[border-color,box-shadow] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";

function draftKey() {
  return `create-product-studio-draft:${getTenantId() || "default"}`;
}

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

function expandTemplate(template: string, tokens: Record<string, string>): string {
  let out = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const v = tokens[key];
    return v != null && String(v).trim() !== "" ? String(v).trim() : "";
  });
  out = out
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+mm\b/gi, "$1mm")
    .replace(/^\s*mm\s+/i, "")
    .replace(/\s+mm\s*$/i, "")
    .replace(/\s+mm\s+/gi, " ")
    .trim();
  return out;
}

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
  const parts = ["{brand}"];
  if (attrKeys.includes("grade")) parts.push("{grade}");
  if (attrKeys.includes("thickness_mm")) parts.push("{thickness_mm}mm");
  if (attrKeys.includes("size")) parts.push("{size}");
  if (attrKeys.includes("color")) parts.push("{color}");
  if (attrKeys.includes("storage")) parts.push("{storage}");
  parts.push("{category}");
  return parts.join(" ") || DEFAULT_PRODUCT_NAME_TEMPLATE;
}

function StudioField({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium text-[var(--ink-soft)] ${className}`}>
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-[var(--ink-soft)]">{hint}</span> : null}
    </label>
  );
}

export function CreateProductEditor({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<StudioStepId>("identity");
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
  const [mediaVariation, setMediaVariation] = useState<"SAME" | "CONFIGURATION">("SAME");
  const [mediaVariesBy, setMediaVariesBy] = useState("");
  const [mediaByValue, setMediaByValue] = useState<Record<string, string[]>>({});
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
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const draftRestored = useRef(false);

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

  // Restore draft once
  useEffect(() => {
    if (draftRestored.current) return;
    draftRestored.current = true;
    try {
      const raw = sessionStorage.getItem(draftKey());
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.categoryId === "string") setCategoryId(d.categoryId);
      if (typeof d.brandId === "string") setBrandId(d.brandId);
      if (typeof d.productName === "string") {
        setProductName(d.productName);
        touched.current.productName = true;
      }
      if (typeof d.groupName === "string") {
        setGroupName(d.groupName);
        touched.current.groupName = true;
      }
      if (typeof d.groupCode === "string") {
        setGroupCode(d.groupCode);
        touched.current.groupCode = true;
      }
      if (typeof d.description === "string") setDescription(d.description);
      if (Array.isArray(d.mediaImages)) setMediaImages(d.mediaImages as string[]);
      if (d.mediaVariation === "SAME" || d.mediaVariation === "CONFIGURATION") setMediaVariation(d.mediaVariation);
      if (typeof d.mediaVariesBy === "string") setMediaVariesBy(d.mediaVariesBy);
      if (d.mediaByValue && typeof d.mediaByValue === "object") setMediaByValue(d.mediaByValue as Record<string, string[]>);
      if (typeof d.costPrice === "string") setCostPrice(d.costPrice);
      if (typeof d.openingStock === "string") setOpeningStock(d.openingStock);
      if (typeof d.reorderLevel === "string") setReorderLevel(d.reorderLevel);
      if (d.selected && typeof d.selected === "object") setSelected(d.selected as Record<string, string[]>);
      if (typeof d.pricingBasis === "string") setPricingBasis(d.pricingBasis);
      if (typeof d.pricingUom === "string") setPricingUom(d.pricingUom);
      if (typeof d.baseRate === "string") setBaseRate(d.baseRate);
      if (typeof d.sellPrice === "string") setSellPrice(d.sellPrice);
      if (d.priceVariation === "SAME" || d.priceVariation === "CONFIGURATION") setPriceVariation(d.priceVariation);
      if (typeof d.priceVariesBy === "string") setPriceVariesBy(d.priceVariesBy);
      if (d.configPrices && typeof d.configPrices === "object") setConfigPrices(d.configPrices as Record<string, string>);
      if (typeof d.productNameTemplate === "string") setProductNameTemplate(d.productNameTemplate);
      if (typeof d.groupNameTemplate === "string") setGroupNameTemplate(d.groupNameTemplate);
      if (typeof d.skuTemplate === "string") setSkuTemplate(d.skuTemplate);
      if (typeof d.nameTemplate === "string") setNameTemplate(d.nameTemplate);
      if (typeof d.barcodeTemplate === "string") setBarcodeTemplate(d.barcodeTemplate);
      if (typeof d.savedAt === "string") setDraftSavedAt(d.savedAt);
      if (typeof d.step === "string" && STEPS.some((s) => s.id === d.step)) setStep(d.step as StudioStepId);
    } catch {
      /* ignore corrupt draft */
    }
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
      setSelected((prev) => {
        const init: Record<string, string[]> = {};
        for (const a of list) {
          if (a.dataType === "SELECT" || a.dataType === "MULTI_SELECT" || a.isIdentity) {
            init[a.key] = prev[a.key] ?? [];
          }
        }
        return init;
      });

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
  }, [brandName, categoryName, selected, attrKeys, productNameTemplate, groupNameTemplate, productName]);

  const multiValuedAxes = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v.length >= 2)
      .map(([k]) => ({
        key: k,
        label: attrs.find((a) => a.key === k)?.label || k,
        values: selected[k] ?? [],
      }));
  }, [selected, attrs]);

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

  useEffect(() => {
    if (mediaVariation !== "CONFIGURATION") return;
    if (!multiValuedAxes.length) {
      setMediaVariesBy("");
      return;
    }
    if (!multiValuedAxes.some((a) => a.key === mediaVariesBy)) {
      setMediaVariesBy(multiValuedAxes[0].key);
    }
  }, [multiValuedAxes, mediaVariation, mediaVariesBy]);

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

    const defaultImages = mediaImages.filter(Boolean);
    if (mediaVariation === "CONFIGURATION" && mediaVariesBy) {
      const values: Record<string, string[]> = {};
      for (const opt of selected[mediaVariesBy] ?? []) {
        const urls = (mediaByValue[opt] ?? []).filter(Boolean);
        if (urls.length) values[opt] = urls;
      }
      if (defaultImages.length || Object.keys(values).length) {
        media = {
          images: defaultImages,
          variation: {
            type: "CONFIGURATION",
            attributes: [mediaVariesBy],
            values,
          },
        };
      }
    } else if (defaultImages.length) {
      media = { images: defaultImages };
    }

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
      media,
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
    mediaVariation,
    mediaVariesBy,
    mediaByValue,
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
      try {
        sessionStorage.removeItem(draftKey());
      } catch {
        /* ignore */
      }
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

  function saveDraft() {
    const savedAt = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const data = {
      step,
      categoryId,
      brandId,
      productName,
      groupName,
      groupCode,
      description,
      mediaImages,
      mediaVariation,
      mediaVariesBy,
      mediaByValue,
      costPrice,
      openingStock,
      reorderLevel,
      selected,
      pricingBasis,
      pricingUom,
      baseRate,
      sellPrice,
      priceVariation,
      priceVariesBy,
      configPrices,
      productNameTemplate,
      groupNameTemplate,
      skuTemplate,
      nameTemplate,
      barcodeTemplate,
      savedAt,
    };
    try {
      sessionStorage.setItem(draftKey(), JSON.stringify(data));
      setDraftSavedAt(savedAt);
    } catch {
      setError("Could not save draft locally");
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

  const hasConfigSelection = Object.values(selected).some((v) => v.length > 0);
  const identityDone = Boolean(categoryId);
  const configDone =
    Boolean(categoryId) && (configurableAttrs.length === 0 || hasConfigSelection);
  const commercialDone = mediaImages.length > 0 || mediaVariation === "CONFIGURATION";
  const priceValue =
    pricingBasis === "PER_EACH"
      ? sellPrice === ""
        ? null
        : Number(sellPrice)
      : baseRate === ""
        ? null
        : Number(baseRate);
  const pricingDone =
    pricingBasis === "PER_EACH"
      ? sellPrice.trim() !== "" && Number.isFinite(Number(sellPrice))
      : baseRate.trim() !== "" && Number.isFinite(Number(baseRate));

  function doneForStep(id: StudioStepId): boolean {
    if (id === "identity") return identityDone;
    if (id === "configuration") return configDone;
    if (id === "commercial") return commercialDone;
    if (id === "pricing") return pricingDone;
    return Boolean(plan && plan.create > 0);
  }

  const studioSteps: StudioStep[] = STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    hint: s.hint,
    status: s.id === step ? "current" : doneForStep(s.id) ? "done" : "upcoming",
  }));

  const imagesLabel =
    mediaVariation === "CONFIGURATION" && mediaVariesBy
      ? `Varies by ${attrs.find((a) => a.key === mediaVariesBy)?.label || mediaVariesBy}`
      : mediaImages.length
        ? "Shared across all"
        : "None";

  const displayProduct = groupName.trim() || productName.trim() || brandName || "Untitled";
  const shortDesc = description.slice(0, 160);

  const warnings: WarningItem[] = [];
  if (!categoryId) warnings.push({ id: "category", message: "Category required" });
  if (categoryId && configurableAttrs.length > 0 && !hasConfigSelection) {
    warnings.push({ id: "config", message: "No configuration selected" });
  }
  if (!mediaImages.length && mediaVariation === "SAME") {
    warnings.push({ id: "media", message: "No media uploaded" });
  }
  if (!pricingDone) warnings.push({ id: "pricing", message: "Pricing missing" });
  if (plan && plan.invalid > 0) {
    warnings.push({ id: "invalid", message: `${plan.invalid} invalid product(s)`, tone: "error" });
  }
  if (plan?.warnings?.length) {
    for (const w of plan.warnings.slice(0, 3)) {
      warnings.push({ id: `plan-${w}`, message: w });
    }
  }

  const ready =
    identityDone &&
    configDone &&
    pricingDone &&
    Boolean(plan && plan.create > 0) &&
    !(plan && plan.invalid > 0);

  const statusNode = busy ? (
    "Creating…"
  ) : draftSavedAt ? (
    <span>
      Saved locally <span className="font-normal text-[var(--ink-soft)]">· {draftSavedAt}</span>
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[var(--amber)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--amber)]">
      Draft
    </span>
  );

  function goNext() {
    const i = STEPS.findIndex((s) => s.id === step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1].id);
  }

  const btnGhost =
    "px-4 py-2 rounded-lg text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--mist)] hover:text-[var(--ink)]";
  const btnSecondary =
    "px-4 py-2 rounded-lg text-sm font-medium bg-[var(--surface-raised)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--mist)]";
  const btnPrimary =
    "px-5 py-2.5 rounded-lg text-sm font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-mid)] disabled:opacity-40 shadow-[var(--shadow-sm)]";

  const configSummaryText = (() => {
    if (!hasConfigSelection) return "No attributes selected";
    const parts = configurableAttrs
      .map((a) => {
        const vals = selected[a.key] ?? [];
        if (!vals.length) return null;
        return `${a.label} ${vals.join(", ")}`;
      })
      .filter(Boolean);
    return parts.join(" · ") || "Configured";
  })();

  function sectionBadge(text: string) {
    return (
      <span className="rounded-full bg-[var(--mist)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-soft)]">
        {text}
      </span>
    );
  }

  const identityExpanded = (
    <WorkspaceCard title="Identity" description="Classify this product family before configuring variants.">
      <div className="grid gap-3 sm:grid-cols-2">
        <StudioField label="Category *">
          <select className={fieldClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </StudioField>
        <StudioField label="Brand">
          <select className={fieldClass} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </StudioField>
        <StudioField
          label="Product Name"
          className="sm:col-span-2"
          hint="Suggested from brand, category & configuration"
        >
          <input
            className={fieldClass}
            value={productName}
            onChange={(e) => {
              markTouched("productName");
              setProductName(e.target.value);
            }}
            placeholder="Suggested from brand, category & configuration"
          />
        </StudioField>
        <StudioField label="Short Description" className="sm:col-span-2">
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={shortDesc}
            maxLength={160}
            onChange={(e) => setDescription(e.target.value.slice(0, 160))}
            placeholder="Optional short description for catalog cards"
          />
          <span className="mt-1 block text-right text-[11px] text-[var(--ink-soft)] tabular-nums">
            {shortDesc.length}/160
          </span>
        </StudioField>
      </div>
      <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--mist)]/70 px-3 py-2.5 text-xs text-[var(--ink-soft)] leading-relaxed">
        You can refine variants, media, pricing and inventory in the next steps.
      </div>
    </WorkspaceCard>
  );

  const configurationExpanded = (
    <div className="space-y-4">
      <WorkspaceCard
        title="Configuration"
        description="Options come from the selected category. This is the heart of the product family."
        className="ring-1 ring-[color-mix(in_srgb,var(--brand)_12%,transparent)]"
      >
        {!categoryId ? (
          <p className="text-sm text-[var(--ink-soft)]">Select a category on Identity first.</p>
        ) : configurableAttrs.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No configuration options for this category.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)] mb-3">
                Attributes
              </div>
              <div className="space-y-4">
                {configurableAttrs.map((a) => {
                  const opts = optionList(a.options);
                  return (
                    <div key={a.key}>
                      <div className="text-sm font-medium text-[var(--ink)] mb-2">{a.label}</div>
                      {opts.length === 0 ? (
                        <p className="text-xs text-[var(--ink-soft)]">No options defined</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {opts.map((opt) => {
                            const on = (selected[a.key] ?? []).includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => toggleValue(a.key, opt)}
                                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                  on
                                    ? "bg-[var(--ink)] text-white border-[var(--ink)]"
                                    : "bg-[var(--surface-raised)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--brand-mid)]"
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
            </div>
          </div>
        )}
      </WorkspaceCard>

      <WorkspaceCard
        title="Products to Create"
        description={previewing ? "Updating preview…" : "Live cartesian result of your attribute selections."}
        headerRight={
          plan ? (
            <span className="text-xs text-[var(--ink-soft)] tabular-nums">{plan.total} total</span>
          ) : null
        }
      >
        {!plan || plan.products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--ink-soft)]">
            Select configuration options to see the product family.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)] max-h-[240px] overflow-y-auto rounded-lg border border-[var(--line)]">
            {plan.products.map((p) => (
              <li key={p.index} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className="mt-0.5 w-5 shrink-0 text-center font-semibold">
                  {p.status === "willCreate" ? (
                    <span className="text-emerald-600">✓</span>
                  ) : p.status === "alreadyExists" ? (
                    <span className="text-[var(--ink-soft)]">○</span>
                  ) : (
                    <span className="text-amber-600">⚠</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--ink)] leading-snug">{p.name}</div>
                  <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">
                    {p.status === "willCreate"
                      ? "Will create"
                      : p.status === "alreadyExists"
                        ? "Already exists"
                        : "Invalid"}
                    {p.sku ? ` · ${p.sku}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WorkspaceCard>

      {plan && plan.products.length > 0 ? (
        <WorkspaceCard title="Variant Matrix" description="Compact grid of combinations.">
          <div className="flex flex-wrap gap-2">
            {plan.products.map((p) => (
              <span
                key={p.index}
                className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                  p.status === "willCreate"
                    ? "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)]"
                    : p.status === "alreadyExists"
                      ? "border-[var(--line)] bg-[var(--mist)] text-[var(--ink-soft)]"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {p.name}
              </span>
            ))}
          </div>
        </WorkspaceCard>
      ) : null}
    </div>
  );

  const commercialExpanded = (
    <div className="space-y-4">
      <WorkspaceCard title="Commercial" description="Visual assets for this product family.">
        <div className="min-h-[12rem]">
          <ProductMediaGallery
            variant="studio"
            value={mediaImages}
            onChange={setMediaImages}
            helperText={
              mediaVariation === "SAME"
                ? "These images will be shared by all products created here."
                : "Default images used when a configuration value has no gallery."
            }
            onError={(msg) => setError(msg)}
          />
        </div>
        <div className="mt-5 space-y-3 border-t border-[var(--line)] pt-4">
          <div className="text-sm font-medium text-[var(--ink)]">Media Variation</div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mediaVariation"
                checked={mediaVariation === "SAME"}
                onChange={() => setMediaVariation("SAME")}
              />
              Same images for all products in this batch
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mediaVariation"
                checked={mediaVariation === "CONFIGURATION"}
                onChange={() => {
                  setMediaVariation("CONFIGURATION");
                  if (!mediaVariesBy && multiValuedAxes[0]) setMediaVariesBy(multiValuedAxes[0].key);
                }}
                disabled={multiValuedAxes.length === 0}
              />
              Images vary by configuration
              {multiValuedAxes.length === 0 && (
                <span className="text-xs text-[var(--ink-soft)]">(select 2+ options first)</span>
              )}
            </label>
          </div>
          {mediaVariation === "CONFIGURATION" && multiValuedAxes.length > 0 && (
            <div className="border border-[var(--line)] rounded-lg p-3 bg-[var(--mist)] space-y-4">
              <StudioField label="Media varies by">
                <select
                  className={fieldClass}
                  value={mediaVariesBy || multiValuedAxes[0]?.key || ""}
                  onChange={(e) => {
                    setMediaVariesBy(e.target.value);
                    setMediaByValue({});
                  }}
                >
                  {multiValuedAxes.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </StudioField>
              {(selected[mediaVariesBy || multiValuedAxes[0]?.key] ?? []).map((opt) => (
                <div key={opt} className="space-y-1">
                  <div className="text-sm font-medium text-[var(--ink)]">{opt}</div>
                  <ProductMediaGallery
                    value={mediaByValue[opt] ?? []}
                    onChange={(urls) => setMediaByValue((prev) => ({ ...prev, [opt]: urls }))}
                    onError={(msg) => setError(msg)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </WorkspaceCard>
      <WorkspaceCard title="Listing">
        <div className="space-y-3">
          <StudioField label="Display Name" hint="Shown in Customer Portal">
            <input
              className={fieldClass}
              value={groupName}
              onChange={(e) => {
                markTouched("groupName");
                setGroupName(e.target.value);
              }}
              placeholder={productName || "Customer-facing family title"}
            />
          </StudioField>
          <StudioField label="Display Group">
            <input
              className={fieldClass}
              value={groupCode}
              onChange={(e) => {
                markTouched("groupCode");
                setGroupCode(e.target.value);
              }}
              placeholder="Slug / group code"
            />
          </StudioField>
        </div>
      </WorkspaceCard>
    </div>
  );

  const pricingExpanded = (
    <div className="space-y-4">
      <WorkspaceCard title="Pricing" description="How this family is sold.">
        <div className="grid gap-3 sm:grid-cols-2">
          <StudioField label="Basis">
            <select
              className={fieldClass}
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
          </StudioField>
          {pricingBasis === "PER_EACH" ? (
            <StudioField label="Base Price">
              <input
                className={fieldClass}
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="₹"
              />
            </StudioField>
          ) : (
            <StudioField label={rateLabel}>
              <input className={fieldClass} value={baseRate} onChange={(e) => setBaseRate(e.target.value)} />
            </StudioField>
          )}
        </div>
        {pricingBasis === "PER_EACH" && (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-medium text-[var(--ink)]">Price Variation</div>
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
              </label>
            </div>
            {priceVariation === "CONFIGURATION" && multiValuedAxes.length > 0 && (
              <div className="border border-[var(--line)] rounded-lg p-3 bg-[var(--mist)] space-y-3">
                <StudioField label="Price varies by">
                  <select
                    className={fieldClass}
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
                </StudioField>
                {(selected[priceVariesBy] ?? []).map((opt) => (
                  <div key={opt} className="flex items-center gap-3">
                    <span className="text-sm text-[var(--ink)] w-28 shrink-0 truncate">{opt}</span>
                    <input
                      className={`flex-1 ${fieldClass}`}
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
            )}
          </div>
        )}
      </WorkspaceCard>
      <WorkspaceCard title="Inventory" description="Applies across the batch.">
        <div className="grid gap-3 sm:grid-cols-3">
          <StudioField label="Cost">
            <input
              className={fieldClass}
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="Optional"
            />
          </StudioField>
          <StudioField label="Opening Stock">
            <input
              className={fieldClass}
              value={openingStock}
              onChange={(e) => setOpeningStock(e.target.value)}
              placeholder="0"
            />
          </StudioField>
          <StudioField label="Reorder">
            <input
              className={fieldClass}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
            />
          </StudioField>
        </div>
      </WorkspaceCard>
    </div>
  );

  const reviewExpanded = (
    <div className="space-y-4">
      <WorkspaceCard title="Review" description="Confirm the product family before creating.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
          <MetricTile value={plan?.create ?? 0} label="Products" tone={plan?.create ? "default" : "muted"} />
          <MetricTile
            value={imagesLabel === "None" ? "—" : imagesLabel.startsWith("Shared") ? "Shared" : "Varies"}
            label="Media"
          />
          <MetricTile
            value={pricingDone ? formatPrice(priceValue) : "—"}
            label="Price"
            tone={pricingDone ? "default" : "warning"}
          />
          <MetricTile
            value={ready ? "✓" : warnings.length}
            label={ready ? "Ready" : "Warnings"}
            tone={ready ? "success" : "warning"}
          />
        </div>
        {!plan || plan.products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-14 text-center text-sm text-[var(--ink-soft)]">
            Select configuration options to see what will be created.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--line)] overflow-hidden">
            <div className="flex gap-4 p-4 border-b border-[var(--line)] items-center bg-[var(--mist)]/80">
              <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--surface-raised)] flex items-center justify-center">
                {mediaImages[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaImages[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl text-[var(--ink-soft)] font-light">
                    {displayProduct.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[var(--ink)] truncate">{displayProduct}</div>
                {shortDesc ? (
                  <p className="text-xs text-[var(--ink-soft)] mt-1 line-clamp-2">{shortDesc}</p>
                ) : null}
              </div>
            </div>
            <div className="divide-y divide-[var(--line)] max-h-[280px] overflow-y-auto">
              {plan.products.map((p) => (
                <div key={p.index} className="px-4 py-3 flex gap-3 items-start">
                  <div className="pt-0.5 w-5 shrink-0 text-center">
                    {p.status === "willCreate" ? (
                      <span className="text-emerald-600 font-semibold">✓</span>
                    ) : p.status === "alreadyExists" ? (
                      <span className="text-[var(--ink-soft)]">○</span>
                    ) : (
                      <span className="text-amber-600">⚠</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--ink)] text-sm">{p.name}</div>
                    {p.status !== "alreadyExists" && (
                      <div className="text-xs font-mono text-[var(--ink-soft)] mt-0.5">{p.sku}</div>
                    )}
                  </div>
                  {p.status === "willCreate" && pricingBasis === "PER_EACH" ? (
                    <input
                      className="w-28 border border-[var(--line)] rounded-lg px-2 py-1 text-sm text-right tabular-nums shrink-0"
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
                    />
                  ) : p.status !== "alreadyExists" ? (
                    <div className="text-sm font-semibold tabular-nums shrink-0">{formatPrice(p.unitPrice)}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </WorkspaceCard>
      <WorkspaceCard>
        <button
          type="button"
          onClick={() => setOptionalOpen((o) => !o)}
          className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] font-medium"
        >
          {optionalOpen ? "▾" : "▸"} Optional Settings
        </button>
        {optionalOpen && (
          <div className="mt-3 grid gap-3 border border-[var(--line)] rounded-lg p-4 bg-[var(--mist)]">
            {(
              [
                ["Product Name Template", productNameTemplate, setProductNameTemplate, "productNameTemplate"],
                ["Display Name Template", groupNameTemplate, setGroupNameTemplate, "groupNameTemplate"],
                ["SKU Pattern", skuTemplate, setSkuTemplate, "skuTemplate"],
                ["Name Pattern", nameTemplate, setNameTemplate, "nameTemplate"],
              ] as const
            ).map(([label, val, setter, touch]) => (
              <StudioField key={label} label={label}>
                <input
                  className={`${fieldClass} font-mono`}
                  value={val}
                  onChange={(e) => {
                    markTouched(touch);
                    setter(e.target.value);
                  }}
                />
              </StudioField>
            ))}
            <StudioField label="Barcode Pattern">
              <input
                className={`${fieldClass} font-mono`}
                value={barcodeTemplate}
                onChange={(e) => setBarcodeTemplate(e.target.value)}
                placeholder="Optional"
              />
            </StudioField>
          </div>
        )}
      </WorkspaceCard>
    </div>
  );

  const accordion = (
    <div className="space-y-3 max-w-3xl mx-auto lg:mx-0 lg:max-w-none">
      {step === "identity" ? (
        identityExpanded
      ) : (
        <StudioSectionCollapse
          title="Identity"
          done={identityDone}
          summary={[categoryName, brandName, productName].filter(Boolean).join(" · ") || "Not set"}
          onExpand={() => setStep("identity")}
        />
      )}
      {step === "configuration" ? (
        configurationExpanded
      ) : (
        <StudioSectionCollapse
          title="Configuration"
          done={configDone}
          summary={configSummaryText}
          badge={
            plan?.total
              ? sectionBadge(`${plan.create || plan.total} variant${(plan.create || plan.total) === 1 ? "" : "s"}`)
              : undefined
          }
          onExpand={() => setStep("configuration")}
        />
      )}
      {step === "commercial" ? (
        commercialExpanded
      ) : (
        <StudioSectionCollapse
          title="Commercial"
          done={commercialDone}
          summary={mediaImages.length ? `${mediaImages.length} image${mediaImages.length === 1 ? "" : "s"} · ${imagesLabel}` : "No images added"}
          onExpand={() => setStep("commercial")}
        />
      )}
      {step === "pricing" ? (
        pricingExpanded
      ) : (
        <StudioSectionCollapse
          title="Pricing & Inventory"
          done={pricingDone}
          summary={
            pricingDone
              ? `${pricingBasis.replace("PER_", "")} · ${formatPrice(priceValue)}`
              : "Not set"
          }
          onExpand={() => setStep("pricing")}
        />
      )}
      {step === "review" ? (
        reviewExpanded
      ) : (
        <StudioSectionCollapse
          title="Review"
          done={ready}
          summary={ready ? "Ready to create" : warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "Pending"}
          onExpand={() => setStep("review")}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {doneMsg && <p className="text-sm text-emerald-700">{doneMsg}</p>}
    </div>
  );

  const summaryPanel = (
    <SummaryPanel warnings={warnings} ready={ready} showWarnings>
      <ProductSummaryBlock
        rows={[
          { label: "Category", value: categoryName || "—" },
          { label: "Brand", value: brandName || "—" },
          {
            label: "Variants",
            value: plan ? `${plan.total} combination${plan.total === 1 ? "" : "s"}` : "—",
          },
          { label: "Images", value: imagesLabel },
          { label: "Status", value: statusNode },
        ]}
      />
      <VariantPreviewGrid
        items={(plan?.products ?? []).map((p) => ({
          id: String(p.index),
          label: p.name,
          status: p.status,
        }))}
      />
      <MediaPreviewBlock images={mediaImages} />
    </SummaryPanel>
  );

  // Mobile summary + step chips
  const mobileChrome = (
    <div className="mb-3 space-y-3 lg:hidden">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold border ${
              s.id === step
                ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                : "bg-[var(--surface-raised)] text-[var(--ink-soft)] border-[var(--line)]"
            }`}
          >
            {i + 1}. {s.label.split(" ")[0]}
          </button>
        ))}
      </div>
      <div>{summaryPanel}</div>
    </div>
  );

  return (
    <div className="h-full min-h-0 flex flex-col">
      <StudioLayout
        variant="page"
        header={
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[var(--ink-soft)] truncate">
                <span className="text-[var(--accent)] font-bold uppercase tracking-[0.14em]">Catalog</span>
                <span className="mx-1.5 text-[var(--line)]">/</span>
                Products
                <span className="mx-1.5 text-[var(--line)]">/</span>
                Create Product
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--ink)] mt-1 tracking-tight">
                Create Product
              </h1>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Build once. Publish across all channels.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={saveDraft} className={btnSecondary}>
                Save draft
              </button>
              <button type="button" onClick={onClose} className={btnGhost} aria-label="Close">
                ×
              </button>
            </div>
          </div>
        }
        rail={<StepRail steps={studioSteps} onSelect={(id) => setStep(id as StudioStepId)} />}
        workspace={
          <>
            {mobileChrome}
            {accordion}
          </>
        }
        summary={summaryPanel}
        footer={
          <FooterActions
            stats={
              <>
                <FooterStat
                  label="Products to be created"
                  value={`${plan?.create ?? 0} variant${(plan?.create ?? 0) === 1 ? "" : "s"}`}
                />
                <FooterStat label="Media" value={imagesLabel} />
                <FooterStat label="Status" value={draftSavedAt ? `Saved · ${draftSavedAt}` : "Draft"} />
              </>
            }
            actions={
              <>
                <button type="button" onClick={onClose} className={btnGhost}>
                  Cancel
                </button>
                <button type="button" onClick={saveDraft} className={btnSecondary}>
                  Save draft
                </button>
                {step !== "review" ? (
                  <button type="button" onClick={goNext} className={btnPrimary}>
                    Continue →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !plan || plan.create === 0}
                    onClick={() => void onCreate()}
                    className={btnPrimary}
                  >
                    {busy
                      ? "Creating…"
                      : `Create ${plan?.create ?? 0} Product${(plan?.create ?? 0) === 1 ? "" : "s"}`}
                  </button>
                )}
              </>
            }
          />
        }
      />
    </div>
  );
}

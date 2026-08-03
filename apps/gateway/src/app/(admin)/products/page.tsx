"use client";
import { useEffect, useRef, useState } from "react";
import { ActionGroup, Button, SquarePen, Trash2 } from "@erp/ui";
import { api, getAdminUser } from "@/lib/admin-api";
import { fetchPricingQuote, type QuoteSuccess } from "@/lib/pricing-quote";
import dynamic from "next/dynamic";
import { ProductEditorForm } from "./ProductEditorForm";
import {
  ProductPricingSection,
  isMeasuredPricingBasis,
} from "./ProductPricingSection";
import { ProductInventorySection } from "./ProductInventorySection";
import { ProductVariantsSection } from "./ProductVariantsSection";
import { CreateProductEditor } from "./CreateProductEditor";
import { ProductMediaGallery } from "@/components/ProductMediaGallery";

const iconSm = { width: "var(--icon-sm)", height: "var(--icon-sm)" } as const;
const deleteIconBtn =
  "text-[var(--ink-soft)] hover:text-[var(--danger)] focus-visible:text-[var(--danger)]";

const BarcodeScannerModal = dynamic(() => import("@/components/BarcodeScannerModal"), { ssr: false });

const FIELD_TYPES = ["TEXT", "NUMBER", "SELECT", "MULTI_SELECT", "BOOLEAN", "UNIT_NUMBER"] as const;

interface Stock {
  warehouseId: string;
  quantity: number;
  warehouse: { name: string };
}
interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: number | null;
  sellPrice: number | null;
  costingMethod?: string | null;
  pricingBasis?: string | null;
  baseRate?: number | null;
  pricingUom?: string | null;
  weight?: number | null;
  weightUnit?: string | null;
  reorderLevel: number;
  productStructure?: "SIMPLE" | "VARIANT" | null;
  variantAxes?: string[] | null;
  categoryId?: string | null;
  brandId?: string | null;
  barcode?: string | null;
  isActive?: boolean;
  customAttributes?: Record<string, unknown>;
  imageUrls?: string[] | null;
  stocks: Stock[];
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
}
interface Category {
  id: string;
  name: string;
  description?: string | null;
  defaultHsnCode?: string | null;
  defaultTaxRate?: number | null;
  parentId?: string | null;
  isFeatured?: boolean;
}
interface Brand {
  id: string;
  name: string;
  logoUrl?: string | null;
}
interface AttrDef {
  id: string;
  key: string;
  label: string;
  dataType: string;
  unit?: string | null;
  options?: string[] | null;
  isRequired: boolean;
  isFilterable: boolean;
  isVariantAxis?: boolean;
  isIdentity?: boolean;
  measureRole?: string | null;
  measureUnit?: string | null;
  sizePattern?: string | null;
  categoryLinks?: {
    categoryId: string;
    optionsOverride?: string[] | null;
    category?: { id: string; name: string };
  }[];
}
interface Template {
  templateId: string;
  name: string;
  description: string;
  attributeCount: number;
  categories: string[];
}

type Tab = "catalog" | "fields" | "setup";
type MsgType = "success" | "error";

const EMPTY_FORM = {
  sku: "",
  name: "",
  unit: "pcs",
  costPrice: "",
  sellPrice: "",
  costingMethod: "MANUAL",
  pricingBasis: "PER_EACH",
  baseRate: "",
  pricingUom: "each",
  weight: "",
  weightUnit: "kg",
  reorderLevel: "10",
  initialStock: "0",
  barcode: "",
  categoryId: "",
  brandId: "",
  productStructure: "SIMPLE" as "SIMPLE" | "VARIANT",
  variantAxes: [] as string[],
};

const EMPTY_CATEGORY_FORM = {
  name: "",
  description: "",
  defaultHsnCode: "",
  defaultTaxRate: "",
  parentId: "",
  isFeatured: false,
};

const EMPTY_BRAND_FORM = { name: "", logoUrl: "" };

const EMPTY_INLINE_FIELD_FORM = {
  label: "",
  dataType: "TEXT",
  unit: "",
  options: "",
  isRequired: false,
};

function slugifyKey(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const key = /^[a-z]/.test(base) ? base : `f_${base}`;
  return (key || "field").slice(0, 64);
}

function parseOptionsList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function ProductsPage() {
  const role = getAdminUser()?.role ?? "";
  const isCatalogAdmin = [
    "ADMIN",
    "MANAGER",
    "ORG_ADMIN",
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "CATALOG_MANAGER",
  ].includes(role);
  const [tab, setTab] = useState<Tab>("catalog");
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "fields" || t === "setup" || t === "catalog") setTab(t);
    } catch {
      /* ignore */
    }
  }, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [defs, setDefs] = useState<AttrDef[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<MsgType>("success");

  function notify(text: string, type: MsgType = "success") {
    setMsg(text);
    setMsgType(type);
  }

  const [stockModal, setStockModal] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState("100");
  const [stockCost, setStockCost] = useState("");

  /** null = closed, "new" = create form, "edit" = editing an existing product */
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);
  const [showCreateEditor, setShowCreateEditor] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(EMPTY_FORM);
  /** When true, user typed SKU manually — stop overwriting on category/brand change */
  const [skuManual, setSkuManual] = useState(false);
  const [skuSuggesting, setSkuSuggesting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>("");
  const [customAttrs, setCustomAttrs] = useState<Record<string, string>>({});
  const [formDefs, setFormDefs] = useState<AttrDef[]>([]);
  const [addAnother, setAddAnother] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [quotePreview, setQuotePreview] = useState<QuoteSuccess | null>(null);
  const [quotePreviewError, setQuotePreviewError] = useState("");
  const [quotePreviewLoading, setQuotePreviewLoading] = useState(false);

  // Inline "quick add" sections inside the New Product modal — no navigation away.
  const [inlineCategoryOpen, setInlineCategoryOpen] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState("");
  const [inlineCategorySaving, setInlineCategorySaving] = useState(false);
  const [inlineCategoryError, setInlineCategoryError] = useState("");

  const [inlineBrandOpen, setInlineBrandOpen] = useState(false);
  const [inlineBrandName, setInlineBrandName] = useState("");
  const [inlineBrandSaving, setInlineBrandSaving] = useState(false);
  const [inlineBrandError, setInlineBrandError] = useState("");

  const [inlineFieldOpen, setInlineFieldOpen] = useState(false);
  const [inlineFieldForm, setInlineFieldForm] = useState(EMPTY_INLINE_FIELD_FORM);
  const [inlineFieldSaving, setInlineFieldSaving] = useState(false);
  const [inlineFieldError, setInlineFieldError] = useState("");

  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeLooking, setBarcodeLooking] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [showAddField, setShowAddField] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    label: "",
    dataType: "TEXT",
    unit: "",
    options: "",
    isRequired: false,
    categoryIds: [] as string[],
  });
  const [fieldFormError, setFieldFormError] = useState("");

  const [categoryModal, setCategoryModal] = useState<"create" | Category | null>(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [brandModal, setBrandModal] = useState<"create" | Brand | null>(null);
  const [brandForm, setBrandForm] = useState(EMPTY_BRAND_FORM);
  const [setupSaving, setSetupSaving] = useState(false);

  const [editOptionsField, setEditOptionsField] = useState<AttrDef | null>(null);
  /** categoryId → comma-separated options text */
  const [optionsByCategory, setOptionsByCategory] = useState<Record<string, string>>({});
  const [defaultOptionsText, setDefaultOptionsText] = useState("");
  const [optionsSaving, setOptionsSaving] = useState(false);

  const csvRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isTypable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (isTypable) return;
      if (e.key === "Enter" || e.key.length !== 1) return;
      barcodeRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isCatalogAdmin && tab !== "catalog") setTab("catalog");
  }, [isCatalogAdmin, tab]);

  async function ensureDefaultWarehouse(): Promise<string> {
    if (defaultWarehouseId) return defaultWarehouseId;
    const list = await api("/api/warehouses?limit=20");
    const existing = (list.data ?? []) as { id: string; name: string }[];
    if (existing[0]?.id) {
      setDefaultWarehouseId(existing[0].id);
      return existing[0].id;
    }
    const created = await api("/api/warehouses", {
      method: "POST",
      body: JSON.stringify({ name: "Main Warehouse", location: "Primary" }),
    });
    const id = created.data?.id as string;
    if (!id) throw new Error("Could not create default warehouse");
    setDefaultWarehouseId(id);
    return id;
  }

  async function loadCatalog() {
    setLoading(true);
    try {
      const [p, c, b] = await Promise.all([
        api("/api/products?limit=100"),
        api("/api/categories?limit=100"),
        api("/api/brands?limit=100").catch(() => ({ data: [] })),
      ]);
      setProducts(p.data ?? []);
      setCategories(c.data ?? []);
      setBrands(b.data ?? []);
      try {
        await ensureDefaultWarehouse();
      } catch {
        /* warehouse created on first stock receive */
      }
    } catch (e: unknown) {
      notify(`Error: ${errText(e)}`, "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadFields() {
    try {
      const [d, t, c] = await Promise.all([
        api("/api/attribute-definitions"),
        api("/api/attribute-templates"),
        api("/api/categories?limit=100"),
      ]);
      setDefs(d.data ?? []);
      setTemplates(t.data ?? []);
      setCategories(c.data ?? []);
    } catch (e: unknown) {
      notify(`Error: ${errText(e)}`, "error");
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (tab === "fields") loadFields();
    if (tab === "setup") loadCatalog();
  }, [tab]);

  /** Loads attribute defs for a category. When editing, `existingValues` (the product's
   * current customAttributes) are converted back into form-friendly strings. */
  async function loadDefsForCategory(categoryId: string, existingValues?: Record<string, unknown>) {
    if (!categoryId) {
      setFormDefs([]);
      setCustomAttrs({});
      return;
    }
    try {
      const r = await api(`/api/attribute-definitions?categoryId=${encodeURIComponent(categoryId)}`);
      const list: AttrDef[] = r.data ?? [];
      setFormDefs(list);
      const init: Record<string, string> = {};
      for (const d of list) {
        const existing = existingValues?.[d.key];
        if (existing === undefined || existing === null) {
          init[d.key] = "";
        } else if (Array.isArray(existing)) {
          init[d.key] = existing.join(", ");
        } else if (typeof existing === "boolean") {
          init[d.key] = String(existing);
        } else {
          init[d.key] = String(existing);
        }
      }
      setCustomAttrs(init);
    } catch {
      setFormDefs([]);
    }
  }

  async function addStock() {
    if (!stockModal) return;
    try {
      const warehouseId = await ensureDefaultWarehouse();
      await api("/api/stock/receive", {
        method: "POST",
        body: JSON.stringify({
          items: [{ productId: stockModal.id, warehouseId, quantity: Number(stockQty) }],
          reference: "MANUAL",
        }),
      });
      notify(`Added ${stockQty} ${stockModal.unit} of ${stockModal.name}`, "success");
      setStockModal(null);
      loadCatalog();
    } catch (e: unknown) {
      notify(`Error: ${errText(e)}`, "error");
    }
  }

  function buildCustomAttributesPayload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const d of formDefs) {
      const raw = customAttrs[d.key];
      if (raw === undefined || raw === "") continue;
      if (d.dataType === "NUMBER" || d.dataType === "UNIT_NUMBER") {
        out[d.key] = Number(raw);
      } else if (d.dataType === "BOOLEAN") {
        out[d.key] = raw === "true";
      } else if (d.dataType === "MULTI_SELECT") {
        out[d.key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        out[d.key] = raw;
      }
    }
    return out;
  }

  function resetInlineSections() {
    setInlineCategoryOpen(false);
    setInlineBrandOpen(false);
    setInlineFieldOpen(false);
    setInlineCategoryError("");
    setInlineBrandError("");
    setInlineFieldError("");
  }

  function openNewProductForm() {
    setShowCreateEditor(true);
    setFormMode(null);
    setEditingProduct(null);
    setMsg("");
  }

  async function openEditProductForm(p: Product) {
    setFormMode("edit");
    setEditingProduct(p);
    setSkuManual(true);
    setImageUrls(Array.isArray(p.imageUrls) ? p.imageUrls.filter(Boolean) : []);
    setProductForm({
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      costPrice: p.costPrice != null ? String(p.costPrice) : "",
      sellPrice:
        p.sellPrice != null && !isMeasuredPricingBasis(p.pricingBasis || "PER_EACH")
          ? String(p.sellPrice)
          : p.sellPrice != null
            ? String(p.sellPrice)
            : "",
      costingMethod: "MANUAL",
      pricingBasis: p.pricingBasis || "PER_EACH",
      baseRate: p.baseRate != null ? String(p.baseRate) : "",
      pricingUom: p.pricingUom || (p.pricingBasis === "PER_AREA" ? "sq_ft" : "each"),
      weight: p.weight != null ? String(p.weight) : "",
      weightUnit: p.weightUnit || "kg",
      reorderLevel: String(p.reorderLevel),
      initialStock: "0",
      barcode: p.barcode ?? "",
      categoryId: p.categoryId ?? p.category?.id ?? "",
      brandId: p.brandId ?? p.brand?.id ?? "",
      productStructure: p.productStructure === "VARIANT" ? "VARIANT" : "SIMPLE",
      variantAxes: Array.isArray(p.variantAxes) ? p.variantAxes.map(String) : [],
    });
    setAddAnother(false);
    setQuotePreview(null);
    setQuotePreviewError("");
    resetInlineSections();
    setMsg("");
    const categoryId = p.categoryId ?? p.category?.id ?? "";
    if (categoryId) {
      loadDefsForCategory(categoryId, p.customAttributes);
    } else {
      setFormDefs([]);
      setCustomAttrs({});
    }
    try {
      const r = await api(`/api/products/${p.id}`);
      if (r.data) {
        setEditingProduct({
          ...p,
          ...r.data,
          stocks: r.data.stocks ?? p.stocks,
        });
      }
    } catch {
      /* keep list payload */
    }
  }

  function validatePricingConfig(): string | null {
    const basis = productForm.pricingBasis || "PER_EACH";
    if (basis === "PER_EACH") return null;

    const attrs = buildCustomAttributesPayload();
    const hasFilled = (d: AttrDef) => {
      const v = attrs[d.key] ?? customAttrs[d.key];
      return v !== undefined && v !== null && String(v).trim() !== "";
    };

    if (basis === "PER_AREA") {
      const areaReady = formDefs.some(
        (d) =>
          (d.sizePattern || d.measureRole === "AREA") && hasFilled(d)
      );
      const lengthWidth =
        formDefs.some((d) => d.measureRole === "LENGTH" && hasFilled(d)) &&
        formDefs.some((d) => d.measureRole === "WIDTH" && hasFilled(d));
      if (!areaReady && !lengthWidth) {
        return "PER_AREA requires an area derivation (size pattern like 8×4, or length/width measures) with values set.";
      }
      if (!productForm.baseRate || Number(productForm.baseRate) < 0) {
        return "PER_AREA requires a rate per pricing UOM.";
      }
      if (!productForm.pricingUom || productForm.pricingUom === "each") {
        return "PER_AREA requires a pricing UOM (e.g. sq_ft).";
      }
    }

    if (basis === "PER_WEIGHT") {
      const weightAttr = formDefs.some((d) => d.measureRole === "WEIGHT" && hasFilled(d));
      const productWeight = Number(productForm.weight) > 0;
      if (!weightAttr && !productWeight) {
        return "PER_WEIGHT requires a weight measure attribute or product weight.";
      }
      if (!productForm.baseRate || Number(productForm.baseRate) < 0) {
        return "PER_WEIGHT requires a rate per pricing UOM.";
      }
    }

    if (basis === "PER_VOLUME") {
      const volumeReady = formDefs.some(
        (d) => d.measureRole === "VOLUME" && hasFilled(d)
      );
      const lwh =
        formDefs.some((d) => d.measureRole === "LENGTH" && hasFilled(d)) &&
        formDefs.some((d) => d.measureRole === "WIDTH" && hasFilled(d)) &&
        formDefs.some((d) => d.measureRole === "HEIGHT" && hasFilled(d));
      if (!volumeReady && !lwh) {
        return "PER_VOLUME requires a volume measure or length/width/height values.";
      }
      if (!productForm.baseRate || Number(productForm.baseRate) < 0) {
        return "PER_VOLUME requires a rate per pricing UOM.";
      }
      if (!productForm.pricingUom) {
        return "PER_VOLUME requires a pricing UOM.";
      }
    }

    return null;
  }

  function pricingPayloadFields(): {
    pricingBasis: string;
    pricingUom: string | null;
    baseRate: number | null;
    weight?: number;
    weightUnit?: string;
  } {
    const basis = productForm.pricingBasis || "PER_EACH";
    // Normalize on save: PER_EACH must not persist measured UOM/rate
    if (basis === "PER_EACH") {
      return {
        pricingBasis: basis,
        pricingUom: "each",
        baseRate: null,
        ...(productForm.weight !== ""
          ? { weight: Number(productForm.weight), weightUnit: productForm.weightUnit || "kg" }
          : {}),
      };
    }
    return {
      pricingBasis: basis,
      pricingUom: productForm.pricingUom || null,
      baseRate:
        productForm.baseRate !== "" && productForm.baseRate != null
          ? Number(productForm.baseRate)
          : null,
      ...(productForm.weight !== ""
        ? { weight: Number(productForm.weight), weightUnit: productForm.weightUnit || "kg" }
        : {}),
    };
  }

  async function suggestSku(categoryId: string, brandId: string) {
    if (formMode !== "new") return;
    setSkuSuggesting(true);
    try {
      const q = new URLSearchParams();
      if (categoryId) q.set("categoryId", categoryId);
      if (brandId) q.set("brandId", brandId);
      const r = await api(`/api/products/suggest-sku?${q}`);
      const sku = r?.data?.sku as string | undefined;
      if (sku) setProductForm((f) => ({ ...f, sku }));
    } catch {
      /* keep current sku */
    } finally {
      setSkuSuggesting(false);
    }
  }

  // Auto SKU when category/brand changes (create mode only, unless user edited SKU)
  useEffect(() => {
    if (formMode !== "new" || skuManual) return;
    if (!productForm.categoryId && !productForm.brandId) {
      setProductForm((f) => (f.sku ? { ...f, sku: "" } : f));
      return;
    }
    void suggestSku(productForm.categoryId, productForm.brandId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productForm.categoryId, productForm.brandId, formMode, skuManual]);

  // Live pricing preview via quote API only (no client-side math)
  useEffect(() => {
    if (!formMode) {
      setQuotePreview(null);
      setQuotePreviewError("");
      return;
    }
    const basis = productForm.pricingBasis || "PER_EACH";
    const timer = setTimeout(() => {
      void (async () => {
        setQuotePreviewLoading(true);
        setQuotePreviewError("");
        const attributes = buildCustomAttributesPayload();
        // Preview uses active basis only — ignore preserved hidden fields for PER_EACH
        const draftProduct =
          basis === "PER_EACH"
            ? {
                pricingBasis: "PER_EACH" as const,
                baseRate: null,
                sellPrice:
                  productForm.sellPrice !== "" ? Number(productForm.sellPrice) : null,
                pricingUom: "each",
                weight: productForm.weight !== "" ? Number(productForm.weight) : null,
                weightUnit: productForm.weightUnit || null,
                categoryId: productForm.categoryId || null,
                attributes,
                attributeDefs: formDefs.map((d) => ({
                  key: d.key,
                  measureRole: d.measureRole ?? null,
                  measureUnit: d.measureUnit ?? d.unit ?? null,
                  sizePattern: d.sizePattern ?? null,
                })),
              }
            : {
                pricingBasis: basis,
                baseRate:
                  productForm.baseRate !== "" ? Number(productForm.baseRate) : null,
                sellPrice: null,
                pricingUom: productForm.pricingUom || null,
                weight: productForm.weight !== "" ? Number(productForm.weight) : null,
                weightUnit: productForm.weightUnit || null,
                categoryId: productForm.categoryId || null,
                attributes,
                attributeDefs: formDefs.map((d) => ({
                  key: d.key,
                  measureRole: d.measureRole ?? null,
                  measureUnit: d.measureUnit ?? d.unit ?? null,
                  sizePattern: d.sizePattern ?? null,
                })),
              };
        const result = await fetchPricingQuote({
          productId: null,
          draftProduct,
          quantity: 1,
          attributes,
        });
        if (result.ok) {
          setQuotePreview(result);
          setQuotePreviewError("");
        } else {
          setQuotePreview(null);
          setQuotePreviewError(result.error);
        }
        setQuotePreviewLoading(false);
      })();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formMode,
    editingProduct?.id,
    productForm.pricingBasis,
    productForm.baseRate,
    productForm.pricingUom,
    productForm.sellPrice,
    productForm.weight,
    productForm.weightUnit,
    productForm.categoryId,
    customAttrs,
  ]);

  function resolveSellPriceForSave(): number | null {
    const basis = productForm.pricingBasis || "PER_EACH";
    if (isMeasuredPricingBasis(basis)) return null;
    if (productForm.sellPrice === "" || productForm.sellPrice == null) {
      return Number.NaN;
    }
    return Number(productForm.sellPrice);
  }

  /** null = unknown cost; 0 is an explicit zero cost */
  function resolveCostPriceForSave(): number | null {
    if (productForm.costPrice === "" || productForm.costPrice == null) return null;
    const n = Number(productForm.costPrice);
    if (!Number.isFinite(n) || n < 0) return NaN as unknown as number;
    return n;
  }

  function costIsMissing(cost: number | null | undefined): boolean {
    return cost == null || (typeof cost === "number" && !Number.isFinite(cost));
  }

  async function submitProductForm(e: React.FormEvent) {
    e.preventDefault();
    const pricingError = validatePricingConfig();
    if (pricingError) {
      notify(pricingError, "error");
      return;
    }
    const sellPrice = resolveSellPriceForSave();
    if (sellPrice !== null && (!Number.isFinite(sellPrice) || sellPrice < 0)) {
      notify("Sell price is required for PER_EACH products.", "error");
      return;
    }
    const costPrice = resolveCostPriceForSave();
    if (typeof costPrice === "number" && Number.isNaN(costPrice)) {
      notify("Cost price must be blank (unknown) or a non-negative number.", "error");
      return;
    }
    setCreatingProduct(true);
    try {
      const customAttributes = buildCustomAttributesPayload();
      const pricingFields = pricingPayloadFields();

      if (formMode === "edit" && editingProduct) {
        await api(`/api/products/${editingProduct.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: productForm.name,
            unit: productForm.unit,
            costPrice,
            sellPrice,
            costingMethod: "MANUAL",
            reorderLevel: Number(productForm.reorderLevel),
            barcode: productForm.barcode || null,
            categoryId: productForm.categoryId || null,
            brandId: productForm.brandId || null,
            imageUrls: imageUrls.length ? imageUrls : null,
            customAttributes,
            productStructure: productForm.productStructure,
            variantAxes: productForm.variantAxes,
            ...pricingFields,
          }),
        });
        notify(
          costIsMissing(costPrice)
            ? `Product "${productForm.name}" updated. Cost not set — valuation and margin unavailable until cost is entered.`
            : `Product "${productForm.name}" updated`,
          "success"
        );
        setFormMode(null);
        setEditingProduct(null);
        setImageUrls([]);
        loadCatalog();
        return;
      }

      const created = await api("/api/products", {
        method: "POST",
        body: JSON.stringify({
          sku: productForm.sku,
          name: productForm.name,
          unit: productForm.unit,
          costPrice,
          sellPrice,
          costingMethod: "MANUAL",
          reorderLevel: Number(productForm.reorderLevel),
          ...(productForm.barcode && { barcode: productForm.barcode }),
          ...(productForm.categoryId && { categoryId: productForm.categoryId }),
          ...(productForm.brandId && { brandId: productForm.brandId }),
          ...(imageUrls.length ? { imageUrls } : {}),
          ...(Object.keys(customAttributes).length ? { customAttributes } : {}),
          pricingBasis: pricingFields.pricingBasis,
          pricingUom: pricingFields.pricingUom ?? undefined,
          ...(pricingFields.baseRate != null ? { baseRate: pricingFields.baseRate } : {}),
          ...(pricingFields.weight != null
            ? { weight: pricingFields.weight, weightUnit: pricingFields.weightUnit }
            : {}),
          productStructure: productForm.productStructure,
          variantAxes: productForm.variantAxes,
        }),
      });
      const productId = created.data?.id;
      if (productId && Number(productForm.initialStock) > 0) {
        const warehouseId = await ensureDefaultWarehouse();
        await api("/api/stock/receive", {
          method: "POST",
          body: JSON.stringify({
            items: [{ productId, warehouseId, quantity: Number(productForm.initialStock) }],
            reference: "INITIAL",
          }),
        });
      }
      notify(
        costIsMissing(costPrice)
          ? `Product "${productForm.name}" created. Cost not set — update before inventory valuation or when purchase cost is known.`
          : `Product "${productForm.name}" created`,
        "success"
      );
      if (addAnother) {
        setSkuManual(false);
        setImageUrls([]);
        setProductForm((f) => ({ ...f, sku: "", name: "", barcode: "", initialStock: "0" }));
        setCustomAttrs((a) => Object.fromEntries(Object.keys(a).map((k) => [k, ""])));
      } else {
        setFormMode(null);
        setProductForm(EMPTY_FORM);
        setImageUrls([]);
        setCustomAttrs({});
        setFormDefs([]);
      }
      loadCatalog();
    } catch (e: unknown) {
      notify(`Error: ${errText(e)}`, "error");
    } finally {
      setCreatingProduct(false);
    }
  }

  async function deactivateProduct(p: Product) {
    if (!confirm(`Delete product "${p.name}"? It will be hidden from the catalog (soft delete).`)) return;
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      notify(`Product "${p.name}" deleted`, "success");
      setFormMode(null);
      setEditingProduct(null);
      loadCatalog();
    } catch (e: unknown) {
      notify(`Error: ${errText(e)}`, "error");
    }
  }

  async function lookupBarcode(code?: string) {
    const target = (code ?? barcodeInput).trim();
    if (!target) return;
    setBarcodeLooking(true);
    try {
      const r = await api(`/api/products/barcode?code=${encodeURIComponent(target)}`);
      if (r.data?.variableWeight) {
        if (r.data.exists) {
          notify(`${r.data.name} — ${r.data.weightKg} kg × ₹${r.data.sellPrice}/kg = ₹${r.data.lineTotal}`, "success");
        } else {
          notify(`Scale barcode — PLU ${r.data.pluCode}. Create product with that PLU first.`, "error");
          openNewProductForm();
        }
        return;
      }
      if (r.data?.exists) {
        notify(`Barcode already in catalog: ${r.data.name}`, "error");
        return;
      }
      if (r.data?.name) {
        openNewProductForm();
        setProductForm((f) => ({ ...f, name: r.data.name, unit: r.data.unit ?? "pcs", barcode: target }));
        notify(`Found: ${r.data.name}`, "success");
      } else {
        openNewProductForm();
        setProductForm((f) => ({ ...f, barcode: target }));
        notify("Barcode not found — fill form manually", "error");
      }
    } catch (e: unknown) {
      notify(`Error: ${errText(e)}`, "error");
    } finally {
      setBarcodeLooking(false);
    }
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
      const col = (name: string) => header.indexOf(name);
      const rows = lines
        .slice(1)
        .map((line) => {
          const cells = line.split(",").map((c) => c.trim());
          return {
            sku: cells[col("sku")] ?? "",
            name: cells[col("name")] ?? "",
            unit: cells[col("unit")] || "pcs",
            costPrice: parseFloat(cells[col("costprice")] ?? cells[col("cost")] ?? "0"),
            sellPrice: parseFloat(cells[col("sellprice")] ?? cells[col("sell")] ?? "0"),
            reorderLevel: parseInt(cells[col("reorderlevel")] ?? "10") || 10,
            initialStock: parseInt(cells[col("initialstock")] ?? cells[col("stock")] ?? "0") || 0,
          };
        })
        .filter((r) => r.sku && r.name);
      if (rows.length === 0) {
        notify("No valid rows found in CSV", "error");
        return;
      }
      setImporting(true);
      try {
        const r = await api("/api/products/import", { method: "POST", body: JSON.stringify({ products: rows }) });
        setImportResult(r.data);
        notify(`Import done: ${r.data.created} created, ${r.data.skipped} skipped`, "success");
        loadCatalog();
      } catch (err: unknown) {
        notify(`Import error: ${errText(err)}`, "error");
      } finally {
        setImporting(false);
        if (csvRef.current) csvRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function applyTemplate(templateId: string) {
    try {
      const r = await api("/api/attribute-templates", {
        method: "POST",
        body: JSON.stringify({ templateId, createCategories: true }),
      });
      notify(r.data?.message ?? "Template applied", "success");
      await loadFields();
      await loadCatalog();
    } catch (e: unknown) {
      notify(`Error: ${errText(e)}`, "error");
    }
  }

  /** Shared create-with-retry: auto-generates a snake_case key from the label and
   * retries with a numeric suffix if that key is already taken. */
  async function createAttributeWithRetry(base: {
    label: string;
    dataType: string;
    unit?: string;
    options?: string[];
    isRequired: boolean;
    categoryIds?: string[];
  }): Promise<AttrDef> {
    const key = slugifyKey(base.label);

    // Same attribute key can be reused across categories with different option lists
    // (e.g. "size" = 8x4/7x3/6x3 for Plywood, but different sheet sizes for Blockboard).
    // If a definition with this exact key already exists, link the requested category
    // to it (with its own options) instead of creating a disconnected duplicate.
    try {
      const existingRes = await api("/api/attribute-definitions?includeInactive=true");
      const existing = (existingRes.data as AttrDef[] | undefined)?.find((d) => d.key === key);
      if (existing) {
        const categoryId = base.categoryIds?.[0];
        if (categoryId) {
          const patched = await api(`/api/attribute-definitions/${existing.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              isActive: true,
              categoryOptions: [{ categoryId, options: base.options ?? null }],
            }),
          });
          // Reflect this category's option override immediately (server resolves this
          // the same way via resolveAttributeDefinitions on next GET ?categoryId=).
          return { ...(patched.data as AttrDef), options: base.options ?? (patched.data as AttrDef).options };
        }
        return existing;
      }
    } catch {
      // If the lookup itself fails, fall through and attempt a normal create below.
    }

    let attemptKey = key;
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const res = await api("/api/attribute-definitions", {
          method: "POST",
          body: JSON.stringify({
            key: attemptKey,
            label: base.label,
            dataType: base.dataType,
            unit: base.unit || undefined,
            options: base.options,
            isRequired: base.isRequired,
            categoryIds: base.categoryIds,
          }),
        });
        return res.data as AttrDef;
      } catch (err) {
        const message = errText(err).toLowerCase();
        if (message.includes("already exists") && attempt < 5) {
          attempt += 1;
          attemptKey = `${key}_${attempt + 1}`;
          continue;
        }
        throw err;
      }
    }
  }

  async function createField(e: React.FormEvent) {
    e.preventDefault();
    setFieldFormError("");
    const label = fieldForm.label.trim();
    if (!label) {
      setFieldFormError("Label is required");
      return;
    }
    const needsOptions = fieldForm.dataType === "SELECT" || fieldForm.dataType === "MULTI_SELECT";
    const options = needsOptions ? parseOptionsList(fieldForm.options) : undefined;
    if (needsOptions && (!options || options.length === 0)) {
      setFieldFormError("Add at least one option (comma-separated) for a list field");
      return;
    }
    try {
      const created = await createAttributeWithRetry({
        label,
        dataType: fieldForm.dataType,
        unit: fieldForm.unit,
        options,
        isRequired: fieldForm.isRequired,
        categoryIds: fieldForm.categoryIds.length ? fieldForm.categoryIds : undefined,
      });
      notify(`Field "${created.label}" added — it will show on New Product when category matches`, "success");
      setShowAddField(false);
      setFieldForm({ label: "", dataType: "TEXT", unit: "", options: "", isRequired: false, categoryIds: [] });
      loadFields();
    } catch (e: unknown) {
      setFieldFormError(errText(e));
    }
  }

  function formatAttrs(p: Product): string {
    const attrs = p.customAttributes ?? {};
    const parts = Object.entries(attrs).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : String(v)}`);
    return parts.join(" · ");
  }

  function openCreateCategory() {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryModal("create");
  }

  function openEditCategory(c: Category) {
    setCategoryForm({
      name: c.name,
      description: c.description ?? "",
      defaultHsnCode: c.defaultHsnCode ?? "",
      defaultTaxRate: c.defaultTaxRate != null ? String(c.defaultTaxRate) : "",
      parentId: c.parentId ?? "",
      isFeatured: !!c.isFeatured,
    });
    setCategoryModal(c);
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    setSetupSaving(true);
    try {
      const body = {
        name: categoryForm.name.trim(),
        ...(categoryForm.description.trim() && { description: categoryForm.description.trim() }),
        ...(categoryForm.defaultHsnCode.trim() && { defaultHsnCode: categoryForm.defaultHsnCode.trim() }),
        ...(categoryForm.defaultTaxRate !== "" && { defaultTaxRate: Number(categoryForm.defaultTaxRate) }),
        ...(categoryForm.parentId && { parentId: categoryForm.parentId }),
        isFeatured: categoryForm.isFeatured,
      };
      let saved: Category | undefined;
      if (categoryModal && categoryModal !== "create") {
        const res = await api(`/api/categories/${categoryModal.id}`, { method: "PATCH", body: JSON.stringify(body) });
        saved = res.data;
        notify(`Category "${body.name}" updated`, "success");
      } else {
        const res = await api("/api/categories", { method: "POST", body: JSON.stringify(body) });
        saved = res.data;
        notify(`Category "${body.name}" created`, "success");
      }
      setCategoryModal(null);
      await loadCatalog();
      // If this was opened from within New Product, select it there instead of making the user go back.
      if (formMode && saved?.id) {
        setProductForm((f) => ({ ...f, categoryId: saved!.id }));
        loadDefsForCategory(saved.id);
      }
    } catch (err: unknown) {
      notify(`Error: ${errText(err)}`, "error");
    } finally {
      setSetupSaving(false);
    }
  }

  async function deactivateCategory(c: Category) {
    if (!confirm(`Delete category "${c.name}"? It will be hidden from setup (soft delete). Child categories are also hidden.`)) return;
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      notify(`Category "${c.name}" deleted`, "success");
      await loadCatalog();
    } catch (err: unknown) {
      notify(`Error: ${errText(err)}`, "error");
    }
  }

  function openCreateBrand() {
    setBrandForm(EMPTY_BRAND_FORM);
    setBrandModal("create");
  }

  function openEditBrand(b: Brand) {
    setBrandForm({ name: b.name, logoUrl: b.logoUrl ?? "" });
    setBrandModal(b);
  }

  async function saveBrand(e: React.FormEvent) {
    e.preventDefault();
    setSetupSaving(true);
    try {
      const name = brandForm.name.trim();
      let saved: Brand | undefined;
      if (brandModal && brandModal !== "create") {
        const res = await api(`/api/brands/${brandModal.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, logoUrl: brandForm.logoUrl.trim() || null }),
        });
        saved = res.data;
        notify(`Brand "${name}" updated`, "success");
      } else {
        const res = await api("/api/brands", {
          method: "POST",
          body: JSON.stringify({
            name,
            ...(brandForm.logoUrl.trim() && { logoUrl: brandForm.logoUrl.trim() }),
          }),
        });
        saved = res.data;
        notify(`Brand "${name}" created`, "success");
      }
      setBrandModal(null);
      await loadCatalog();
      if (formMode && saved?.id) {
        setProductForm((f) => ({ ...f, brandId: saved!.id }));
      }
    } catch (err: unknown) {
      notify(`Error: ${errText(err)}`, "error");
    } finally {
      setSetupSaving(false);
    }
  }

  async function deactivateBrand(b: Brand) {
    if (!confirm(`Delete brand "${b.name}"? It will be hidden from setup (soft delete).`)) return;
    try {
      await api(`/api/brands/${b.id}`, { method: "DELETE" });
      notify(`Brand "${b.name}" deleted`, "success");
      await loadCatalog();
    } catch (err: unknown) {
      notify(`Error: ${errText(err)}`, "error");
    }
  }

  async function deactivateAttribute(d: AttrDef) {
    if (
      !confirm(
        `Delete field "${d.label}"? It will be hidden from Custom Fields and Configuration (soft delete).`
      )
    ) {
      return;
    }
    try {
      await api(`/api/attribute-definitions/${d.id}`, { method: "DELETE" });
      notify(`Field "${d.label}" deleted`, "success");
      await loadFields();
    } catch (err: unknown) {
      notify(`Error: ${errText(err)}`, "error");
    }
  }

  // ---- Inline quick-add (used inside the New Product modal) ----

  async function submitInlineCategory(e?: React.FormEvent) {
    e?.preventDefault();
    const name = inlineCategoryName.trim();
    if (!name) {
      setInlineCategoryError("Category name is required");
      return;
    }
    setInlineCategorySaving(true);
    setInlineCategoryError("");
    try {
      const res = await api("/api/categories", { method: "POST", body: JSON.stringify({ name }) });
      const created: Category = res.data;
      setCategories((prev) => [...prev, created]);
      setProductForm((f) => ({ ...f, categoryId: created.id }));
      loadDefsForCategory(created.id);
      setInlineCategoryOpen(false);
      setInlineCategoryName("");
      notify(`Category "${created.name}" added`, "success");
    } catch (err) {
      const msg = errText(err);
      setInlineCategoryError(msg);
      notify(`Could not add category: ${msg}`, "error");
    } finally {
      setInlineCategorySaving(false);
    }
  }

  async function submitInlineBrand(e?: React.FormEvent) {
    e?.preventDefault();
    const name = inlineBrandName.trim();
    if (!name) {
      setInlineBrandError("Brand name is required");
      return;
    }
    setInlineBrandSaving(true);
    setInlineBrandError("");
    try {
      const res = await api("/api/brands", { method: "POST", body: JSON.stringify({ name }) });
      const created: Brand = res.data;
      setBrands((prev) => [...prev, created]);
      setProductForm((f) => ({ ...f, brandId: created.id }));
      setInlineBrandOpen(false);
      setInlineBrandName("");
      notify(`Brand "${created.name}" added`, "success");
    } catch (err) {
      const msg = errText(err);
      setInlineBrandError(msg);
      notify(`Could not add brand: ${msg}`, "error");
    } finally {
      setInlineBrandSaving(false);
    }
  }

  async function submitInlineField(e?: React.FormEvent) {
    e?.preventDefault();
    if (!productForm.categoryId) {
      setInlineFieldError("Select a category first");
      notify("Select a category before adding an attribute", "error");
      return;
    }
    const label = inlineFieldForm.label.trim();
    if (!label) {
      setInlineFieldError("Field name is required");
      return;
    }
    const needsOptions = inlineFieldForm.dataType === "SELECT" || inlineFieldForm.dataType === "MULTI_SELECT";
    const options = needsOptions ? parseOptionsList(inlineFieldForm.options) : undefined;
    if (needsOptions && (!options || options.length === 0)) {
      setInlineFieldError("Add at least one value (comma-separated) for a list field");
      return;
    }
    setInlineFieldSaving(true);
    setInlineFieldError("");
    try {
      const created = await createAttributeWithRetry({
        label,
        dataType: inlineFieldForm.dataType,
        unit: inlineFieldForm.unit,
        options,
        isRequired: inlineFieldForm.isRequired,
        categoryIds: [productForm.categoryId],
      });
      setFormDefs((prev) => [...prev.filter((d) => d.key !== created.key), created]);
      setCustomAttrs((a) => ({ ...a, [created.key]: a[created.key] ?? "" }));
      setInlineFieldForm(EMPTY_INLINE_FIELD_FORM);
      setInlineFieldOpen(false);
      notify(`Attribute "${created.label}" added to this category`, "success");
    } catch (err) {
      const msg = errText(err);
      setInlineFieldError(msg);
      notify(`Could not add attribute: ${msg}`, "error");
    } finally {
      setInlineFieldSaving(false);
    }
  }

  function openEditOptions(d: AttrDef) {
    const byCat: Record<string, string> = {};
    for (const link of d.categoryLinks ?? []) {
      const opts = Array.isArray(link.optionsOverride)
        ? link.optionsOverride
        : Array.isArray(d.options)
          ? d.options
          : [];
      byCat[link.categoryId] = opts.join(", ");
    }
    setOptionsByCategory(byCat);
    setDefaultOptionsText(Array.isArray(d.options) ? d.options.join(", ") : "");
    setEditOptionsField(d);
  }

  async function saveFieldOptions(e: React.FormEvent) {
    e.preventDefault();
    if (!editOptionsField) return;
    setOptionsSaving(true);
    try {
      const links = editOptionsField.categoryLinks ?? [];
      const categoryOptions = links.map((l) => ({
        categoryId: l.categoryId,
        options: parseOptionsList(optionsByCategory[l.categoryId] ?? ""),
      }));
      for (const row of categoryOptions) {
        if (row.options.length === 0) {
          throw new Error(`Add at least one option for each category (empty: ${row.categoryId})`);
        }
      }
      await api(`/api/attribute-definitions/${editOptionsField.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          options: parseOptionsList(defaultOptionsText),
          ...(categoryOptions.length ? { categoryOptions } : {}),
        }),
      });
      notify(`Options updated for "${editOptionsField.label}"`, "success");
      setEditOptionsField(null);
      await loadFields();
    } catch (err: unknown) {
      notify(`Error: ${errText(err)}`, "error");
    } finally {
      setOptionsSaving(false);
    }
  }

  const selectedCategoryName = categories.find((c) => c.id === productForm.categoryId)?.name;

  if (showCreateEditor) {
    return (
      <div className="h-[calc(100dvh-3.5rem)] overflow-hidden">
        <CreateProductEditor
          onClose={() => setShowCreateEditor(false)}
          onDone={() => {
            void loadCatalog();
            setTab("catalog");
            setShowCreateEditor(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
            {isCatalogAdmin ? "Products" : "Product lookup"}
          </h1>
          <p className="text-sm text-[var(--ink-soft)] mt-0.5">
            {isCatalogAdmin
              ? "Catalog, categories, brands and attributes — all configured in one place."
              : "Search SKU, size, thickness and stock while reviewing sales requests."}
          </p>
        </div>
        {tab === "catalog" && isCatalogAdmin && (
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-1">
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupBarcode()}
                placeholder="Scan barcode…"
                className="border border-[var(--line)] rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent"
              />
              <button
                onClick={() => lookupBarcode()}
                disabled={barcodeLooking}
                className="bg-[var(--brand)] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[var(--brand-mid)] disabled:opacity-50 transition-colors"
              >
                {barcodeLooking ? "…" : "Find"}
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="bg-[var(--mist)] text-[var(--brand)] px-3 py-2 rounded-lg text-sm font-medium hover:bg-[var(--mist)] transition-colors"
              >
                Camera
              </button>
            </div>
            <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
            <button
              onClick={() => csvRef.current?.click()}
              disabled={importing}
              className="bg-[var(--surface-raised)] border border-[var(--line)] text-[var(--ink-soft)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--mist)] disabled:opacity-50 transition-colors"
            >
              {importing ? "Importing…" : "Import CSV"}
            </button>
            <button
              onClick={() => setShowCreateEditor(true)}
              className="bg-[var(--brand)] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-[var(--brand-mid)] shadow-[var(--shadow-sm)] transition-colors"
            >
              + New Product
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 inline-flex gap-1 rounded-lg bg-[var(--mist)] p-1">
        {(
          (
            isCatalogAdmin
              ? ([
                  ["catalog", "Catalog"],
                  ["fields", "Custom Fields"],
                  ["setup", "Categories & Brands"],
                ] as const)
              : ([["catalog", "Catalog lookup"]] as const)
          )
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? "bg-[var(--surface-raised)] shadow text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div
          className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm whitespace-pre-line ${
            msgType === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <span>{msg}</span>
          <button type="button" onClick={() => setMsg("")} className="shrink-0 opacity-50 hover:opacity-100">
            ×
          </button>
        </div>
      )}
      {importResult && importResult.errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          Import errors: {importResult.errors.join("; ")}
        </div>
      )}

      {tab === "catalog" && (
        <>
          {loading ? (
            <p className="text-[var(--ink-soft)] text-sm">Loading…</p>
          ) : (
            <div className="bg-[var(--surface-raised)] rounded-xl border border-[var(--line)] overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[var(--mist)] border-b border-[var(--line)]">
                  <tr>
                    {["SKU", "Name", "Category", "Attributes", "Unit", "Sell", "Stock", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide text-[var(--ink-soft)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {products.map((p) => {
                    const totalStock = (p.stocks ?? []).reduce((sum, s) => sum + s.quantity, 0);
                    const isLow = totalStock <= p.reorderLevel;
                    return (
                      <tr key={p.id} className="hover:bg-[var(--mist)] transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-[var(--ink-soft)]">{p.sku}</td>
                        <td className="px-3 py-2.5 font-medium text-[var(--ink)]">{p.name}</td>
                        <td className="px-3 py-2.5 text-[var(--ink-soft)]">{p.category?.name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-[var(--ink-soft)] max-w-[220px] truncate" title={formatAttrs(p)}>
                          {formatAttrs(p) || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--ink-soft)]">{p.unit}</td>
                        <td className="px-3 py-2.5 font-semibold text-emerald-700">
                          <div className="flex flex-col gap-0.5">
                            <span>
                              {p.sellPrice != null ? `₹${p.sellPrice}` : isMeasuredPricingBasis(p.pricingBasis || "PER_EACH") ? "Quote" : "—"}
                            </span>
                            {p.pricingBasis && p.pricingBasis !== "PER_EACH" && (
                              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--brand)]">
                                {p.baseRate != null && p.pricingUom
                                  ? `₹${p.baseRate} / ${p.pricingUom}`
                                  : p.pricingBasis}
                              </span>
                            )}
                            {p.costPrice == null && (
                              <span className="text-[10px] font-medium text-amber-600">No cost</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`font-bold ${isLow ? "text-red-600" : "text-[var(--ink)]"}`}>
                            {totalStock} {p.unit}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {isCatalogAdmin ? (
                            <div className="flex items-center gap-3">
                              <ActionGroup aria-label="Row actions">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Edit product ${p.name}`}
                                  title="Edit product"
                                  onClick={() => openEditProductForm(p)}
                                >
                                  <SquarePen style={iconSm} aria-hidden />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={deleteIconBtn}
                                  aria-label={`Delete product ${p.name}`}
                                  title="Delete product"
                                  onClick={() => void deactivateProduct(p)}
                                >
                                  <Trash2 style={iconSm} aria-hidden />
                                </Button>
                              </ActionGroup>
                              <button
                                type="button"
                                onClick={() => {
                                  setStockModal(p);
                                  setStockQty("100");
                                  setStockCost(p.costPrice != null ? String(p.costPrice) : "");
                                  setMsg("");
                                }}
                                className="text-xs bg-[var(--brand)] text-white px-3 py-1.5 rounded-lg hover:bg-[var(--brand-mid)] font-medium transition-colors"
                              >
                                + Add Stock
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--ink-soft)]">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-[var(--ink-soft)]">
                        No products yet.
                        {isCatalogAdmin && (
                          <>
                            {" "}
                            <button
                              type="button"
                              onClick={openNewProductForm}
                              className="text-[var(--brand)] hover:underline font-medium"
                            >
                              Create your first product
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "fields" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>How this works:</strong> apply an industry pack, or add fields straight from{" "}
            <strong>New Product</strong> once a category is picked. Size-type lists can differ per category — use{" "}
            <strong>Edit lists</strong> / <strong>Edit values</strong> (for NUMBER fields like Thickness) below.
          </div>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Industry packs</h2>
              <button
                type="button"
                onClick={() => {
                  setFieldFormError("");
                  setShowAddField(true);
                }}
                className="text-sm px-3 py-1.5 border border-[var(--line)] rounded-lg hover:bg-[var(--mist)] font-medium transition-colors"
              >
                + Add field
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div key={t.templateId} className="border border-[var(--line)] rounded-lg p-4 bg-[var(--surface-raised)] shadow-sm">
                  <div className="font-medium text-[var(--ink)]">{t.name}</div>
                  <p className="text-xs text-[var(--ink-soft)] mt-1">{t.description}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-2">
                    {t.attributeCount} fields
                    {t.categories.length ? ` · ${t.categories.join(", ")}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => applyTemplate(t.templateId)}
                    className="mt-3 text-sm px-3 py-1.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--brand-mid)] font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-3">
              Fields for this tenant ({defs.length})
            </h2>
            <div className="bg-[var(--surface-raised)] rounded-xl border border-[var(--line)] overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[var(--mist)] border-b border-[var(--line)] text-left">
                  <tr>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Field</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Type</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Identity</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Shows on category</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Lists (per category)</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Required</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {defs.map((d) => (
                    <tr key={d.id} className="min-h-[44px]">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-[var(--ink)]">{d.label}</div>
                        <div className="font-mono text-xs text-[var(--ink-soft)]">{d.key}</div>
                      </td>
                      <td className="px-4 py-2 text-[var(--ink-soft)]">
                        {d.dataType}
                        {d.unit ? ` (${d.unit})` : ""}
                      </td>
                      <td className="px-4 py-2 text-[var(--ink-soft)]">{d.isIdentity ? "Yes" : "—"}</td>
                      <td className="px-4 py-2 text-[var(--ink-soft)]">
                        {!d.categoryLinks?.length
                          ? "All products"
                          : d.categoryLinks.map((l) => l.category?.name ?? l.categoryId).join(", ")}
                      </td>
                      <td className="px-4 py-2 text-xs text-[var(--ink-soft)] max-w-[280px]">
                        {d.dataType === "SELECT" || d.dataType === "MULTI_SELECT" || d.dataType === "NUMBER" ? (
                          d.categoryLinks?.length ? (
                            <ul className="space-y-1">
                              {d.categoryLinks.map((l) => {
                                const opts = Array.isArray(l.optionsOverride)
                                  ? l.optionsOverride
                                  : Array.isArray(d.options)
                                    ? d.options
                                    : [];
                                return (
                                  <li key={l.categoryId}>
                                    <span className="font-medium text-[var(--ink-soft)]">
                                      {l.category?.name ?? "Category"}:
                                    </span>{" "}
                                    {opts.join(", ") || "—"}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            Array.isArray(d.options) ? d.options.join(", ") : "—"
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2">{d.isRequired ? "Yes" : "No"}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-3">
                          {(d.dataType === "SELECT" ||
                            d.dataType === "MULTI_SELECT" ||
                            d.dataType === "NUMBER") && (
                            <button
                              type="button"
                              className="text-[var(--brand)] hover:underline text-xs font-medium"
                              onClick={() => openEditOptions(d)}
                            >
                              {d.dataType === "NUMBER" ? "Edit values" : "Edit lists"}
                            </button>
                          )}
                          <ActionGroup aria-label="Row actions">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={deleteIconBtn}
                              aria-label={`Delete field ${d.label}`}
                              title="Delete field"
                              onClick={() => void deactivateAttribute(d)}
                            >
                              <Trash2 style={iconSm} aria-hidden />
                            </Button>
                          </ActionGroup>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {defs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-soft)]">
                        No custom fields yet — apply a template above, or add one from New Product.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "setup" && (
        <div className="space-y-8">
          <p className="text-sm text-[var(--ink-soft)]">
            Configure categories and brands here — or create them inline while adding a product.
          </p>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                Categories ({categories.length})
              </h2>
              <button
                type="button"
                onClick={openCreateCategory}
                className="text-sm px-3 py-1.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--brand-mid)] font-medium transition-colors"
              >
                + Add Category
              </button>
            </div>
            <div className="bg-[var(--surface-raised)] rounded-xl border border-[var(--line)] overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[var(--mist)] border-b border-[var(--line)] text-left">
                  <tr>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Name</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Parent</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">HSN</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Tax %</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--mist)] transition-colors">
                      <td className="px-4 py-2 font-medium text-[var(--ink)]">{c.name}</td>
                      <td className="px-4 py-2 text-[var(--ink-soft)]">
                        {categories.find((p) => p.id === c.parentId)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-[var(--ink-soft)]">{c.defaultHsnCode || "—"}</td>
                      <td className="px-4 py-2 text-[var(--ink-soft)]">
                        {c.defaultTaxRate != null ? `${c.defaultTaxRate}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <ActionGroup aria-label="Row actions">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit category ${c.name}`}
                            title="Edit category"
                            onClick={() => openEditCategory(c)}
                          >
                            <SquarePen style={iconSm} aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={deleteIconBtn}
                            aria-label={`Delete category ${c.name}`}
                            title="Delete category"
                            onClick={() => void deactivateCategory(c)}
                          >
                            <Trash2 style={iconSm} aria-hidden />
                          </Button>
                        </ActionGroup>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-soft)]">
                        No categories yet. Add one to group products.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                Brands ({brands.length})
              </h2>
              <button
                type="button"
                onClick={openCreateBrand}
                className="text-sm px-3 py-1.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--brand-mid)] font-medium transition-colors"
              >
                + Add Brand
              </button>
            </div>
            <div className="bg-[var(--surface-raised)] rounded-xl border border-[var(--line)] overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[var(--mist)] border-b border-[var(--line)] text-left">
                  <tr>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Name</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {brands.map((b) => (
                    <tr key={b.id} className="hover:bg-[var(--mist)] transition-colors">
                      <td className="px-4 py-2 font-medium text-[var(--ink)]">{b.name}</td>
                      <td className="px-3 py-2.5 text-right">
                        <ActionGroup aria-label="Row actions">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit brand ${b.name}`}
                            title="Edit brand"
                            onClick={() => openEditBrand(b)}
                          >
                            <SquarePen style={iconSm} aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={deleteIconBtn}
                            aria-label={`Delete brand ${b.name}`}
                            title="Delete brand"
                            onClick={() => void deactivateBrand(b)}
                          >
                            <Trash2 style={iconSm} aria-hidden />
                          </Button>
                        </ActionGroup>
                      </td>
                    </tr>
                  ))}
                  {brands.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-[var(--ink-soft)]">
                        No brands yet. Add manufacturers or labels here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {stockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-raised)] rounded-xl shadow-2xl p-6 w-80">
            <h2 className="font-bold text-[var(--ink)] mb-4">Add Stock — {stockModal.name}</h2>
            <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Quantity ({stockModal.unit})</label>
            <input
              type="number"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
            <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Unit Cost (₹)</label>
            <input
              type="number"
              value={stockCost}
              onChange={(e) => setStockCost(e.target.value)}
              className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            />
            <div className="flex gap-2">
              <button onClick={addStock} className="flex-1 bg-[var(--brand)] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[var(--brand-mid)] transition-colors">
                Confirm
              </button>
              <button onClick={() => setStockModal(null)} className="flex-1 bg-[var(--mist)] py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {formMode === "edit" && (
        <ProductEditorForm
          title={`Edit Product — ${editingProduct?.name}`}
          subtitle="Update identity, pricing, inventory, and attributes."
          onClose={() => {
            setFormMode(null);
            setEditingProduct(null);
          }}
          onSubmit={submitProductForm}
          footer={
            <>
              <button
                type="button"
                onClick={() => editingProduct && deactivateProduct(editingProduct)}
                className="text-xs font-medium text-red-600 hover:text-red-800 mr-auto"
              >
                Delete product
              </button>
              <button
                type="button"
                className="pe-btn-ghost"
                onClick={() => {
                  setFormMode(null);
                  setEditingProduct(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" disabled={creatingProduct} className="pe-btn-primary">
                {creatingProduct ? "Saving…" : "Save changes"}
              </button>
            </>
          }
        >
              {/* Classification */}
              <div>
                <h3 className="pe-section-title">Classification</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-[var(--ink-soft)]">Category</label>
                      {!inlineCategoryOpen && (
                        <button
                          type="button"
                          className="text-xs text-[var(--brand)] hover:text-[var(--brand)] font-medium"
                          onClick={() => {
                            setInlineCategoryOpen(true);
                            setInlineCategoryName("");
                            setInlineCategoryError("");
                          }}
                        >
                          + New
                        </button>
                      )}
                    </div>
                    <select
                      className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                      value={productForm.categoryId}
                      onChange={(e) => {
                        const categoryId = e.target.value;
                        setProductForm((f) => ({ ...f, categoryId }));
                        setInlineFieldOpen(false);
                        loadDefsForCategory(categoryId);
                      }}
                    >
                      <option value="">— Select (unlocks attributes) —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    {inlineCategoryOpen && (
                      // Note: plain <div>, not <form> — this sits inside the New Product <form> and
                      // nested <form> elements are invalid HTML / break hydration.
                      <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--mist)] p-3 space-y-2">
                        <input
                          autoFocus
                          required
                          placeholder="Category name, e.g. Laminates"
                          value={inlineCategoryName}
                          onChange={(e) => setInlineCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              submitInlineCategory();
                            }
                          }}
                          className="w-full border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                        />
                        {inlineCategoryError && <p className="text-xs text-red-600">{inlineCategoryError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => submitInlineCategory()}
                            disabled={inlineCategorySaving}
                            className="text-xs px-3 py-1.5 bg-[var(--brand)] text-white rounded-lg font-semibold hover:bg-[var(--brand-mid)] disabled:opacity-50 transition-colors"
                          >
                            {inlineCategorySaving ? "Adding…" : "Add category"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineCategoryOpen(false)}
                            className="text-xs px-3 py-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={openCreateCategory}
                            className="ml-auto text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] underline"
                          >
                            More options
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-[var(--ink-soft)]">Brand</label>
                      {!inlineBrandOpen && (
                        <button
                          type="button"
                          className="text-xs text-[var(--brand)] hover:text-[var(--brand)] font-medium"
                          onClick={() => {
                            setInlineBrandOpen(true);
                            setInlineBrandName("");
                            setInlineBrandError("");
                          }}
                        >
                          + New
                        </button>
                      )}
                    </div>
                    <select
                      className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                      value={productForm.brandId}
                      onChange={(e) => {
                        setProductForm((f) => ({ ...f, brandId: e.target.value }));
                      }}
                    >
                      <option value="">— Optional —</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>

                    {inlineBrandOpen && (
                      <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--mist)] p-3 space-y-2">
                        <input
                          autoFocus
                          required
                          placeholder="Brand name, e.g. Greenply"
                          value={inlineBrandName}
                          onChange={(e) => setInlineBrandName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              submitInlineBrand();
                            }
                          }}
                          className="w-full border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                        />
                        {inlineBrandError && <p className="text-xs text-red-600">{inlineBrandError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => submitInlineBrand()}
                            disabled={inlineBrandSaving}
                            className="text-xs px-3 py-1.5 bg-[var(--brand)] text-white rounded-lg font-semibold hover:bg-[var(--brand-mid)] disabled:opacity-50 transition-colors"
                          >
                            {inlineBrandSaving ? "Adding…" : "Add brand"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineBrandOpen(false)}
                            className="text-xs px-3 py-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={openCreateBrand}
                            className="ml-auto text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] underline"
                          >
                            More options
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Basic details */}
              <div>
                <h3 className="pe-section-title">Identity</h3>
                <div className="grid grid-cols-2 gap-4">
                  {(
                    [
                      ["SKU *", "text", "sku"],
                      ["Name *", "text", "name"],
                      ["Unit", "text", "unit"],
                      ["Barcode", "text", "barcode"],
                    ] as const
                  ).map(([label, type, key]) => (
                    <div key={key} className={key === "name" || key === "sku" ? "col-span-2" : ""}>
                      <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">
                        {label}
                        {key === "sku" && formMode === "edit" && (
                          <span className="ml-1.5 font-normal text-[var(--ink-soft)]">(cannot be changed)</span>
                        )}
                        {key === "sku" && formMode === "new" && (
                          <span className="ml-1.5 font-normal text-[var(--ink-soft)]">
                            {skuSuggesting
                              ? "(generating…)"
                              : skuManual
                                ? "(manual — click Regenerate to auto)"
                                : "(auto from category + brand)"}
                          </span>
                        )}
                      </label>
                      <div className={key === "sku" && formMode === "new" ? "flex gap-2" : undefined}>
                        <input
                          type={type}
                          required={label.includes("*")}
                          disabled={key === "sku" && formMode === "edit"}
                          value={productForm[key]}
                          onChange={(e) => {
                            if (key === "sku") setSkuManual(true);
                            setProductForm((f) => ({ ...f, [key]: e.target.value }));
                          }}
                          placeholder={
                            key === "sku" && formMode === "new"
                              ? "Select category/brand → e.g. PLY-CEN-0001"
                              : undefined
                          }
                          className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:bg-[var(--mist)] disabled:text-[var(--ink-soft)] font-mono"
                        />
                        {key === "sku" && formMode === "new" && (
                          <button
                            type="button"
                            disabled={skuSuggesting || (!productForm.categoryId && !productForm.brandId)}
                            onClick={() => {
                              setSkuManual(false);
                              void suggestSku(productForm.categoryId, productForm.brandId);
                            }}
                            className="shrink-0 text-xs px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] hover:bg-[var(--mist)] font-semibold disabled:opacity-40"
                          >
                            Regenerate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Media */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-3">
                  Media
                </h3>
                <ProductMediaGallery
                  value={imageUrls}
                  onChange={setImageUrls}
                  onError={(msg) => notify(`Image upload failed: ${msg}`, "error")}
                />
              </div>

              <ProductPricingSection
                form={{
                  pricingBasis: productForm.pricingBasis,
                  pricingUom: productForm.pricingUom,
                  baseRate: productForm.baseRate,
                  sellPrice: productForm.sellPrice,
                  weight: productForm.weight,
                  weightUnit: productForm.weightUnit,
                }}
                onChange={(patch) => setProductForm((f) => ({ ...f, ...patch }))}
                quotePreview={quotePreview}
                quotePreviewLoading={quotePreviewLoading}
                quotePreviewError={quotePreviewError}
              />

              <ProductInventorySection
                form={{
                  costPrice: productForm.costPrice,
                  reorderLevel: productForm.reorderLevel,
                  initialStock: productForm.initialStock,
                }}
                onChange={(patch) => setProductForm((f) => ({ ...f, ...patch }))}
                showInitialStock={formMode !== "edit" && productForm.productStructure === "SIMPLE"}
              />

              <ProductVariantsSection
                productId={formMode === "edit" ? editingProduct?.id ?? null : null}
                productSku={productForm.sku}
                productStructure={productForm.productStructure}
                variantAxes={productForm.variantAxes}
                axisDefs={formDefs
                  .filter((d) => d.isVariantAxis || ["size", "color", "pack", "thickness"].includes(d.key))
                  .map((d) => ({
                    key: d.key,
                    label: d.label,
                    options: Array.isArray(d.options) ? d.options.map(String) : [],
                  }))}
                onStructureChange={(s) => setProductForm((f) => ({ ...f, productStructure: s }))}
                onAxesChange={(axes) => setProductForm((f) => ({ ...f, variantAxes: axes }))}
                api={api}
              />

              {/* Attributes */}
              <div className="border-t border-[var(--line)] pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="pe-section-title" style={{ borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
                    Attributes {selectedCategoryName ? `— ${selectedCategoryName}` : ""}
                  </h3>
                  {productForm.categoryId && !inlineFieldOpen && (
                    <button
                      type="button"
                      className="text-xs text-[var(--brand)] hover:text-[var(--brand)] font-medium"
                      onClick={() => {
                        setInlineFieldOpen(true);
                        setInlineFieldForm(EMPTY_INLINE_FIELD_FORM);
                        setInlineFieldError("");
                      }}
                    >
                      + Add attribute
                    </button>
                  )}
                </div>

                {!productForm.categoryId && (
                  <p className="text-xs text-[var(--ink-soft)]">Pick a category above to see or add attributes (thickness, size, grade…).</p>
                )}

                {productForm.categoryId && (
                  <div className="space-y-3">
                    {formDefs.map((d) => {
                      const options = Array.isArray(d.options) ? d.options : [];
                      return (
                        <div key={d.key}>
                          <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">
                            {d.label}
                            {d.unit ? ` (${d.unit})` : ""}
                            {d.isRequired ? " *" : ""}
                          </label>
                          {d.dataType === "SELECT" ? (
                            <select
                              required={d.isRequired}
                              className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                              value={customAttrs[d.key] ?? ""}
                              onChange={(e) => setCustomAttrs((a) => ({ ...a, [d.key]: e.target.value }))}
                            >
                              <option value="">— Select —</option>
                              {options.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          ) : d.dataType === "BOOLEAN" ? (
                            <select
                              className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                              value={customAttrs[d.key] ?? ""}
                              onChange={(e) => setCustomAttrs((a) => ({ ...a, [d.key]: e.target.value }))}
                            >
                              <option value="">—</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type={d.dataType === "NUMBER" || d.dataType === "UNIT_NUMBER" ? "number" : "text"}
                              required={d.isRequired}
                              className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                              value={customAttrs[d.key] ?? ""}
                              onChange={(e) => setCustomAttrs((a) => ({ ...a, [d.key]: e.target.value }))}
                              placeholder={d.dataType === "MULTI_SELECT" ? "a, b, c" : undefined}
                            />
                          )}
                        </div>
                      );
                    })}

                    {formDefs.length === 0 && !inlineFieldOpen && (
                      <p className="text-xs text-[var(--ink-soft)]">
                        No attributes for this category yet. Use <strong>+ Add attribute</strong> above to create one (e.g. Thickness, Size, Grade).
                      </p>
                    )}

                    {inlineFieldOpen && (
                      <div className="rounded-lg border border-[var(--line)] bg-[var(--mist)] p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            autoFocus
                            required
                            placeholder="Field name, e.g. Thickness"
                            value={inlineFieldForm.label}
                            onChange={(e) => setInlineFieldForm((f) => ({ ...f, label: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                submitInlineField();
                              }
                            }}
                            className="col-span-2 border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                          />
                          <select
                            value={inlineFieldForm.dataType}
                            onChange={(e) => setInlineFieldForm((f) => ({ ...f, dataType: e.target.value }))}
                            className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            placeholder="Unit (optional), e.g. mm"
                            value={inlineFieldForm.unit}
                            onChange={(e) => setInlineFieldForm((f) => ({ ...f, unit: e.target.value }))}
                            className="border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                          />
                          {(inlineFieldForm.dataType === "SELECT" || inlineFieldForm.dataType === "MULTI_SELECT") && (
                            <input
                              placeholder="Allowed values, comma-separated e.g. 8x4, 7x3, 6x3"
                              value={inlineFieldForm.options}
                              onChange={(e) => setInlineFieldForm((f) => ({ ...f, options: e.target.value }))}
                              className="col-span-2 border border-[var(--line)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                            />
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
                          <input
                            type="checkbox"
                            checked={inlineFieldForm.isRequired}
                            onChange={(e) => setInlineFieldForm((f) => ({ ...f, isRequired: e.target.checked }))}
                          />
                          Required on this category
                        </label>
                        {inlineFieldError && <p className="text-xs text-red-600">{inlineFieldError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => submitInlineField()}
                            disabled={inlineFieldSaving}
                            className="text-xs px-3 py-1.5 bg-[var(--brand)] text-white rounded-lg font-semibold hover:bg-[var(--brand-mid)] disabled:opacity-50 transition-colors"
                          >
                            {inlineFieldSaving ? "Adding…" : "Add attribute"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineFieldOpen(false)}
                            className="text-xs px-3 py-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
        </ProductEditorForm>
      )}

      {showAddField && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={createField} className="bg-[var(--surface-raised)] rounded-xl shadow-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-[var(--ink)]">Add custom field</h2>
            <div>
              <input
                required
                placeholder="Label, e.g. Thickness"
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                value={fieldForm.label}
                onChange={(e) => setFieldForm((f) => ({ ...f, label: e.target.value }))}
              />
              {fieldForm.label.trim() && (
                <p className="text-xs text-[var(--ink-soft)] mt-1">
                  Stored as <code className="bg-[var(--mist)] px-1 rounded">{slugifyKey(fieldForm.label)}</code>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                value={fieldForm.dataType}
                onChange={(e) => setFieldForm((f) => ({ ...f, dataType: e.target.value }))}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                placeholder="Unit (optional)"
                className="border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                value={fieldForm.unit}
                onChange={(e) => setFieldForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
            {(fieldForm.dataType === "SELECT" || fieldForm.dataType === "MULTI_SELECT") && (
              <input
                placeholder="Options comma-separated"
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                value={fieldForm.options}
                onChange={(e) => setFieldForm((f) => ({ ...f, options: e.target.value }))}
              />
            )}
            <div>
              <select
                multiple
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                value={fieldForm.categoryIds}
                onChange={(e) =>
                  setFieldForm((f) => ({
                    ...f,
                    categoryIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                  }))
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--ink-soft)] mt-1">Hold Ctrl/Cmd to multi-select categories. Empty = all products.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                checked={fieldForm.isRequired}
                onChange={(e) => setFieldForm((f) => ({ ...f, isRequired: e.target.checked }))}
              />
              Required on product
            </label>
            {fieldFormError && <p className="text-xs text-red-600">{fieldFormError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 bg-[var(--ink)] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[var(--brand-mid)] transition-colors">
                Save field
              </button>
              <button
                type="button"
                onClick={() => setShowAddField(false)}
                className="flex-1 bg-[var(--mist)] py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showScanner && (
        <BarcodeScannerModal
          onDetected={(code) => {
            setShowScanner(false);
            setBarcodeInput(code);
            lookupBarcode(code);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {categoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <form onSubmit={saveCategory} className="bg-[var(--surface-raised)] rounded-xl shadow-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-[var(--ink)]">
              {categoryModal === "create" ? "Add Category" : "Edit Category"}
            </h2>
            <div>
              <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Name *</label>
              <input
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                placeholder="e.g. Plywood"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Description</label>
              <input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Default HSN</label>
                <input
                  value={categoryForm.defaultHsnCode}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, defaultHsnCode: e.target.value }))}
                  className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Default Tax %</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={categoryForm.defaultTaxRate}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, defaultTaxRate: e.target.value }))}
                  className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Parent category</label>
              <select
                value={categoryForm.parentId}
                onChange={(e) => setCategoryForm((f) => ({ ...f, parentId: e.target.value }))}
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="">— None —</option>
                {categories
                  .filter((c) => categoryModal === "create" || c.id !== categoryModal.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <input
                type="checkbox"
                checked={categoryForm.isFeatured}
                onChange={(e) => setCategoryForm((f) => ({ ...f, isFeatured: e.target.checked }))}
              />
              Featured
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={setupSaving}
                className="flex-1 bg-[var(--ink)] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[var(--brand-mid)] disabled:opacity-50 transition-colors"
              >
                {setupSaving ? "Saving…" : categoryModal === "create" ? "Create" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setCategoryModal(null)}
                className="flex-1 bg-[var(--mist)] py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {brandModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <form onSubmit={saveBrand} className="bg-[var(--surface-raised)] rounded-xl shadow-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-[var(--ink)]">
              {brandModal === "create" ? "Add Brand" : "Edit Brand"}
            </h2>
            <div>
              <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Name *</label>
              <input
                required
                value={brandForm.name}
                onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                placeholder="e.g. Greenply"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Logo URL</label>
              <input
                type="url"
                value={brandForm.logoUrl}
                onChange={(e) => setBrandForm((f) => ({ ...f, logoUrl: e.target.value }))}
                className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                placeholder="https://…"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={setupSaving}
                className="flex-1 bg-[var(--ink)] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[var(--brand-mid)] disabled:opacity-50 transition-colors"
              >
                {setupSaving ? "Saving…" : brandModal === "create" ? "Create" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setBrandModal(null)}
                className="flex-1 bg-[var(--mist)] py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editOptionsField && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8 p-4">
          <form
            onSubmit={saveFieldOptions}
            className="bg-[var(--surface-raised)] rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4"
          >
            <div>
              <h2 className="font-bold text-[var(--ink)]">
                {editOptionsField.dataType === "NUMBER" ? "Edit values" : "Edit lists"} —{" "}
                {editOptionsField.label}
              </h2>
              <p className="text-xs text-[var(--ink-soft)] mt-1">
                Stored on the product as <code className="bg-[var(--mist)] px-1 rounded">{editOptionsField.key}</code>.
                {editOptionsField.dataType === "NUMBER"
                  ? " Enter allowed numbers as chips in Create Product (e.g. 6, 12, 18, 19)."
                  : " Each category can show a different dropdown list."}
              </p>
            </div>

            {(editOptionsField.categoryLinks?.length ?? 0) > 0 ? (
              editOptionsField.categoryLinks!.map((l) => (
                <div key={l.categoryId}>
                  <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">
                    {l.category?.name ?? l.categoryId} — allowed values
                  </label>
                  <textarea
                    required
                    rows={2}
                    className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    value={optionsByCategory[l.categoryId] ?? ""}
                    onChange={(e) =>
                      setOptionsByCategory((m) => ({ ...m, [l.categoryId]: e.target.value }))
                    }
                    placeholder="8x4, 7x3, 6x3"
                  />
                  <p className="text-xs text-[var(--ink-soft)] mt-1">Comma-separated</p>
                </div>
              ))
            ) : (
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Default allowed values</label>
                <textarea
                  required
                  rows={2}
                  className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  value={defaultOptionsText}
                  onChange={(e) => setDefaultOptionsText(e.target.value)}
                  placeholder="8x4, 7x3, 6x3"
                />
              </div>
            )}

            {(editOptionsField.categoryLinks?.length ?? 0) > 0 && (
              <div>
                <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">
                  Fallback default (if a category has no override)
                </label>
                <textarea
                  rows={2}
                  className="w-full border border-[var(--line)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  value={defaultOptionsText}
                  onChange={(e) => setDefaultOptionsText(e.target.value)}
                  placeholder="8x4, 7x3, 6x3"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={optionsSaving}
                className="flex-1 bg-[var(--ink)] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[var(--brand-mid)] disabled:opacity-50 transition-colors"
              >
                {optionsSaving ? "Saving…" : "Save lists"}
              </button>
              <button
                type="button"
                onClick={() => setEditOptionsField(null)}
                className="flex-1 bg-[var(--mist)] py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

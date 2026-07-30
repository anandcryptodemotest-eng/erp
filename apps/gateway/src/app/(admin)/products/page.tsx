"use client";
import { useEffect, useRef, useState } from "react";
import { api, getAdminUser } from "@/lib/admin-api";
import dynamic from "next/dynamic";

const BarcodeScannerModal = dynamic(() => import("@/components/BarcodeScannerModal"), { ssr: false });

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
  costPrice: number;
  sellPrice: number;
  reorderLevel: number;
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
  reorderLevel: "10",
  initialStock: "0",
  barcode: "",
  categoryId: "",
  brandId: "",
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

const FIELD_TYPES = ["TEXT", "NUMBER", "SELECT", "MULTI_SELECT", "BOOLEAN", "UNIT_NUMBER"] as const;

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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(EMPTY_FORM);
  /** When true, user typed SKU manually — stop overwriting on category/brand change */
  const [skuManual, setSkuManual] = useState(false);
  const [skuSuggesting, setSkuSuggesting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [customAttrs, setCustomAttrs] = useState<Record<string, string>>({});
  const [formDefs, setFormDefs] = useState<AttrDef[]>([]);
  const [addAnother, setAddAnother] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);

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
    setFormMode("new");
    setEditingProduct(null);
    setProductForm(EMPTY_FORM);
    setSkuManual(false);
    setImageUrls([]);
    setFormDefs([]);
    setCustomAttrs({});
    setAddAnother(false);
    resetInlineSections();
    setMsg("");
  }

  function openEditProductForm(p: Product) {
    setFormMode("edit");
    setEditingProduct(p);
    setSkuManual(true);
    setImageUrls(Array.isArray(p.imageUrls) ? p.imageUrls.filter(Boolean) : []);
    setProductForm({
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      costPrice: String(p.costPrice),
      sellPrice: String(p.sellPrice),
      reorderLevel: String(p.reorderLevel),
      initialStock: "0",
      barcode: p.barcode ?? "",
      categoryId: p.categoryId ?? p.category?.id ?? "",
      brandId: p.brandId ?? p.brand?.id ?? "",
    });
    setAddAnother(false);
    resetInlineSections();
    setMsg("");
    const categoryId = p.categoryId ?? p.category?.id ?? "";
    if (categoryId) {
      loadDefsForCategory(categoryId, p.customAttributes);
    } else {
      setFormDefs([]);
      setCustomAttrs({});
    }
  }

  async function uploadProductImages(files: FileList | File[]) {
    const list = Array.from(files).slice(0, Math.max(0, 4 - imageUrls.length));
    if (!list.length) return;
    setImageUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of list) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await api("/api/uploads/product-image", { method: "POST", body: fd });
        if (r?.data?.url) uploaded.push(r.data.url as string);
      }
      if (uploaded.length) setImageUrls((prev) => [...prev, ...uploaded].slice(0, 4));
    } catch (e: unknown) {
      notify(`Image upload failed: ${errText(e)}`, "error");
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
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

  async function submitProductForm(e: React.FormEvent) {
    e.preventDefault();
    setCreatingProduct(true);
    try {
      const customAttributes = buildCustomAttributesPayload();

      if (formMode === "edit" && editingProduct) {
        await api(`/api/products/${editingProduct.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: productForm.name,
            unit: productForm.unit,
            costPrice: Number(productForm.costPrice),
            sellPrice: Number(productForm.sellPrice),
            reorderLevel: Number(productForm.reorderLevel),
            barcode: productForm.barcode || null,
            categoryId: productForm.categoryId || null,
            brandId: productForm.brandId || null,
            imageUrls: imageUrls.length ? imageUrls : null,
            customAttributes,
          }),
        });
        notify(`Product "${productForm.name}" updated`, "success");
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
          costPrice: Number(productForm.costPrice),
          sellPrice: Number(productForm.sellPrice),
          reorderLevel: Number(productForm.reorderLevel),
          ...(productForm.barcode && { barcode: productForm.barcode }),
          ...(productForm.categoryId && { categoryId: productForm.categoryId }),
          ...(productForm.brandId && { brandId: productForm.brandId }),
          ...(imageUrls.length ? { imageUrls } : {}),
          ...(Object.keys(customAttributes).length ? { customAttributes } : {}),
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
      notify(`Product "${productForm.name}" created`, "success");
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
    if (!confirm(`Deactivate product "${p.name}"? It will be hidden from the catalog.`)) return;
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      notify(`Product "${p.name}" deactivated`, "success");
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
    if (!confirm(`Deactivate category "${c.name}"?`)) return;
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      notify(`Category "${c.name}" deactivated`, "success");
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
    if (!confirm(`Deactivate brand "${b.name}"?`)) return;
    try {
      await api(`/api/brands/${b.id}`, { method: "DELETE" });
      notify(`Brand "${b.name}" deactivated`, "success");
      await loadCatalog();
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

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {isCatalogAdmin ? "Products" : "Product lookup"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
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
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
              <button
                onClick={() => lookupBarcode()}
                disabled={barcodeLooking}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {barcodeLooking ? "…" : "Find"}
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                Camera
              </button>
            </div>
            <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
            <button
              onClick={() => csvRef.current?.click()}
              disabled={importing}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {importing ? "Importing…" : "Import CSV"}
            </button>
            <button
              onClick={openNewProductForm}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 shadow-sm transition-colors"
            >
              + New Product
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 inline-flex gap-1 rounded-lg bg-gray-100 p-1">
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
              tab === key ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
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
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["SKU", "Name", "Category", "Attributes", "Unit", "Sell", "Stock", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => {
                    const totalStock = (p.stocks ?? []).reduce((sum, s) => sum + s.quantity, 0);
                    const isLow = totalStock <= p.reorderLevel;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-gray-500">{p.category?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px] truncate" title={formatAttrs(p)}>
                          {formatAttrs(p) || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">₹{p.sellPrice}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${isLow ? "text-red-600" : "text-gray-900"}`}>
                            {totalStock} {p.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isCatalogAdmin ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditProductForm(p)}
                                className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setStockModal(p);
                                  setStockQty("100");
                                  setStockCost(String(p.costPrice));
                                  setMsg("");
                                }}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                              >
                                + Add Stock
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        No products yet.
                        {isCatalogAdmin && (
                          <>
                            {" "}
                            <button
                              type="button"
                              onClick={openNewProductForm}
                              className="text-indigo-600 hover:underline font-medium"
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
            <strong>Edit lists</strong> below.
          </div>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Industry packs</h2>
              <button
                type="button"
                onClick={() => {
                  setFieldFormError("");
                  setShowAddField(true);
                }}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                + Add field
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div key={t.templateId} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="font-medium text-gray-900">{t.name}</div>
                  <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {t.attributeCount} fields
                    {t.categories.length ? ` · ${t.categories.join(", ")}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => applyTemplate(t.templateId)}
                    className="mt-3 text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Fields for this tenant ({defs.length})
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-left">
                  <tr>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Field</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Type</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Shows on category</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Lists (per category)</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Required</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {defs.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{d.label}</div>
                        <div className="font-mono text-xs text-gray-400">{d.key}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {d.dataType}
                        {d.unit ? ` (${d.unit})` : ""}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {!d.categoryLinks?.length
                          ? "All products"
                          : d.categoryLinks.map((l) => l.category?.name ?? l.categoryId).join(", ")}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 max-w-[280px]">
                        {d.dataType === "SELECT" || d.dataType === "MULTI_SELECT" ? (
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
                                    <span className="font-medium text-gray-700">
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
                      <td className="px-4 py-2 text-right">
                        {(d.dataType === "SELECT" || d.dataType === "MULTI_SELECT") && (
                          <button
                            type="button"
                            className="text-blue-600 hover:underline text-xs font-medium"
                            onClick={() => openEditOptions(d)}
                          >
                            Edit lists
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {defs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
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
          <p className="text-sm text-gray-500">
            Configure categories and brands here — or create them inline while adding a product.
          </p>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Categories ({categories.length})
              </h2>
              <button
                type="button"
                onClick={openCreateCategory}
                className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
              >
                + Add Category
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-left">
                  <tr>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Name</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Parent</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">HSN</th>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Tax %</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {categories.find((p) => p.id === c.parentId)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{c.defaultHsnCode || "—"}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {c.defaultTaxRate != null ? `${c.defaultTaxRate}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right space-x-3">
                        <button type="button" className="text-blue-600 hover:underline font-medium" onClick={() => openEditCategory(c)}>
                          Edit
                        </button>
                        <button type="button" className="text-red-600 hover:underline font-medium" onClick={() => deactivateCategory(c)}>
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Brands ({brands.length})
              </h2>
              <button
                type="button"
                onClick={openCreateBrand}
                className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
              >
                + Add Brand
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-left">
                  <tr>
                    <th className="px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-semibold">Name</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {brands.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 font-medium text-gray-900">{b.name}</td>
                      <td className="px-4 py-2 text-right space-x-3">
                        <button type="button" className="text-blue-600 hover:underline font-medium" onClick={() => openEditBrand(b)}>
                          Edit
                        </button>
                        <button type="button" className="text-red-600 hover:underline font-medium" onClick={() => deactivateBrand(b)}>
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                  {brands.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-gray-400">
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
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
            <h2 className="font-bold text-gray-900 mb-4">Add Stock — {stockModal.name}</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({stockModal.unit})</label>
            <input
              type="number"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost (₹)</label>
            <input
              type="number"
              value={stockCost}
              onChange={(e) => setStockCost(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <div className="flex gap-2">
              <button onClick={addStock} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                Confirm
              </button>
              <button onClick={() => setStockModal(null)} className="flex-1 bg-gray-100 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {formMode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={submitProductForm}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">
                  {formMode === "edit" ? `Edit Product — ${editingProduct?.name}` : "New Product"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formMode === "edit"
                    ? "Update details, pricing or attributes. SKU is fixed once created."
                    : "Category, brand and attributes can all be created right here — no need to leave this screen."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormMode(null);
                  setEditingProduct(null);
                }}
                className="shrink-0 h-8 w-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto space-y-6">
              {/* Classification */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Classification</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Category</label>
                      {!inlineCategoryOpen && (
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                      <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
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
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        {inlineCategoryError && <p className="text-xs text-red-600">{inlineCategoryError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => submitInlineCategory()}
                            disabled={inlineCategorySaving}
                            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {inlineCategorySaving ? "Adding…" : "Add category"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineCategoryOpen(false)}
                            className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={openCreateCategory}
                            className="ml-auto text-xs text-gray-500 hover:text-gray-800 underline"
                          >
                            More options
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Brand</label>
                      {!inlineBrandOpen && (
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                      <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
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
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        {inlineBrandError && <p className="text-xs text-red-600">{inlineBrandError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => submitInlineBrand()}
                            disabled={inlineBrandSaving}
                            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {inlineBrandSaving ? "Adding…" : "Add brand"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineBrandOpen(false)}
                            className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={openCreateBrand}
                            className="ml-auto text-xs text-gray-500 hover:text-gray-800 underline"
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
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Basic details</h3>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {label}
                        {key === "sku" && formMode === "edit" && (
                          <span className="ml-1.5 font-normal text-gray-400">(cannot be changed)</span>
                        )}
                        {key === "sku" && formMode === "new" && (
                          <span className="ml-1.5 font-normal text-gray-400">
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
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-100 disabled:text-gray-500 font-mono"
                        />
                        {key === "sku" && formMode === "new" && (
                          <button
                            type="button"
                            disabled={skuSuggesting || (!productForm.categoryId && !productForm.brandId)}
                            onClick={() => {
                              setSkuManual(false);
                              void suggestSku(productForm.categoryId, productForm.brandId);
                            }}
                            className="shrink-0 text-xs px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-semibold disabled:opacity-40"
                          >
                            Regenerate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Product images
                  <span className="ml-2 font-normal normal-case text-gray-400">
                    up to 4 · JPG/PNG/WebP · max 2 MB · first is primary
                  </span>
                </h3>
                <div className="flex flex-wrap gap-3 items-start">
                  {imageUrls.map((url, idx) => (
                    <div
                      key={url}
                      className="relative h-24 w-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Primary
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                        className="absolute right-1 top-1 hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-xs"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setImageUrls((prev) => {
                              const next = [...prev];
                              const [item] = next.splice(idx, 1);
                              next.unshift(item);
                              return next;
                            })
                          }
                          className="absolute bottom-1 left-1 hidden group-hover:inline-flex rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                        >
                          Make primary
                        </button>
                      )}
                    </div>
                  ))}
                  {imageUrls.length < 4 && (
                    <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white text-center text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        disabled={imageUploading}
                        onChange={(e) => {
                          if (e.target.files?.length) void uploadProductImages(e.target.files);
                        }}
                      />
                      {imageUploading ? "Uploading…" : "+ Add"}
                    </label>
                  )}
                </div>
              </div>

              {/* Pricing & stock */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Pricing & stock</h3>
                <div className="grid grid-cols-2 gap-4">
                  {(
                    [
                      ["Cost Price (₹) *", "number", "costPrice"],
                      ["Sell Price (₹) *", "number", "sellPrice"],
                      ["Reorder Level", "number", "reorderLevel"],
                      ...(formMode === "edit" ? [] : [["Initial Stock", "number", "initialStock"] as const]),
                    ] as const
                  ).map(([label, type, key]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                      <input
                        type={type}
                        required={label.includes("*")}
                        value={productForm[key]}
                        onChange={(e) => setProductForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Attributes */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Attributes {selectedCategoryName ? `— ${selectedCategoryName}` : ""}
                  </h3>
                  {productForm.categoryId && !inlineFieldOpen && (
                    <button
                      type="button"
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
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
                  <p className="text-xs text-gray-400">Pick a category above to see or add attributes (thickness, size, grade…).</p>
                )}

                {productForm.categoryId && (
                  <div className="space-y-3">
                    {formDefs.map((d) => {
                      const options = Array.isArray(d.options) ? d.options : [];
                      return (
                        <div key={d.key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {d.label}
                            {d.unit ? ` (${d.unit})` : ""}
                            {d.isRequired ? " *" : ""}
                          </label>
                          {d.dataType === "SELECT" ? (
                            <select
                              required={d.isRequired}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              value={customAttrs[d.key] ?? ""}
                              onChange={(e) => setCustomAttrs((a) => ({ ...a, [d.key]: e.target.value }))}
                              placeholder={d.dataType === "MULTI_SELECT" ? "a, b, c" : undefined}
                            />
                          )}
                        </div>
                      );
                    })}

                    {formDefs.length === 0 && !inlineFieldOpen && (
                      <p className="text-xs text-gray-400">
                        No attributes for this category yet. Use <strong>+ Add attribute</strong> above to create one (e.g. Thickness, Size, Grade).
                      </p>
                    )}

                    {inlineFieldOpen && (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
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
                            className="col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          <select
                            value={inlineFieldForm.dataType}
                            onChange={(e) => setInlineFieldForm((f) => ({ ...f, dataType: e.target.value }))}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          {(inlineFieldForm.dataType === "SELECT" || inlineFieldForm.dataType === "MULTI_SELECT") && (
                            <input
                              placeholder="Allowed values, comma-separated e.g. 8x4, 7x3, 6x3"
                              value={inlineFieldForm.options}
                              onChange={(e) => setInlineFieldForm((f) => ({ ...f, options: e.target.value }))}
                              className="col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-600">
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
                            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {inlineFieldSaving ? "Adding…" : "Add attribute"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineFieldOpen(false)}
                            className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 shrink-0 flex items-center gap-3">
              {formMode === "edit" ? (
                <button
                  type="button"
                  onClick={() => editingProduct && deactivateProduct(editingProduct)}
                  className="text-xs font-medium text-red-600 hover:text-red-800 mr-auto"
                >
                  Deactivate product
                </button>
              ) : (
                <label className="flex items-center gap-2 text-xs text-gray-600 mr-auto">
                  <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} />
                  Save &amp; add another
                </label>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormMode(null);
                  setEditingProduct(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingProduct}
                className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {creatingProduct
                  ? formMode === "edit"
                    ? "Saving…"
                    : "Creating…"
                  : formMode === "edit"
                    ? "Save changes"
                    : "Create Product"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddField && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={createField} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-gray-900">Add custom field</h2>
            <div>
              <input
                required
                placeholder="Label, e.g. Thickness"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={fieldForm.label}
                onChange={(e) => setFieldForm((f) => ({ ...f, label: e.target.value }))}
              />
              {fieldForm.label.trim() && (
                <p className="text-xs text-gray-400 mt-1">
                  Stored as <code className="bg-gray-100 px-1 rounded">{slugifyKey(fieldForm.label)}</code>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={fieldForm.unit}
                onChange={(e) => setFieldForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
            {(fieldForm.dataType === "SELECT" || fieldForm.dataType === "MULTI_SELECT") && (
              <input
                placeholder="Options comma-separated"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={fieldForm.options}
                onChange={(e) => setFieldForm((f) => ({ ...f, options: e.target.value }))}
              />
            )}
            <div>
              <select
                multiple
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to multi-select categories. Empty = all products.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={fieldForm.isRequired}
                onChange={(e) => setFieldForm((f) => ({ ...f, isRequired: e.target.checked }))}
              />
              Required on product
            </label>
            {fieldFormError && <p className="text-xs text-red-600">{fieldFormError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors">
                Save field
              </button>
              <button
                type="button"
                onClick={() => setShowAddField(false)}
                className="flex-1 bg-gray-100 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
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
          <form onSubmit={saveCategory} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-gray-900">
              {categoryModal === "create" ? "Add Category" : "Edit Category"}
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="e.g. Plywood"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default HSN</label>
                <input
                  value={categoryForm.defaultHsnCode}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, defaultHsnCode: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax %</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={categoryForm.defaultTaxRate}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, defaultTaxRate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent category</label>
              <select
                value={categoryForm.parentId}
                onChange={(e) => setCategoryForm((f) => ({ ...f, parentId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
            <label className="flex items-center gap-2 text-sm text-gray-700">
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
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {setupSaving ? "Saving…" : categoryModal === "create" ? "Create" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setCategoryModal(null)}
                className="flex-1 bg-gray-100 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {brandModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <form onSubmit={saveBrand} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-gray-900">
              {brandModal === "create" ? "Add Brand" : "Edit Brand"}
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                required
                value={brandForm.name}
                onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="e.g. Greenply"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={brandForm.logoUrl}
                onChange={(e) => setBrandForm((f) => ({ ...f, logoUrl: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="https://…"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={setupSaving}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {setupSaving ? "Saving…" : brandModal === "create" ? "Create" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setBrandModal(null)}
                className="flex-1 bg-gray-100 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
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
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4"
          >
            <div>
              <h2 className="font-bold text-gray-900">Edit lists — {editOptionsField.label}</h2>
              <p className="text-xs text-gray-500 mt-1">
                Stored on the product as <code className="bg-gray-100 px-1 rounded">{editOptionsField.key}</code>.
                Each category can show a different dropdown list.
              </p>
            </div>

            {(editOptionsField.categoryLinks?.length ?? 0) > 0 ? (
              editOptionsField.categoryLinks!.map((l) => (
                <div key={l.categoryId}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {l.category?.name ?? l.categoryId} — allowed values
                  </label>
                  <textarea
                    required
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={optionsByCategory[l.categoryId] ?? ""}
                    onChange={(e) =>
                      setOptionsByCategory((m) => ({ ...m, [l.categoryId]: e.target.value }))
                    }
                    placeholder="8x4, 7x3, 6x3"
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
                </div>
              ))
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default allowed values</label>
                <textarea
                  required
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={defaultOptionsText}
                  onChange={(e) => setDefaultOptionsText(e.target.value)}
                  placeholder="8x4, 7x3, 6x3"
                />
              </div>
            )}

            {(editOptionsField.categoryLinks?.length ?? 0) > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fallback default (if a category has no override)
                </label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {optionsSaving ? "Saving…" : "Save lists"}
              </button>
              <button
                type="button"
                onClick={() => setEditOptionsField(null)}
                className="flex-1 bg-gray-100 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
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

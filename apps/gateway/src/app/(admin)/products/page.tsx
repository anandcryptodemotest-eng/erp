"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/admin-api";
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
  customAttributes?: Record<string, unknown>;
  stocks: Stock[];
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
}
interface Category {
  id: string;
  name: string;
}
interface Brand {
  id: string;
  name: string;
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
  categoryLinks?: { categoryId: string; category?: { id: string; name: string } }[];
}
interface Template {
  templateId: string;
  name: string;
  description: string;
  attributeCount: number;
  categories: string[];
}

type Tab = "catalog" | "fields";

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

export default function ProductsPage() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [defs, setDefs] = useState<AttrDef[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [stockModal, setStockModal] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState("100");
  const [stockCost, setStockCost] = useState("");

  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [customAttrs, setCustomAttrs] = useState<Record<string, string>>({});
  const [formDefs, setFormDefs] = useState<AttrDef[]>([]);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeLooking, setBarcodeLooking] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [showAddField, setShowAddField] = useState(false);
  const [fieldForm, setFieldForm] = useState({
    key: "",
    label: "",
    dataType: "TEXT",
    unit: "",
    options: "",
    isRequired: false,
    categoryIds: [] as string[],
  });

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
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
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
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (tab === "fields") loadFields();
  }, [tab]);

  async function loadDefsForCategory(categoryId: string) {
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
      for (const d of list) init[d.key] = "";
      setCustomAttrs(init);
    } catch {
      setFormDefs([]);
    }
  }

  async function addStock() {
    if (!stockModal) return;
    try {
      await api("/api/stock/receive", {
        method: "POST",
        body: JSON.stringify({
          items: [{ productId: stockModal.id, warehouseId: "seed-warehouse-main", quantity: Number(stockQty) }],
          reference: "MANUAL",
        }),
      });
      setMsg(`Added ${stockQty} ${stockModal.unit} of ${stockModal.name}`);
      setStockModal(null);
      loadCatalog();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
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

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      const customAttributes = buildCustomAttributesPayload();
      const created = await api("/api/products", {
        method: "POST",
        body: JSON.stringify({
          sku: newForm.sku,
          name: newForm.name,
          unit: newForm.unit,
          costPrice: Number(newForm.costPrice),
          sellPrice: Number(newForm.sellPrice),
          reorderLevel: Number(newForm.reorderLevel),
          ...(newForm.barcode && { barcode: newForm.barcode }),
          ...(newForm.categoryId && { categoryId: newForm.categoryId }),
          ...(newForm.brandId && { brandId: newForm.brandId }),
          ...(Object.keys(customAttributes).length ? { customAttributes } : {}),
        }),
      });
      const productId = created.data?.id;
      if (productId && Number(newForm.initialStock) > 0) {
        await api("/api/stock/receive", {
          method: "POST",
          body: JSON.stringify({
            items: [{ productId, warehouseId: "seed-warehouse-main", quantity: Number(newForm.initialStock) }],
            reference: "INITIAL",
          }),
        });
      }
      setMsg(`Product "${newForm.name}" created`);
      setShowNewForm(false);
      setNewForm(EMPTY_FORM);
      setCustomAttrs({});
      setFormDefs([]);
      loadCatalog();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
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
          setMsg(`${r.data.name} — ${r.data.weightKg} kg × ₹${r.data.sellPrice}/kg = ₹${r.data.lineTotal}`);
        } else {
          setMsg(`Scale barcode — PLU ${r.data.pluCode}. Create product with that PLU first.`);
          setShowNewForm(true);
        }
        return;
      }
      if (r.data?.exists) {
        setMsg(`Barcode already in catalog: ${r.data.name}`);
        return;
      }
      if (r.data?.name) {
        setNewForm((f) => ({ ...f, name: r.data.name, unit: r.data.unit ?? "pcs", barcode: target }));
        setMsg(`Found: ${r.data.name}`);
        setShowNewForm(true);
      } else {
        setMsg("Barcode not found — fill form manually");
        setNewForm((f) => ({ ...f, barcode: target }));
        setShowNewForm(true);
      }
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
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
        setMsg("No valid rows found in CSV");
        return;
      }
      setImporting(true);
      try {
        const r = await api("/api/products/import", { method: "POST", body: JSON.stringify({ products: rows }) });
        setImportResult(r.data);
        setMsg(`Import done: ${r.data.created} created, ${r.data.skipped} skipped`);
        loadCatalog();
      } catch (err: unknown) {
        setMsg(`Import error: ${err instanceof Error ? err.message : String(err)}`);
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
      setMsg(r.data?.message ?? "Template applied");
      await loadFields();
      await loadCatalog();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function createField(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/attribute-definitions", {
        method: "POST",
        body: JSON.stringify({
          key: fieldForm.key,
          label: fieldForm.label,
          dataType: fieldForm.dataType,
          unit: fieldForm.unit || undefined,
          options:
            fieldForm.dataType === "SELECT" || fieldForm.dataType === "MULTI_SELECT"
              ? fieldForm.options.split(",").map((s) => s.trim()).filter(Boolean)
              : undefined,
          isRequired: fieldForm.isRequired,
          categoryIds: fieldForm.categoryIds.length ? fieldForm.categoryIds : undefined,
        }),
      });
      setMsg(`Field "${fieldForm.label}" added — it will show on New Product when category matches`);
      setShowAddField(false);
      setFieldForm({ key: "", label: "", dataType: "TEXT", unit: "", options: "", isRequired: false, categoryIds: [] });
      loadFields();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function formatAttrs(p: Product): string {
    const attrs = p.customAttributes ?? {};
    const parts = Object.entries(attrs).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : String(v)}`);
    return parts.join(" · ");
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            Catalog + industry fields (thickness, grade, etc.) live here — not a separate module.
          </p>
        </div>
        {tab === "catalog" && (
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1">
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupBarcode()}
                placeholder="Scan barcode…"
                className="border rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={() => lookupBarcode()}
                disabled={barcodeLooking}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {barcodeLooking ? "…" : "Find"}
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm hover:bg-indigo-200"
              >
                Camera
              </button>
            </div>
            <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
            <button
              onClick={() => csvRef.current?.click()}
              disabled={importing}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 disabled:opacity-50"
            >
              {importing ? "Importing…" : "Import CSV"}
            </button>
            <button
              onClick={() => {
                setShowNewForm(true);
                setNewForm(EMPTY_FORM);
                setFormDefs([]);
                setCustomAttrs({});
                setMsg("");
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
            >
              + New Product
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("catalog")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "catalog" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          Catalog
        </button>
        <button
          type="button"
          onClick={() => setTab("fields")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "fields" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          Custom fields
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm whitespace-pre-line">
          {msg}
        </div>
      )}
      {importResult && importResult.errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          Import errors: {importResult.errors.join("; ")}
        </div>
      )}

      {tab === "catalog" && (
        <>
          <p className="text-xs text-gray-400 mb-3">
            Tip: pick a category on New Product to fill Thickness / Size / Grade (after you apply a template under Custom fields).
          </p>
          {loading ? (
            <p className="text-gray-400">Loading…</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {["SKU", "Name", "Category", "Attributes", "Unit", "Sell", "Stock", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => {
                    const totalStock = (p.stocks ?? []).reduce((sum, s) => sum + s.quantity, 0);
                    const isLow = totalStock <= p.reorderLevel;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-gray-500">{p.category?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px] truncate" title={formatAttrs(p)}>
                          {formatAttrs(p) || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                        <td className="px-4 py-3 font-semibold text-green-700">₹{p.sellPrice}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${isLow ? "text-red-600" : "text-gray-900"}`}>
                            {totalStock} {p.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setStockModal(p);
                              setStockQty("100");
                              setStockCost(String(p.costPrice));
                              setMsg("");
                            }}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
                          >
                            + Add Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        No products yet. Apply a plywood template under Custom fields, then add a product.
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
            <strong>How this works:</strong> apply an industry pack (or add a field). Those fields then appear on{" "}
            <strong>New Product</strong> when you choose the matching category — e.g. Plywood → Thickness, Size, Grade.
          </div>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Industry packs</h2>
              <button
                type="button"
                onClick={() => setShowAddField(true)}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                + Add field
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div key={t.templateId} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="font-medium text-gray-900">{t.name}</div>
                  <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {t.attributeCount} fields
                    {t.categories.length ? ` · ${t.categories.join(", ")}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => applyTemplate(t.templateId)}
                    className="mt-3 text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
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
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-left text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Field</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Shows on category</th>
                    <th className="px-4 py-2">Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {defs.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{d.label}</div>
                        <div className="font-mono text-xs text-gray-400">{d.key}</div>
                      </td>
                      <td className="px-4 py-2">
                        {d.dataType}
                        {d.unit ? ` (${d.unit})` : ""}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {!d.categoryLinks?.length
                          ? "All products"
                          : d.categoryLinks.map((l) => l.category?.name ?? l.categoryId).join(", ")}
                      </td>
                      <td className="px-4 py-2">{d.isRequired ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {defs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        No custom fields yet — apply Plywood / Steel pack above.
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h2 className="font-bold text-gray-900 mb-4">Add Stock — {stockModal.name}</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({stockModal.unit})</label>
            <input
              type="number"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost (₹)</label>
            <input
              type="number"
              value={stockCost}
              onChange={(e) => setStockCost(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button onClick={addStock} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
                Confirm
              </button>
              <button onClick={() => setStockModal(null)} className="flex-1 bg-gray-100 py-2 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="font-bold text-gray-900 mb-1">New Product</h2>
            <p className="text-xs text-gray-500 mb-4">Core details + category attributes (if configured).</p>
            <form onSubmit={createProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={newForm.categoryId}
                    onChange={(e) => {
                      const categoryId = e.target.value;
                      setNewForm((f) => ({ ...f, categoryId }));
                      loadDefsForCategory(categoryId);
                    }}
                  >
                    <option value="">— Select (unlocks custom fields) —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {brands.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={newForm.brandId}
                      onChange={(e) => setNewForm((f) => ({ ...f, brandId: e.target.value }))}
                    >
                      <option value="">— Optional —</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(
                  [
                    ["SKU *", "text", "sku"],
                    ["Name *", "text", "name"],
                    ["Unit", "text", "unit"],
                    ["Cost Price (₹) *", "number", "costPrice"],
                    ["Sell Price (₹) *", "number", "sellPrice"],
                    ["Reorder Level", "number", "reorderLevel"],
                    ["Initial Stock", "number", "initialStock"],
                    ["Barcode", "text", "barcode"],
                  ] as const
                ).map(([label, type, key]) => (
                  <div key={key} className={key === "name" || key === "sku" ? "col-span-2" : ""}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      type={type}
                      required={label.includes("*")}
                      value={newForm[key]}
                      onChange={(e) => setNewForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              {formDefs.length > 0 && (
                <div className="border-t pt-3 mt-2 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800">Product attributes</h3>
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
                            className="w-full border rounded-lg px-3 py-2 text-sm"
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
                            className="w-full border rounded-lg px-3 py-2 text-sm"
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
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            value={customAttrs[d.key] ?? ""}
                            onChange={(e) => setCustomAttrs((a) => ({ ...a, [d.key]: e.target.value }))}
                            placeholder={d.dataType === "MULTI_SELECT" ? "a, b, c" : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {newForm.categoryId && formDefs.length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  No custom fields for this category. Open the <strong>Custom fields</strong> tab and apply Plywood /
                  Steel, then try again.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddField && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={createField} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-3">
            <h2 className="font-bold text-gray-900">Add custom field</h2>
            <input
              required
              placeholder="key (snake_case) e.g. thickness_mm"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={fieldForm.key}
              onChange={(e) => setFieldForm((f) => ({ ...f, key: e.target.value }))}
            />
            <input
              required
              placeholder="Label e.g. Thickness"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={fieldForm.label}
              onChange={(e) => setFieldForm((f) => ({ ...f, label: e.target.value }))}
            />
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={fieldForm.dataType}
              onChange={(e) => setFieldForm((f) => ({ ...f, dataType: e.target.value }))}
            >
              {["TEXT", "NUMBER", "SELECT", "BOOLEAN", "UNIT_NUMBER"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {(fieldForm.dataType === "SELECT" || fieldForm.dataType === "MULTI_SELECT") && (
              <input
                placeholder="Options comma-separated"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={fieldForm.options}
                onChange={(e) => setFieldForm((f) => ({ ...f, options: e.target.value }))}
              />
            )}
            <select
              multiple
              className="w-full border rounded-lg px-3 py-2 text-sm h-24"
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
            <p className="text-xs text-gray-400">Hold Ctrl/Cmd to multi-select categories. Empty = all products.</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fieldForm.isRequired}
                onChange={(e) => setFieldForm((f) => ({ ...f, isRequired: e.target.checked }))}
              />
              Required on product
            </label>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm">
                Save field
              </button>
              <button type="button" onClick={() => setShowAddField(false)} className="flex-1 bg-gray-100 py-2 rounded-lg text-sm">
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
    </div>
  );
}

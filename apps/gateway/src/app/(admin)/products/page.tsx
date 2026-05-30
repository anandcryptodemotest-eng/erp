"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/admin-api";
import dynamic from "next/dynamic";

const BarcodeScannerModal = dynamic(() => import("@/components/BarcodeScannerModal"), { ssr: false });

interface Stock { warehouseId: string; quantity: number; warehouse: { name: string }; }
interface Product { id: string; sku: string; name: string; unit: string; costPrice: number; sellPrice: number; reorderLevel: number; stocks: Stock[]; }

const EMPTY_FORM = { sku: "", name: "", unit: "pcs", costPrice: "", sellPrice: "", reorderLevel: "10", initialStock: "0", barcode: "" };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Add stock
  const [stockModal, setStockModal] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState("100");
  const [stockCost, setStockCost] = useState("");

  // New product
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeLooking, setBarcodeLooking] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // CSV import
  const csvRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  // Global keyboard listener: scanner output goes to barcode field if no other input is focused
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isTypable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (isTypable) return; // user is typing somewhere else
      if (e.key === "Enter") return; // nothing buffered yet
      if (e.key.length !== 1) return; // ignore modifier keys
      // Redirect keystroke to the barcode input
      barcodeRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function load() {
    setLoading(true);
    try { const r = await api("/api/products?limit=100"); setProducts(r.data); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

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
      setMsg(`✓ Added ${stockQty} ${stockModal.unit} of ${stockModal.name}`);
      setStockModal(null); load();
    } catch (e: unknown) { setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/products", {
        method: "POST",
        body: JSON.stringify({
          sku: newForm.sku, name: newForm.name, unit: newForm.unit,
          costPrice: Number(newForm.costPrice), sellPrice: Number(newForm.sellPrice),
          reorderLevel: Number(newForm.reorderLevel),
          ...(newForm.barcode && { barcode: newForm.barcode }),
        }),
      });
      if (Number(newForm.initialStock) > 0) {
        const created = products.find(p => p.sku === newForm.sku) ??
          (await api("/api/products?limit=1&search=" + encodeURIComponent(newForm.name))).data[0];
        if (created?.id) {
          await api("/api/stock/receive", {
            method: "POST",
            body: JSON.stringify({
              items: [{ productId: created.id, warehouseId: "seed-warehouse-main", quantity: Number(newForm.initialStock) }],
              reference: "INITIAL",
            }),
          });
        }
      }
      setMsg(`✓ Product "${newForm.name}" created`);
      setShowNewForm(false); setNewForm(EMPTY_FORM); load();
    } catch (e: unknown) { setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
  }

  async function lookupBarcode(code?: string) {
    const target = (code ?? barcodeInput).trim();
    if (!target) return;
    setBarcodeLooking(true);
    try {
      const r = await api(`/api/products/barcode?code=${encodeURIComponent(target)}`);

      // Scale-printed variable-weight barcode (GS1 prefix 20–29)
      if (r.data?.variableWeight) {
        if (r.data.exists) {
          setMsg(`⚖ ${r.data.name} — ${r.data.weightKg} kg × ₹${r.data.sellPrice}/kg = ₹${r.data.lineTotal}`);
        } else {
          setMsg(`⚖ Scale barcode — PLU ${r.data.pluCode}, weight ${r.data.weightKg} kg. Set up this product with its PLU code first.`);
          setNewForm(f => ({ ...f, unit: "kg", sellByWeight: "true" } as typeof f));
          setShowNewForm(true);
        }
        setBarcodeLooking(false);
        return;
      }

      if (r.data?.exists) {
        setMsg(`ℹ Barcode already in catalog: ${r.data.name}`);
        setBarcodeLooking(false);
        return;
      }
      if (r.data?.name) {
        setNewForm(f => ({ ...f, name: r.data.name, unit: r.data.unit ?? "pcs", barcode: target }));
        setMsg(`✓ Found: ${r.data.name} (${r.data.source})`);
        setShowNewForm(true);
      } else {
        setMsg("Barcode not found — fill in the form manually");
        setNewForm(f => ({ ...f, barcode: target }));
        setShowNewForm(true);
      }
    } catch (e: unknown) { setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBarcodeLooking(false); }
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines[0].toLowerCase().split(",").map(h => h.trim());
      const col = (name: string) => header.indexOf(name);

      const rows = lines.slice(1).map(line => {
        const cells = line.split(",").map(c => c.trim());
        return {
          sku: cells[col("sku")] ?? "",
          name: cells[col("name")] ?? "",
          unit: cells[col("unit")] || "pcs",
          costPrice: parseFloat(cells[col("costprice")] ?? cells[col("cost")] ?? "0"),
          sellPrice: parseFloat(cells[col("sellprice")] ?? cells[col("sell")] ?? "0"),
          reorderLevel: parseInt(cells[col("reorderlevel")] ?? "10") || 10,
          initialStock: parseInt(cells[col("initialstock")] ?? cells[col("stock")] ?? "0") || 0,
        };
      }).filter(r => r.sku && r.name);

      if (rows.length === 0) { setMsg("No valid rows found in CSV"); return; }
      setImporting(true);
      try {
        const r = await api("/api/products/import", { method: "POST", body: JSON.stringify({ products: rows }) });
        setImportResult(r.data);
        setMsg(`✓ Import done: ${r.data.created} created, ${r.data.skipped} skipped`);
        load();
      } catch (err: unknown) { setMsg(`Import error: ${err instanceof Error ? err.message : String(err)}`); }
      finally { setImporting(false); if (csvRef.current) csvRef.current.value = ""; }
    };
    reader.readAsText(file);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <div className="flex gap-2">
          {/* Barcode lookup */}
          <div className="flex gap-1">
            <input ref={barcodeRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupBarcode()}
              placeholder="Scan barcode…" className="border rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <button onClick={lookupBarcode} disabled={barcodeLooking}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {barcodeLooking ? "…" : "🔍"}
            </button>
            <button onClick={() => setShowScanner(true)} title="Scan with camera"
              className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm hover:bg-indigo-200">
              📷
            </button>
          </div>
          {/* CSV import */}
          <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
          <button onClick={() => csvRef.current?.click()} disabled={importing}
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 disabled:opacity-50">
            {importing ? "Importing…" : "Import CSV"}
          </button>
          {/* New product */}
          <button onClick={() => { setShowNewForm(true); setNewForm(EMPTY_FORM); setMsg(""); }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700">
            + New Product
          </button>
        </div>
      </div>

      {/* CSV template hint */}
      <p className="text-xs text-gray-400 mb-3">
        CSV columns: <code className="bg-gray-100 px-1 rounded">sku,name,unit,costPrice,sellPrice,reorderLevel,initialStock</code>
      </p>

      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm whitespace-pre-line">{msg}</div>}
      {importResult && importResult.errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          Import errors: {importResult.errors.join("; ")}
        </div>
      )}

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["SKU","Name","Unit","Cost","Sell Price","Stock",""].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {products.map(p => {
                const totalStock = p.stocks.reduce((sum, s) => sum + s.quantity, 0);
                const isLow = totalStock <= p.reorderLevel;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                    <td className="px-4 py-3">₹{p.costPrice}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">₹{p.sellPrice}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${isLow ? "text-red-600" : "text-gray-900"}`}>
                        {totalStock} {p.unit}
                      </span>
                      {isLow && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Low</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setStockModal(p); setStockQty("100"); setStockCost(String(p.costPrice)); setMsg(""); }}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">
                        + Add Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No products yet. Import a CSV or add manually.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Stock Modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h2 className="font-bold text-gray-900 mb-4">Add Stock — {stockModal.name}</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({stockModal.unit})</label>
            <input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost (₹) <span className="text-gray-400 font-normal">optional</span></label>
            <input type="number" value={stockCost} onChange={e => setStockCost(e.target.value)} placeholder={String(stockModal.costPrice)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <button onClick={addStock} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">Confirm</button>
              <button onClick={() => setStockModal(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="font-bold text-gray-900 mb-4">New Product</h2>
            <form onSubmit={createProduct} className="space-y-3">
              {[
                ["SKU *","text","sku"],["Name *","text","name"],["Unit","text","unit"],
                ["Cost Price (₹) *","number","costPrice"],["Sell Price (₹) *","number","sellPrice"],
                ["Reorder Level","number","reorderLevel"],["Initial Stock","number","initialStock"],
                ["Barcode","text","barcode"],
              ].map(([label, type, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} required={label.includes("*")}
                    value={(newForm as Record<string,string>)[key]}
                    onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700">Create</button>
                <button type="button" onClick={() => setShowNewForm(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner */}
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


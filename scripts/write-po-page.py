content = r'''"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/admin-api";

interface PO { id: string; orderNumber: string; status: string; total: number; itemCount?: number; vendor: { name: string } | null; createdAt: string; }
interface POItem { id: string; productId: string; productName: string; quantity: number; receivedQty: number; unitPrice: number; }
interface Vendor { id: string; name: string; }
interface Product { id: string; name: string; sku: string; unit: string; costPrice: number; }
interface Warehouse { id: string; name: string; }

interface POLine {
  productId: string;   // "__NEW__" = new product to create
  productName: string;
  productSku: string;
  productUnit: string;
  qty: string;
  unitPrice: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  PARTIALLY_RECEIVED: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-600",
};

export default function PurchaseOrdersPage() {
  const [pos, setPOs] = useState<PO[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  // New PO form
  const [showForm, setShowForm] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [lines, setLines] = useState<POLine[]>([]);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Receive modal
  const [receiveModal, setReceiveModal] = useState<{ po: PO; items: POItem[] } | null>(null);
  const [receiveWarehouse, setReceiveWarehouse] = useState("");
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});

  function notify(text: string, type: "ok" | "err" = "ok") { setMsg(text); setMsgType(type); }

  async function load() {
    setLoading(true);
    try {
      const [p, v, pr, wh] = await Promise.all([
        api("/api/purchase-orders?limit=50"),
        api("/api/vendors?limit=100"),
        api("/api/products?limit=500"),
        api("/api/warehouses?limit=50"),
      ]);
      setPOs(p.data);
      setVendors(v.data);
      setProducts(pr.data);
      setWarehouses(wh.data ?? []);
      if (v.data.length > 0) setVendorId(v.data[0].id);
      if (wh.data?.length > 0) setReceiveWarehouse(wh.data[0].id);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live product suggestions as user types
  useEffect(() => {
    if (!search.trim()) { setSuggestions([]); return; }
    const q = search.toLowerCase();
    setSuggestions(products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 8));
  }, [search, products]);

  function addProductLine(product: Product) {
    const existing = lines.findIndex(l => l.productId === product.id);
    if (existing >= 0) {
      // Already in list — just bump qty by 1
      setLines(ls => ls.map((l, i) => i === existing ? { ...l, qty: String(Number(l.qty) + 1) } : l));
    } else {
      setLines(ls => [...ls, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productUnit: product.unit,
        qty: "1",
        unitPrice: String(product.costPrice),
      }]);
    }
    setSearch(""); setSuggestions([]);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function addNewProductLine(name: string) {
    setLines(ls => [...ls, { productId: "__NEW__", productName: name, productSku: "", productUnit: "pcs", qty: "1", unitPrice: "" }]);
    setSearch(""); setSuggestions([]);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  async function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setSearch(""); setSuggestions([]); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = search.trim();
    if (!val) return;

    // Barcode: numeric 8–13 chars
    if (/^\d{8,13}$/.test(val)) {
      try {
        const r = await api(`/api/products/barcode?code=${encodeURIComponent(val)}`);
        if (r.data?.exists && r.data.id) {
          addProductLine({ id: r.data.id, name: r.data.name, sku: r.data.sku ?? val, unit: r.data.unit ?? "pcs", costPrice: r.data.costPrice ?? 0 });
        } else {
          addNewProductLine(r.data?.name || val);
        }
      } catch { addNewProductLine(val); }
      return;
    }

    if (suggestions.length > 0) addProductLine(suggestions[0]);
    else addNewProductLine(val);
  }

  function updateLine(i: number, patch: Partial<POLine>) {
    setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  const poTotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);

  async function createPO(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) { notify("Add at least one product", "err"); return; }
    try {
      const items = lines.map(l => l.productId === "__NEW__"
        ? { productName: l.productName, productSku: l.productSku || undefined, productUnit: l.productUnit || "pcs", quantity: Number(l.qty), unitPrice: Number(l.unitPrice) }
        : { productId: l.productId, productName: l.productName, quantity: Number(l.qty), unitPrice: Number(l.unitPrice) }
      );
      await api("/api/purchase-orders", { method: "POST", body: JSON.stringify({ vendorId, date: new Date().toISOString(), items }) });
      notify("✓ Purchase order created"); setShowForm(false); load();
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  async function actionPO(id: string, endpoint: string, label: string) {
    try {
      await api(`/api/purchase-orders/${id}?action=${endpoint}`, { method: "PATCH", body: JSON.stringify({}) });
      notify(`✓ ${label}`); load();
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  async function openReceiveModal(po: PO) {
    try {
      const detail = await api(`/api/purchase-orders/${po.id}`);
      const items: POItem[] = detail.data.items.filter((i: POItem) => i.quantity - i.receivedQty > 0);
      if (items.length === 0) { notify("All items already received"); return; }
      const qtys: Record<string, string> = {};
      items.forEach(i => { qtys[i.id] = String(i.quantity - i.receivedQty); });
      setReceiveQtys(qtys);
      setReceiveModal({ po, items });
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  async function confirmReceive() {
    if (!receiveModal || !receiveWarehouse) return;
    try {
      const receiveItems = receiveModal.items
        .filter(i => Number(receiveQtys[i.id]) > 0)
        .map(i => ({ orderItemId: i.id, receivedQty: Number(receiveQtys[i.id]) }));
      if (receiveItems.length === 0) { notify("Enter at least one received quantity", "err"); return; }
      await api(`/api/purchase-orders/${receiveModal.po.id}?action=receive`, {
        method: "PATCH",
        body: JSON.stringify({ warehouseId: receiveWarehouse, items: receiveItems }),
      });
      notify("✓ Stock updated · AP invoice created"); setReceiveModal(null); load();
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <button
          onClick={() => { setShowForm(true); setMsg(""); setLines([]); setSearch(""); }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
        >+ New PO</button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm border ${msgType === "err" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
          {msg}
        </div>
      )}

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["PO #", "Vendor", "Amount", "Status", "Date", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {pos.map(po => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-700">{po.orderNumber}</td>
                  <td className="px-4 py-3 font-medium">{po.vendor?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">₹{po.total?.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[po.status] ?? "bg-gray-100"}`}>
                      {po.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(po.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {po.status === "DRAFT" && (
                        <button onClick={() => actionPO(po.id, "submit", "Submitted")} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Submit</button>
                      )}
                      {po.status === "SUBMITTED" && (
                        <button onClick={() => actionPO(po.id, "approve", "Approved")} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Approve</button>
                      )}
                      {(po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED") && (
                        <button onClick={() => openReceiveModal(po)} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">Receive</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No purchase orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New PO Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 my-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">New Purchase Order</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={createPO}>
              {/* Vendor selector */}
              <div className="px-6 py-4 bg-gray-50 border-b">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Vendor *</label>
                <select value={vendorId} onChange={e => setVendorId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              {/* Smart product search / barcode add */}
              <div className="px-6 pt-5 pb-4 border-b">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add Products</label>
                <div className="relative">
                  <div className="flex gap-2">
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      onKeyDown={handleSearchKey}
                      placeholder="📷 Scan barcode  or  🔍 type product name — press Enter to add"
                      autoComplete="off"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <button type="button"
                      onClick={() => { if (suggestions.length > 0) addProductLine(suggestions[0]); else if (search.trim()) addNewProductLine(search.trim()); }}
                      className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700">
                      Add
                    </button>
                  </div>

                  {/* Autocomplete dropdown */}
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-16 bg-white border rounded-lg shadow-xl z-20 mt-1 max-h-52 overflow-y-auto">
                      {suggestions.map(p => (
                        <button key={p.id} type="button" onClick={() => addProductLine(p)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 flex items-center justify-between border-b last:border-0">
                          <div>
                            <span className="font-medium text-gray-900">{p.name}</span>
                            <span className="text-gray-400 text-xs ml-2">{p.sku}</span>
                          </div>
                          <div className="text-xs text-gray-500 shrink-0">{p.unit} · ₹{p.costPrice}</div>
                        </button>
                      ))}
                      <button type="button" onClick={() => addNewProductLine(search.trim())}
                        className="w-full text-left px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 font-medium">
                        + Create new product "{search}"
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Physical barcode scanner: just scan — item auto-adds. Scan same item again to increment qty.
                </p>
              </div>

              {/* Line items table */}
              <div className="px-6 py-4">
                {lines.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed rounded-xl">
                    <div className="text-3xl mb-2">📦</div>
                    No products added yet<br />
                    <span className="text-xs">Scan a barcode or search above to add items</span>
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Name</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Unit</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Quantity</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Cost Price</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Line Total</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lines.map((line, i) => (
                          <tr key={i} className="hover:bg-gray-50 align-top">
                            {/* Product Name */}
                            <td className="px-3 py-2">
                              {line.productId === "__NEW__" ? (
                                <div className="space-y-1">
                                  <input value={line.productName} onChange={e => updateLine(i, { productName: e.target.value })}
                                    placeholder="Product name *" required
                                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                                  <input value={line.productSku} onChange={e => updateLine(i, { productSku: e.target.value })}
                                    placeholder="SKU (optional)"
                                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                                  <span className="text-xs text-indigo-500">✦ Will be created in product catalog</span>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-medium text-gray-900">{line.productName}</div>
                                  <div className="text-xs text-gray-400">{line.productSku}</div>
                                </div>
                              )}
                            </td>
                            {/* Unit */}
                            <td className="px-3 py-2 text-center">
                              {line.productId === "__NEW__" ? (
                                <input value={line.productUnit} onChange={e => updateLine(i, { productUnit: e.target.value })}
                                  placeholder="pcs"
                                  className="w-14 border rounded px-2 py-1.5 text-xs text-center" />
                              ) : (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{line.productUnit}</span>
                              )}
                            </td>
                            {/* Qty */}
                            <td className="px-3 py-2">
                              <input type="number" min="0.001" step="0.001" value={line.qty}
                                onChange={e => updateLine(i, { qty: e.target.value })}
                                className="w-full border rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                            </td>
                            {/* Cost Price */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">₹</span>
                                <input type="number" min="0" step="0.01" value={line.unitPrice}
                                  onChange={e => updateLine(i, { unitPrice: e.target.value })}
                                  required
                                  className="flex-1 border rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                              </div>
                            </td>
                            {/* Line Total */}
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">
                              ₹{((Number(line.qty) || 0) * (Number(line.unitPrice) || 0)).toFixed(2)}
                            </td>
                            {/* Remove */}
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}
                                className="text-red-400 hover:text-red-600 font-bold text-base leading-none">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold text-gray-600">
                            {lines.length} item{lines.length !== 1 ? "s" : ""} · PO Total
                          </td>
                          <td className="px-3 py-3 text-right text-base font-bold text-green-700">₹{poTotal.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              <div className="px-6 pb-6 flex gap-3">
                <button type="submit" disabled={lines.length === 0}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  Create Purchase Order
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Receive Goods Modal ──────────────────────────────────────── */}
      {receiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Receive Goods</h2>
                <p className="text-xs text-gray-500 mt-0.5">{receiveModal.po.orderNumber} · {receiveModal.po.vendor?.name}</p>
              </div>
              <button onClick={() => setReceiveModal(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>

            <div className="px-6 pt-4 pb-3 bg-gray-50 border-b">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Receive Into Warehouse</label>
              <select value={receiveWarehouse} onChange={e => setReceiveWarehouse(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            <div className="px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">Product</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">Ordered</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">Already In</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2 w-28">Receiving Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receiveModal.items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-900">{item.productName}</td>
                      <td className="py-2.5 text-right text-gray-500">{item.quantity}</td>
                      <td className="py-2.5 text-right text-gray-500">{item.receivedQty}</td>
                      <td className="py-2.5 text-right">
                        <input type="number" min="0" step="0.001"
                          max={item.quantity - item.receivedQty}
                          value={receiveQtys[item.id] ?? ""}
                          onChange={e => setReceiveQtys(q => ({ ...q, [item.id]: e.target.value }))}
                          className="w-24 border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-purple-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3">
                Confirming will update stock levels and auto-create a payable invoice in accounting.
              </p>
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button onClick={confirmReceive}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-purple-700">
                Confirm Receipt → Update Stock
              </button>
              <button onClick={() => setReceiveModal(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''

with open(r'C:\Users\anand\erp\apps\gateway\src\app\(admin)\purchase-orders\page.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print('Written', len(content.splitlines()), 'lines')

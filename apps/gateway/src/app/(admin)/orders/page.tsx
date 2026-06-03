"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/admin-api";
import LeadToCashGuide from "@/components/LeadToCashGuide";
import LeadToCashUnderstanding from "@/components/LeadToCashUnderstanding";

const BarcodeScannerModal = dynamic(() => import("@/components/BarcodeScannerModal"), { ssr: false });

interface Order { id: string; orderNumber: string; status: string; total: number; customer: { name: string } | null; createdAt: string; }
interface OrderItem { id: string; productId: string; productName: string; quantity: number; shippedQty: number; unitPrice: number; }
interface Customer { id: string; name: string; phone?: string; email?: string; creditLimit?: number; }
interface Product { id: string; name: string; sku: string; sellPrice: number; unit: string; }
interface Warehouse { id: string; name: string; }

interface SOLine {
  productId: string;
  productName: string;
  productSku: string;
  productUnit: string;
  qty: string;
  unitPrice: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PARTIALLY_SHIPPED: "bg-yellow-100 text-yellow-800",
  SHIPPED: "bg-green-100 text-green-700",
  INVOICED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-600",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  // New SO form
  const [showForm, setShowForm] = useState(false);
  const [saleMode, setSaleMode] = useState<"order" | "quicksale">("quicksale");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [quickSaleWarehouse, setQuickSaleWarehouse] = useState("");
  const [lines, setLines] = useState<SOLine[]>([]);
  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanQty, setScanQty] = useState("1");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [lastAdded, setLastAdded] = useState("");
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const scanQtyRef = useRef<HTMLInputElement>(null);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<Order | null>(null);
  const [confirmWarehouse, setConfirmWarehouse] = useState("");

  // Ship modal
  const [shipModal, setShipModal] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [shipWarehouse, setShipWarehouse] = useState("");
  const [shipQtys, setShipQtys] = useState<Record<string, string>>({});

  function notify(text: string, type: "ok" | "err" = "ok") { setMsg(text); setMsgType(type); }

  async function load() {
    setLoading(true);
    try {
      const [o, c, p, wh] = await Promise.all([
        api("/api/orders?limit=50"),
        api("/api/customers?limit=100"),
        api("/api/products?limit=500"),
        api("/api/warehouses?limit=50"),
      ]);
      setOrders(o.data);
      setCustomers(c.data);
      setProducts(p.data);
      setWarehouses(wh.data ?? []);
      if (c.data.length > 0) setCustomerId(c.data[0].id);
      if (wh.data?.length > 0) { setConfirmWarehouse(wh.data[0].id); setShipWarehouse(wh.data[0].id); setQuickSaleWarehouse(wh.data[0].id); }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!search.trim()) { setSuggestions([]); return; }
    const q = search.toLowerCase();
    setSuggestions(products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 8));
  }, [search, products]);

  useEffect(() => {
    if (!lastAdded) return;
    const t = setTimeout(() => setLastAdded(""), 2500);
    return () => clearTimeout(t);
  }, [lastAdded]);

  function addProductLine(product: Product) {
    const addQty = Math.max(0.001, Number(scanQty) || 1);
    const existing = lines.findIndex(l => l.productId === product.id);
    if (existing >= 0) {
      setLines(ls => ls.map((l, i) => i === existing ? { ...l, qty: String(Number(l.qty) + addQty) } : l));
    } else {
      setLines(ls => [...ls, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productUnit: product.unit,
        qty: String(addQty),
        unitPrice: String(product.sellPrice),
      }]);
    }
    setSearch(""); setBarcodeInput(""); setSuggestions([]);
    setLastAdded(`${product.name}${Number(scanQty) !== 1 ? ` \u00d7${scanQty}` : ""}`);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }

  function addNewProductLine(name: string) {
    const addQty = Math.max(0.001, Number(scanQty) || 1);
    setLines(ls => [...ls, { productId: "__NEW__", productName: name, productSku: "", productUnit: "pcs", qty: String(addQty), unitPrice: "" }]);
    setSearch(""); setBarcodeInput(""); setSuggestions([]);
    setLastAdded(`${name}${Number(scanQty) !== 1 ? ` \u00d7${scanQty}` : ""} (new)`);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }

  async function lookupBarcode(val: string) {
    try {
      const r = await api(`/api/products/barcode?code=${encodeURIComponent(val)}`);
      if (r.data?.exists && r.data.id) {
        addProductLine({ id: r.data.id, name: r.data.name, sku: r.data.sku ?? val, unit: r.data.unit ?? "pcs", sellPrice: r.data.sellPrice ?? 0 });
      } else {
        addNewProductLine(r.data?.name || val);
      }
    } catch { addNewProductLine(val); }
  }

  async function handleBarcodeKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = barcodeInput.trim();
    if (!val) return;
    setBarcodeInput("");
    await lookupBarcode(val);
  }

  async function handleCameraDetected(code: string) {
    setShowCameraScanner(false);
    await lookupBarcode(code);
  }

  async function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setSearch(""); setSuggestions([]); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = search.trim();
    if (!val) return;
    if (suggestions.length > 0) addProductLine(suggestions[0]);
    else addNewProductLine(val);
  }

  function updateLine(i: number, patch: Partial<SOLine>) {
    setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  const soTotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);

  const customerSuggestions = customerSearch.trim()
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone && c.phone.includes(customerSearch)) ||
        (c.email && c.email.toLowerCase().includes(customerSearch.toLowerCase()))
      ).slice(0, 8)
    : customers.slice(0, 8);

  function selectCustomer(c: Customer) {
    setCustomerId(c.id);
    setCustomerSearch(c.phone ? `${c.name} · ${c.phone}` : c.name);
    setShowCustomerDrop(false);
  }

  function selectWalkIn() {
    const walkIn = customers.find(c =>
      c.name.toLowerCase().includes("walk") ||
      c.name.toLowerCase().includes("cash") ||
      c.name.toLowerCase() === "retail" ||
      c.name.toLowerCase() === "counter"
    ) ?? customers.find(c => c.creditLimit === 0) ?? customers[0];
    if (walkIn) { selectCustomer(walkIn); }
    else { notify("Create a \u2018Walk-in Customer\u2019 in Customers first", "err"); setShowCustomerDrop(false); }
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) { notify("Add at least one product", "err"); return; }
    if (!customerId) { notify("Select a customer first", "err"); return; }
    if (lines.some((l) => l.productId === "__NEW__")) {
      notify("Some lines are new/unknown products. Please create/select valid products first.", "err");
      return;
    }
    if (saleMode === "quicksale") { await completeSale(); return; }
    try {
      const items = lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        quantity: Number(l.qty),
        unitPrice: Number(l.unitPrice),
      }));
      await api("/api/orders", { method: "POST", body: JSON.stringify({ customerId, date: new Date().toISOString(), paymentMethod: "COD", items }) });
      notify("\u2713 Sales order created"); setShowForm(false); load();
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  async function completeSale() {
    if (!quickSaleWarehouse) { notify("Select a warehouse first", "err"); return; }
    if (!customerId) { notify("Select a customer first", "err"); return; }
    if (lines.some((l) => l.productId === "__NEW__")) {
      notify("Some lines are new/unknown products. Please create/select valid products first.", "err");
      return;
    }
    try {
      notify("Processing sale\u2026");
      // Step 1 — create DRAFT order
      const items = lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        quantity: Number(l.qty),
        unitPrice: Number(l.unitPrice),
      }));
      const created = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ customerId, date: new Date().toISOString(), paymentMethod: "COD", items }),
      });
      const orderId: string = created.data.id;
      // Step 2 — confirm (reserves stock)
      await api(`/api/orders/${orderId}?action=confirm`, {
        method: "PATCH",
        body: JSON.stringify({ warehouseId: quickSaleWarehouse }),
      });
      // Step 3 — ship all items
      const detail = await api(`/api/orders/${orderId}`);
      const shipItems = detail.data.items.map((i: OrderItem) => ({ orderItemId: i.id, shippedQty: i.quantity }));
      await api(`/api/orders/${orderId}?action=ship`, {
        method: "PATCH",
        body: JSON.stringify({ warehouseId: quickSaleWarehouse, items: shipItems }),
      });
      // Step 4 — invoice
      await api(`/api/orders/${orderId}?action=invoice`, { method: "PATCH", body: JSON.stringify({}) });
      notify(`\u2713 Sale complete \u2014 ${lines.length} item${lines.length !== 1 ? "s" : ""} \u00b7 \u20b9${soTotal.toFixed(2)} collected`);
      setShowForm(false); load();
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  async function doConfirm() {
    if (!confirmModal) return;
    try {
      await api(`/api/orders/${confirmModal.id}?action=confirm`, { method: "PATCH", body: JSON.stringify({ warehouseId: confirmWarehouse }) });
      notify("✓ Order confirmed — stock reserved"); setConfirmModal(null); load();
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  async function openShipModal(order: Order) {
    try {
      const detail = await api(`/api/orders/${order.id}`);
      const items: OrderItem[] = detail.data.items.filter((i: OrderItem) => i.quantity - i.shippedQty > 0);
      if (items.length === 0) { notify("All items already shipped"); return; }
      const qtys: Record<string, string> = {};
      items.forEach(i => { qtys[i.id] = String(i.quantity - i.shippedQty); });
      setShipQtys(qtys);
      setShipModal({ order, items });
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  async function doShip() {
    if (!shipModal || !shipWarehouse) return;
    try {
      const shipItems = shipModal.items
        .filter(i => Number(shipQtys[i.id]) > 0)
        .map(i => ({ orderItemId: i.id, shippedQty: Number(shipQtys[i.id]) }));
      if (shipItems.length === 0) { notify("Enter at least one quantity to ship", "err"); return; }
      await api(`/api/orders/${shipModal.order.id}?action=ship`, {
        method: "PATCH",
        body: JSON.stringify({ warehouseId: shipWarehouse, items: shipItems }),
      });
      notify("✓ Items shipped · AR invoice created"); setShipModal(null); load();
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  async function actionOrder(id: string, action: string, label: string) {
    try {
      await api(`/api/orders/${id}?action=${action}`, { method: "PATCH", body: JSON.stringify({}) });
      notify(`✓ ${label}`); load();
    } catch (err: unknown) { notify(`Error: ${err instanceof Error ? err.message : String(err)}`, "err"); }
  }

  return (
    <div className="p-8">
      <LeadToCashGuide current="orders" />
      <LeadToCashUnderstanding current="orders" />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
        <button
          onClick={() => { setShowForm(true); setMsg(""); setLines([]); setSearch(""); setBarcodeInput(""); setScanQty("1"); setCustomerSearch(""); setShowCustomerDrop(false); setTimeout(() => barcodeRef.current?.focus(), 150); }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
        >+ New Order</button>
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
                {["Order #", "Customer", "Amount", "Status", "Date", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-700">{o.orderNumber}</td>
                  <td className="px-4 py-3 font-medium">{o.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">&#8377;{o.total?.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-gray-100"}`}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {o.status === "DRAFT" && (
                        <button onClick={() => setConfirmModal(o)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Confirm</button>
                      )}
                      {(o.status === "CONFIRMED" || o.status === "PARTIALLY_SHIPPED") && (
                        <button onClick={() => openShipModal(o)} className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600">Ship</button>
                      )}
                      {o.status === "SHIPPED" && (
                        <button onClick={() => actionOrder(o.id, "invoice", "Invoice created")} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">Invoice</button>
                      )}
                      {o.status === "DRAFT" && (
                        <button onClick={() => actionOrder(o.id, "cancel", "Order cancelled")} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New Sales Order Modal ─────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 my-auto">

            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">New Sales Order</h2>
                <p className="text-xs text-gray-400 mt-0.5">Quick Sale = scan &amp; done in one click &middot; B2B Order = confirm &amp; ship separately</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>

            {/* Mode toggle */}
            <div className="px-6 py-3 bg-gray-50 border-b flex gap-2">
              <button type="button"
                onClick={() => setSaleMode("quicksale")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  saleMode === "quicksale"
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                }`}>
                &#9889; Quick Sale
                <span className="block text-xs font-normal opacity-80">Scan &rarr; Pay &rarr; Done</span>
              </button>
              <button type="button"
                onClick={() => setSaleMode("order")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  saleMode === "order"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}>
                &#128203; B2B Order
                <span className="block text-xs font-normal opacity-80">Confirm &rarr; Ship &rarr; Invoice</span>
              </button>
            </div>

            <form onSubmit={createOrder}>
              {/* Customer + Quick Sale warehouse */}
              <div className="px-6 py-4 bg-gray-50 border-b flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {saleMode === "quicksale" ? "Customer (phone / name)" : "Customer *"}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setCustomerId(""); setShowCustomerDrop(true); }}
                      onFocus={() => setShowCustomerDrop(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDrop(false), 160)}
                      placeholder={saleMode === "quicksale" ? "Type phone or name\u2026" : "Search customer\u2026"}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {showCustomerDrop && (
                      <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-auto">
                        {saleMode === "quicksale" && (
                          <button type="button" onMouseDown={e => { e.preventDefault(); selectWalkIn(); }}
                            className="w-full px-3 py-2.5 text-left text-sm hover:bg-orange-50 border-b flex items-center gap-2">
                            <span className="text-lg">&#128100;</span>
                            <div>
                              <div className="font-semibold text-orange-700">Walk-in / Cash</div>
                              <div className="text-xs text-gray-400">anonymous retail customer</div>
                            </div>
                          </button>
                        )}
                        {customerSuggestions.map(c => (
                          <button key={c.id} type="button" onMouseDown={e => { e.preventDefault(); selectCustomer(c); }}
                            className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 border-b last:border-0">
                            <div className="font-medium text-gray-800">{c.name}</div>
                            {(c.phone || c.email) && (
                              <div className="text-xs text-gray-400">{c.phone ?? c.email}</div>
                            )}
                          </button>
                        ))}
                        {customerSuggestions.length === 0 && (
                          <div className="px-3 py-2.5 text-xs text-gray-400">No customers match &ldquo;{customerSearch}&rdquo;</div>
                        )}
                      </div>
                    )}
                  </div>
                  {customerId && !showCustomerDrop && (
                    <p className="text-xs text-green-600 mt-1">&#10003; {customers.find(c => c.id === customerId)?.name}</p>
                  )}
                  {!customerId && saleMode === "quicksale" && !showCustomerDrop && (
                    <p className="text-xs text-gray-400 mt-1">Leave blank or pick Walk-in for cash sales</p>
                  )}
                </div>
                {saleMode === "quicksale" && (
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ship From Warehouse *</label>
                    <select value={quickSaleWarehouse} onChange={e => setQuickSaleWarehouse(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Stock deducted instantly on sale</p>
                  </div>
                )}
              </div>

              {/* Add Products */}
              <div className="px-6 pt-5 pb-5 border-b">
                {/* Batch Qty */}
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch Qty</span>
                  <div className="flex items-center border rounded-lg overflow-hidden bg-white shadow-sm">
                    <button type="button" onClick={() => setScanQty(q => String(Math.max(1, Number(q) - 1)))}
                      className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 text-base leading-none border-r">&minus;</button>
                    <input ref={scanQtyRef} type="number" min="0.001" step="1" value={scanQty}
                      onChange={e => setScanQty(e.target.value)} onFocus={e => e.target.select()}
                      className="w-14 py-1.5 text-sm text-center focus:outline-none" />
                    <button type="button" onClick={() => setScanQty(q => String(Number(q) + 1))}
                      className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 text-base leading-none border-l">+</button>
                  </div>
                  <span className="text-xs text-gray-400">units per scan / add</span>
                  {lastAdded && (
                    <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                      &#10003; Added: {lastAdded}
                    </span>
                  )}
                </div>

                {/* Barcode scanner zone */}
                <div className="mb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h1M4 10h1M4 14h1M4 18h1M8 4v16M12 4v16M15 6h1M15 10h1M15 14h1M15 18h1M19 4v16" />
                    </svg>
                    Scan Barcode
                  </p>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 focus-within:border-green-400 focus-within:bg-green-50/30 transition-colors group">
                    <div className="flex items-center gap-[2px] shrink-0 opacity-25 group-focus-within:opacity-60 transition-opacity" aria-hidden>
                      {([3,1,2,1,3,1,2,3,1,2,1,3,2,1] as number[]).map((w, i) => (
                        <div key={i} style={{width: `${w}px`}} className={`bg-gray-700 rounded-[1px] ${i % 2 === 0 ? "h-8" : "h-5"}`} />
                      ))}
                    </div>
                    <input
                      ref={barcodeRef}
                      value={barcodeInput}
                      onChange={e => setBarcodeInput(e.target.value)}
                      onKeyDown={handleBarcodeKey}
                      placeholder="Point scanner here and scan — or type barcode + Enter"
                      autoComplete="off"
                      className="flex-1 text-sm font-mono tracking-widest bg-transparent focus:outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400"
                    />
                    {barcodeInput && (
                      <button type="button" onClick={() => { setBarcodeInput(""); barcodeRef.current?.focus(); }}
                        className="text-gray-400 hover:text-red-400 text-xl leading-none shrink-0">&times;</button>
                    )}
                    <button type="button" onClick={() => setShowCameraScanner(true)}
                      title="Scan with laptop camera"
                      className="shrink-0 flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                      Camera
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Physical scanner auto-submits on scan. Same item scanned again increments qty.</p>
                </div>

                {/* OR divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 px-1">or search by name</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Text search */}
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">&#128269;</span>
                      <input
                        ref={searchRef}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={handleSearchKey}
                        placeholder="Type product name or SKU..."
                        autoComplete="off"
                        className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                    <button type="button"
                      onClick={() => { if (suggestions.length > 0) addProductLine(suggestions[0]); else if (search.trim()) addNewProductLine(search.trim()); }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 shrink-0">
                      {Number(scanQty) !== 1 ? `Add \u00d7${scanQty}` : "Add"}
                    </button>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-20 bg-white border rounded-xl shadow-xl z-20 mt-1 max-h-52 overflow-y-auto">
                      {suggestions.map(p => (
                        <button key={p.id} type="button" onClick={() => addProductLine(p)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 flex items-center justify-between border-b last:border-0">
                          <div>
                            <span className="font-medium text-gray-900">{p.name}</span>
                            <span className="text-gray-400 text-xs ml-2">{p.sku}</span>
                          </div>
                          <div className="text-xs text-gray-500 shrink-0">{p.unit} &middot; &#8377;{p.sellPrice}</div>
                        </button>
                      ))}
                      <button type="button" onClick={() => addNewProductLine(search.trim())}
                        className="w-full text-left px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 font-medium">
                        + Create new product &ldquo;{search}&rdquo;
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Line items table */}
              <div className="px-6 py-4">
                {lines.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed rounded-xl">
                    <div className="text-3xl mb-2">&#128722;</div>
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
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Sell Price</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Line Total</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lines.map((line, i) => (
                          <tr key={i} className="hover:bg-gray-50 align-top">
                            <td className="px-3 py-2">
                              {line.productId === "__NEW__" ? (
                                <div className="space-y-1">
                                  <input value={line.productName} onChange={e => updateLine(i, { productName: e.target.value })}
                                    placeholder="Product name *" required
                                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                                  <input value={line.productSku} onChange={e => updateLine(i, { productSku: e.target.value })}
                                    placeholder="SKU (optional)"
                                    className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                                  <span className="text-xs text-indigo-500">&#10022; Will be created in product catalog</span>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-medium text-gray-900">{line.productName}</div>
                                  <div className="text-xs text-gray-400">{line.productSku}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {line.productId === "__NEW__" ? (
                                <input value={line.productUnit} onChange={e => updateLine(i, { productUnit: e.target.value })}
                                  placeholder="pcs"
                                  className="w-14 border rounded px-2 py-1.5 text-xs text-center" />
                              ) : (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{line.productUnit}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0.001" step="0.001" value={line.qty}
                                onChange={e => updateLine(i, { qty: e.target.value })}
                                className="w-full border rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">&#8377;</span>
                                <input type="number" min="0" step="0.01" value={line.unitPrice}
                                  onChange={e => updateLine(i, { unitPrice: e.target.value })}
                                  required
                                  className="flex-1 border rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">
                              &#8377;{((Number(line.qty) || 0) * (Number(line.unitPrice) || 0)).toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}
                                className="text-red-400 hover:text-red-600 font-bold text-base leading-none">&times;</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold text-gray-600">
                            {lines.length} item{lines.length !== 1 ? "s" : ""} &middot; Order Total
                          </td>
                          <td className="px-3 py-3 text-right text-base font-bold text-green-700">&#8377;{soTotal.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 flex gap-3">
                {saleMode === "quicksale" ? (
                  <button type="submit" disabled={lines.length === 0}
                    className="flex-1 bg-orange-500 text-white py-3 rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    <span>&#9889;</span>
                    Complete Sale &mdash; &#8377;{soTotal.toFixed(2)}
                    <span className="text-xs font-normal opacity-80">(confirms + ships + invoices)</span>
                  </button>
                ) : (
                  <button type="submit" disabled={lines.length === 0}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    Create Sales Order
                  </button>
                )}
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Order Modal ───────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Confirm Order</h2>
                <p className="text-xs text-gray-500 mt-0.5">{confirmModal.orderNumber} &middot; {confirmModal.customer?.name}</p>
              </div>
              <button onClick={() => setConfirmModal(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reserve Stock From</label>
              <select value={confirmWarehouse} onChange={e => setConfirmWarehouse(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-2">Confirms the order, checks credit limit, and reserves stock in the selected warehouse.</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={doConfirm}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700">
                Confirm &rarr; Reserve Stock
              </button>
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ship Items Modal ──────────────────────────────────────────── */}
      {shipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Ship Items</h2>
                <p className="text-xs text-gray-500 mt-0.5">{shipModal.order.orderNumber} &middot; {shipModal.order.customer?.name}</p>
              </div>
              <button onClick={() => setShipModal(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="px-6 pt-4 pb-3 bg-gray-50 border-b">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ship From Warehouse</label>
              <select value={shipWarehouse} onChange={e => setShipWarehouse(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">Product</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">Ordered</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">Shipped</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2 w-28">Shipping Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shipModal.items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-900">{item.productName}</td>
                      <td className="py-2.5 text-right text-gray-500">{item.quantity}</td>
                      <td className="py-2.5 text-right text-gray-500">{item.shippedQty}</td>
                      <td className="py-2.5 text-right">
                        <input type="number" min="0" step="0.001"
                          max={item.quantity - item.shippedQty}
                          value={shipQtys[item.id] ?? ""}
                          onChange={e => setShipQtys(q => ({ ...q, [item.id]: e.target.value }))}
                          className="w-24 border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3">Confirming will deduct reserved stock and create an AR invoice in accounting.</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={doShip}
                className="flex-1 bg-yellow-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-yellow-600">
                Confirm Shipment &rarr; Deduct Stock
              </button>
              <button onClick={() => setShipModal(null)}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCameraScanner && (
        <BarcodeScannerModal
          onDetected={handleCameraDetected}
          onClose={() => { setShowCameraScanner(false); setTimeout(() => barcodeRef.current?.focus(), 100); }}
        />
      )}
    </div>
  );
}

"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, getUserId } from "@/lib/api-client";

interface Product { id: string; name: string; sku: string; barcode?: string; sellPrice: number; unit?: string; sellByWeight?: boolean; taxCode?: string | null; taxRate?: number | null }
interface BillLine { productId: string; name: string; sku: string; qty: number; unitPrice: number; taxRate: number; taxCode?: string; unit?: string; sellByWeight?: boolean }
interface Shift { id: string; status: string }
interface Bill { id: string; billNumber: string; total: number }
interface Warehouse { id: string; name: string }

export default function BillingPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [lines, setLines] = useState<BillLine[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "UPI" | "WALLET">("CASH");
  const [cashGiven, setCashGiven] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // Load open shift
  useEffect(() => {
    async function loadContext() {
      const userId = getUserId();
      if (!userId) {
        setBootLoading(false);
        return;
      }

      await Promise.allSettled([
        api<{ data: Shift[] }>("accounting", `/api/shifts?status=OPEN&cashierId=${userId}&limit=1`).then((r) => {
          if (!r.error && r.data.data.length > 0) setShift(r.data.data[0]);
        }),
        api<{ data: Warehouse[] }>("inventory", "/api/warehouses?limit=50").then((r) => {
          if (!r.error) {
            setWarehouses(r.data.data);
            if (r.data.data.length > 0) setWarehouseId(r.data.data[0].id);
          }
        }),
      ]);

      setBootLoading(false);
      searchRef.current?.focus();
    }

    loadContext();
  }, []);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const barcodeRes = await api<{ data: Product[] }>("inventory", `/api/products?barcode=${encodeURIComponent(q)}&limit=1`);
    if (!barcodeRes.error && barcodeRes.data.data.length > 0) {
      setResults(barcodeRes.data.data);
      return;
    }
    const res = await api<{ data: Product[] }>("inventory", `/api/products?search=${encodeURIComponent(q)}&limit=8`);
    if (!res.error) setResults(res.data.data);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(search), 200);
    return () => clearTimeout(t);
  }, [search, searchProducts]);

  useEffect(() => {
    setIsReady(true);
  }, []);

  function addLine(product: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      const defaultQty = product.sellByWeight ? 0.5 : 1;
      if (existing) return prev.map((l) => l.productId === product.id ? { ...l, qty: Number((l.qty + defaultQty).toFixed(3)) } : l);
      return [...prev, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        qty: defaultQty,
        unitPrice: product.sellPrice,
        taxRate: Number(product.taxRate ?? 0),
        taxCode: product.taxCode ?? undefined,
        unit: product.unit,
        sellByWeight: product.sellByWeight,
      }];
    });
    setSearch("");
    setResults([]);
    searchRef.current?.focus();
  }

  function updateLineQty(productId: string, qty: number) {
    if (qty <= 0) { setLines((prev) => prev.filter((l) => l.productId !== productId)); return; }
    setLines((prev) => prev.map((l) => l.productId === productId ? { ...l, qty: Number(qty.toFixed(3)) } : l));
  }

  function normalizeRate(rate: number) {
    if (Number.isNaN(rate) || rate <= 0) return 0;
    return rate > 1 ? rate / 100 : rate;
  }

  function lineTax(line: BillLine) {
    return line.unitPrice * line.qty * normalizeRate(line.taxRate);
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const tax = lines.reduce((s, l) => s + lineTax(l), 0);
  const total = subtotal + tax;
  const change = parseFloat(cashGiven || "0") - total;

  function formatINR(value: number) {
    return `₹${Number(value).toLocaleString("en-IN")}`;
  }

  async function completeBill(hold = false) {
    if (lines.length === 0) return;
    if (!shift) { setError("No open shift. Open a shift first."); return; }
    if (!warehouseId) { setError("Select a warehouse before billing."); return; }
    if (!hold && paymentMethod === "CASH" && parseFloat(cashGiven || "0") < total) { setError("Cash given is less than bill total."); return; }
    setPlacing(true); setError("");

    const body = {
      shiftId: shift?.id,
      warehouseId,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentMethod,
      status: hold ? "HELD" : "COMPLETED",
      items: lines.map((l) => ({
        productId: l.productId,
        productName: l.name,
        sku: l.sku,
        quantity: l.qty,
        unitPrice: l.unitPrice,
        discount: 0,
        taxCode: l.taxCode,
        taxRate: l.taxRate,
      })),
    };

    const res = await api<{ data: Bill }>("accounting", "/api/bills", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setPlacing(false);
    if (res.error) { setError(res.error); return; }
    setLastBill(res.data.data);
    setLines([]);
    setShowPayment(false);
    setCashGiven("");
    setCustomerName("");
    setCustomerPhone("");
  }

  return (
    <div className={`relative h-full p-3 transition-all duration-500 sm:p-4 ${isReady ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-500/10 via-emerald-500/5 to-transparent" />
      <div className="relative mb-3 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-white">Billing Counter</h1>
          <p className="text-xs text-slate-400">Scan fast, charge confidently, and hold when needed.</p>
        </div>
        <div className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
          {shift ? "Shift Open" : "No Active Shift"}
        </div>
      </div>

      <div className="flex h-[calc(100%-4.25rem)] gap-3">
      {/* Left: product search + cart */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/75">
        {/* Search bar */}
        <div className="border-b border-slate-700 bg-slate-800/90 p-3">
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product by name or scan barcode…"
            className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-emerald-500 placeholder:text-slate-500" />
        </div>

        {/* Search results dropdown */}
        {results.length > 0 && (
          <div className="max-h-52 divide-y divide-slate-700 overflow-y-auto border-b border-slate-700 bg-slate-800/95">
            {results.map((p) => (
              <button key={p.id} onClick={() => addLine(p)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-all duration-200 ease-out hover:bg-slate-700">
                <div>
                  <div className="text-sm font-medium text-white">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.sku}{p.unit ? ` · ${p.unit}` : ""}</div>
                </div>
                <div className="text-sm font-semibold text-emerald-400">{formatINR(p.sellPrice)}</div>
              </button>
            ))}
          </div>
        )}

        {/* Bill lines */}
        <div className="flex-1 overflow-y-auto">
          {bootLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="w-full">
                      <div className="pos-skeleton h-3 w-2/3 rounded" />
                      <div className="pos-skeleton mt-2 h-2 w-1/3 rounded" />
                    </div>
                    <div className="pos-skeleton h-3 w-16 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <div className="text-5xl mb-3">🧾</div>
              <div className="text-sm">Search and add products</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-900/40">
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-4 py-2">Item</th>
                  <th className="px-2 py-2 text-center w-28">Qty</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {lines.map((line, idx) => (
                  <tr
                    key={line.productId}
                    style={{ transitionDelay: `${idx * 25}ms` }}
                    className={`hover:bg-slate-700/20 transition-all duration-200 ease-out ${isReady ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-white">{line.name}</div>
                      <div className="text-xs text-slate-500">
                        {line.sku}{line.unit ? ` · ${line.unit}` : ""}
                        {line.taxCode ? ` · ${line.taxCode}` : ""}
                        {` · Tax ${(normalizeRate(line.taxRate) * 100).toFixed(2)}%`}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateLineQty(line.productId, line.qty - (line.sellByWeight ? 0.25 : 1))}
                          className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-white transition-all duration-200 ease-out hover:bg-slate-600 active:scale-[0.98]">−</button>
                        <input
                          type="number"
                          min={line.sellByWeight ? "0.25" : "1"}
                          step={line.sellByWeight ? "0.25" : "1"}
                          value={line.qty}
                          onChange={(e) => updateLineQty(line.productId, Number(e.target.value) || 0)}
                          className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center text-sm font-semibold text-white outline-none"
                        />
                        <button onClick={() => updateLineQty(line.productId, line.qty + (line.sellByWeight ? 0.25 : 1))}
                          className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-white transition-all duration-200 ease-out hover:bg-slate-600 active:scale-[0.98]">+</button>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-slate-300">{formatINR(line.unitPrice)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-white">{formatINR(line.unitPrice * line.qty)}</td>
                    <td className="pr-2 py-2.5">
                      <button onClick={() => updateLineQty(line.productId, 0)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right: totals + payment */}
      <div className="flex w-80 shrink-0 flex-col rounded-2xl border border-slate-700 bg-slate-800/85">
        {/* Bill summary */}
        <div className="flex-1 p-4 space-y-3">
          {lastBill && (
            <div className="rounded-xl border border-emerald-700 bg-emerald-900/40 px-3 py-2.5 text-sm text-emerald-300">
              ✓ Bill {lastBill.billNumber} — {formatINR(lastBill.total)}
            </div>
          )}
          {error && <div className="rounded-xl border border-red-700 bg-red-900/40 px-3 py-2 text-xs text-red-300">{error}</div>}

          <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
            <div className="text-xs font-medium text-slate-400">Billing Context</div>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-emerald-500"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Customer phone (optional)"
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-emerald-500"
            />
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            <div className="flex justify-between text-slate-400"><span>Tax</span><span>₹{tax.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-2 text-lg font-bold text-white">
              <span>Total</span><span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <div className="mb-2 text-xs font-medium text-slate-400">Payment Method</div>
            <div className="grid grid-cols-2 gap-2">
              {(["CASH", "CARD", "UPI", "WALLET"] as const).map((m) => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={`rounded-xl border py-2 text-xs font-semibold transition-all duration-200 ease-out active:scale-[0.98]
                    ${paymentMethod === m ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500"}`}>
                  {m === "CASH" ? "💵 Cash" : m === "CARD" ? "💳 Card" : m === "UPI" ? "📱 UPI" : "👛 Wallet"}
                </button>
              ))}
            </div>
          </div>

          {/* Cash change calculator */}
          {paymentMethod === "CASH" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Cash Given (₹)</label>
              <input type="number" min="0" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-emerald-500" />
              {cashGiven && (
                <div className={`mt-1.5 text-sm font-semibold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {change >= 0 ? `Change: ₹${change.toFixed(2)}` : `Short by ₹${Math.abs(change).toFixed(2)}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-2 border-t border-slate-700 p-3">
          <button onClick={() => completeBill(false)} disabled={placing || lines.length === 0}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition-all duration-200 ease-out hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40">
            {placing ? "Processing…" : `Charge ₹${total.toFixed(2)}`}
          </button>
          <div className="flex gap-2">
            <button onClick={() => completeBill(true)} disabled={placing || lines.length === 0}
              className="flex-1 rounded-xl border border-slate-600 py-2 text-xs font-medium text-slate-300 transition-all duration-200 ease-out hover:bg-slate-700 active:scale-[0.98] disabled:opacity-40">
              ⏸ Hold
            </button>
            <button onClick={() => { setLines([]); setError(""); setLastBill(null); }}
              className="flex-1 rounded-xl border border-slate-600 py-2 text-xs font-medium text-slate-300 transition-all duration-200 ease-out hover:bg-slate-700 active:scale-[0.98]">
              🗑 Clear
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

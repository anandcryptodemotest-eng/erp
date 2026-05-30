"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, getUserId } from "@/lib/api-client";

interface Product { id: string; name: string; sku: string; barcode?: string; sellingPrice: number; unit?: string }
interface BillLine { productId: string; name: string; sku: string; qty: number; unitPrice: number; taxRate: number }
interface Shift { id: string; status: string }
interface Bill { id: string; billNumber: string; total: number }

const TAX_RATE = 0.05;

export default function BillingPage() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [lines, setLines] = useState<BillLine[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "UPI" | "WALLET">("CASH");
  const [cashGiven, setCashGiven] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [lastBill, setLastBill] = useState<Bill | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // Load open shift
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    api<{ data: Shift[] }>("accounting", `/api/shifts?status=OPEN&cashierId=${userId}&limit=1`).then((r) => {
      if (!r.error && r.data.data.length > 0) setShift(r.data.data[0]);
    });
    // Auto-focus search
    searchRef.current?.focus();
  }, []);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const res = await api<{ data: Product[] }>("inventory", `/api/products?search=${encodeURIComponent(q)}&limit=8&isActive=true`);
    if (!res.error) setResults(res.data.data);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(search), 200);
    return () => clearTimeout(t);
  }, [search, searchProducts]);

  function addLine(product: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) return prev.map((l) => l.productId === product.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { productId: product.id, name: product.name, sku: product.sku, qty: 1, unitPrice: product.sellingPrice, taxRate: TAX_RATE }];
    });
    setSearch("");
    setResults([]);
    searchRef.current?.focus();
  }

  function updateLineQty(productId: string, qty: number) {
    if (qty <= 0) { setLines((prev) => prev.filter((l) => l.productId !== productId)); return; }
    setLines((prev) => prev.map((l) => l.productId === productId ? { ...l, qty } : l));
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const change = parseFloat(cashGiven || "0") - total;

  async function completeBill(hold = false) {
    if (lines.length === 0) return;
    if (!hold && !shift) { setError("No open shift. Open a shift first."); return; }
    setPlacing(true); setError("");

    const body = {
      shiftId: shift?.id,
      paymentMethod,
      status: hold ? "HELD" : "COMPLETED",
      items: lines.map((l) => ({ productId: l.productId, name: l.name, sku: l.sku, qty: l.qty, unitPrice: l.unitPrice, taxRate: l.taxRate })),
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
  }

  return (
    <div className="flex h-full gap-0">
      {/* Left: product search + cart */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Search bar */}
        <div className="border-b border-slate-700 bg-slate-800 p-3">
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product by name or scan barcode…"
            className="w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500 placeholder:text-slate-500" />
        </div>

        {/* Search results dropdown */}
        {results.length > 0 && (
          <div className="border-b border-slate-700 bg-slate-800 divide-y divide-slate-700 max-h-52 overflow-y-auto">
            {results.map((p) => (
              <button key={p.id} onClick={() => addLine(p)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-700 transition-colors">
                <div>
                  <div className="text-sm font-medium text-white">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.sku}{p.unit ? ` · ${p.unit}` : ""}</div>
                </div>
                <div className="text-sm font-semibold text-emerald-400">₹{Number(p.sellingPrice).toLocaleString("en-IN")}</div>
              </button>
            ))}
          </div>
        )}

        {/* Bill lines */}
        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <div className="text-5xl mb-3">🧾</div>
              <div className="text-sm">Search and add products</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/50">
                <tr className="text-left text-xs text-slate-400">
                  <th className="px-4 py-2">Item</th>
                  <th className="px-2 py-2 text-center w-28">Qty</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {lines.map((line) => (
                  <tr key={line.productId} className="hover:bg-slate-800/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-white">{line.name}</div>
                      <div className="text-xs text-slate-500">{line.sku}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateLineQty(line.productId, line.qty - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-600">−</button>
                        <span className="w-8 text-center text-sm font-semibold">{line.qty}</span>
                        <button onClick={() => updateLineQty(line.productId, line.qty + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-600">+</button>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right text-slate-300">₹{Number(line.unitPrice).toLocaleString("en-IN")}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-white">₹{(line.unitPrice * line.qty).toLocaleString("en-IN")}</td>
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
      <div className="flex w-72 flex-col border-l border-slate-700 bg-slate-800">
        {/* Bill summary */}
        <div className="flex-1 p-4 space-y-3">
          {lastBill && (
            <div className="rounded-xl bg-emerald-900/40 border border-emerald-700 px-3 py-2.5 text-sm text-emerald-300">
              ✓ Bill {lastBill.billNumber} — ₹{Number(lastBill.total).toLocaleString("en-IN")}
            </div>
          )}
          {error && <div className="rounded-xl bg-red-900/40 border border-red-700 px-3 py-2 text-xs text-red-300">{error}</div>}

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between text-slate-400"><span>Tax (5%)</span><span>₹{tax.toFixed(2)}</span></div>
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
                  className={`rounded-xl border py-2 text-xs font-semibold transition-colors
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
                className="w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-white text-sm outline-none focus:border-emerald-500" />
              {cashGiven && (
                <div className={`mt-1.5 text-sm font-semibold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {change >= 0 ? `Change: ₹${change.toFixed(2)}` : `Short by ₹${Math.abs(change).toFixed(2)}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="border-t border-slate-700 p-3 space-y-2">
          <button onClick={() => completeBill(false)} disabled={placing || lines.length === 0}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40">
            {placing ? "Processing…" : `Charge ₹${total.toFixed(2)}`}
          </button>
          <div className="flex gap-2">
            <button onClick={() => completeBill(true)} disabled={placing || lines.length === 0}
              className="flex-1 rounded-xl border border-slate-600 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40">
              ⏸ Hold
            </button>
            <button onClick={() => { setLines([]); setError(""); setLastBill(null); }}
              className="flex-1 rounded-xl border border-slate-600 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700">
              🗑 Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

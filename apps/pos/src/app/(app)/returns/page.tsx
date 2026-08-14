"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface BillItem { id: string; productId: string; variantId?: string | null; productName: string; sku?: string; quantity: number; unitPrice: number; taxCode?: string | null; taxRate?: number }
interface Bill { id: string; billNumber: string; total: number; items: BillItem[]; status: string }
interface Warehouse { id: string; name: string }
type RefundMethod = "CASH" | "UPI" | "WALLET";

export default function ReturnsPage() {
  const [isReady, setIsReady] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [billNumber, setBillNumber] = useState("");
  const [bill, setBill] = useState<Bill | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Return quantities per item
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ data: Warehouse[] }>("inventory", "/api/warehouses?limit=50").then((res) => {
      if (!res.error && res.data) {
        setWarehouses(res.data.data);
        if (res.data.data.length > 0) setWarehouseId(res.data.data[0].id);
      }
      setLoadingContext(false);
    });
  }, []);

  useEffect(() => {
    setIsReady(true);
  }, []);

  async function searchBill() {
    if (!billNumber.trim()) return;
    setSearching(true); setSearchError(""); setBill(null); setReturnQtys({});
    const res = await api<{ data: Bill[] }>("accounting", `/api/bills?billNumber=${encodeURIComponent(billNumber.trim())}&limit=1`);
    setSearching(false);
    if (res.error || !res.data || res.data.data.length === 0) {
      setSearchError("Bill not found"); return;
    }
    const found = res.data.data[0];
    // Fetch full detail with items
    const detail = await api<{ data: Bill }>("accounting", `/api/bills/${found.id}`);
    if (detail.error || !detail.data) { setSearchError(detail.error ?? "Bill details unavailable"); return; }
    setBill(detail.data.data);
    const initial: Record<string, number> = {};
    detail.data.data.items.forEach((i) => { initial[i.id] = 0; });
    setReturnQtys(initial);
  }

  async function processReturn() {
    if (!bill) return;
    if (!warehouseId) { setError("Select a warehouse for stock restoration"); return; }
    const items = bill.items
      .filter((i) => (returnQtys[i.id] ?? 0) > 0)
      .map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? undefined,
        productName: i.productName,
        quantity: returnQtys[i.id],
        unitPrice: i.unitPrice,
      }));

    if (items.length === 0) { setError("Select at least one item to return"); return; }
    setProcessing(true); setError(""); setSuccess("");

    const res = await api<{ data: { id: string; totalRefund: number } }>(
      "accounting", `/api/bills/${bill.id}/returns`,
      { method: "POST", body: JSON.stringify({ warehouseId, items, reason, refundMethod }) }
    );
    setProcessing(false);
    if (res.error || !res.data) { setError(res.error ?? "Return processing failed"); return; }
    setSuccess(`Return processed — Refund ₹${Number(res.data.data.totalRefund).toLocaleString("en-IN")}`);
    setBill(null); setBillNumber(""); setReturnQtys({});
  }

  const totalRefund = bill
    ? bill.items.reduce((s, i) => s + i.unitPrice * (returnQtys[i.id] ?? 0), 0)
    : 0;

  function formatINR(value: number) {
    return `₹${Number(value).toLocaleString("en-IN")}`;
  }

  return (
    <div className={`relative p-4 transition-all duration-500 sm:p-6 ${isReady ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[color-mix(in_srgb,var(--brand)_18%,transparent)] via-transparent to-transparent" />
      <div className="relative mx-auto w-full max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Process Return</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Find completed bills, pick return quantities, and issue refunds quickly.</p>
        </div>

        {success && <div className="rounded-2xl border border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_30%,transparent)] px-4 py-3 text-sm text-[var(--brand-light)]">{success}</div>}

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Bill Number</label>
              <input
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchBill()}
                placeholder="Enter bill number..."
                className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--mist)] px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-[var(--brand)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-56 rounded-xl border border-[var(--line-strong)] bg-[var(--mist)] px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-[var(--brand)]"
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={searchBill}
              disabled={searching || loadingContext}
              className="rounded-xl border border-[var(--line-strong)] bg-[var(--mist)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 ease-out hover:bg-[var(--mist)] active:scale-[0.98] disabled:opacity-50"
            >
              {loadingContext ? "Loading..." : searching ? "Searching..." : "Find Bill"}
            </button>
          </div>
        </div>

        {searchError && <div className="rounded-2xl border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-300">{searchError}</div>}
        {error && <div className="rounded-2xl border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-300">{error}</div>}

        {searching && !bill && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="pos-skeleton h-4 w-1/3 rounded" />
              <div className="pos-skeleton mt-2 h-3 w-1/4 rounded" />
              <div className="mt-4 space-y-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="pos-skeleton h-16 rounded-xl" />
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="pos-skeleton h-4 w-1/2 rounded" />
              <div className="pos-skeleton mt-4 h-20 rounded-xl" />
              <div className="pos-skeleton mt-4 h-24 rounded-xl" />
              <div className="pos-skeleton mt-4 h-10 rounded-xl" />
            </div>
          </div>
        )}

        {bill && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-white">{bill.billNumber}</div>
                  <div className="text-xs text-[var(--ink-soft)]">Total: {formatINR(bill.total)}</div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${bill.status === "COMPLETED" ? "bg-[color-mix(in_srgb,var(--brand)_40%,transparent)] text-[var(--brand-light)]" : "bg-[var(--mist)] text-[var(--ink)]"}`}>
                  {bill.status}
                </span>
              </div>

              <div className="mb-5 space-y-2">
                {bill.items.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{ transitionDelay: `${idx * 25}ms` }}
                    className={`flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)]/40 px-4 py-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--line-strong)] ${isReady ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{item.productName}</div>
                      <div className="text-xs text-[var(--ink-soft)]">
                        {item.sku ?? item.productId} · Sold: {item.quantity} × {formatINR(item.unitPrice)}
                        {item.taxCode ? ` · ${item.taxCode}` : ""}
                        {typeof item.taxRate === "number" ? ` · Tax ${((item.taxRate > 1 ? item.taxRate / 100 : item.taxRate) * 100).toFixed(2)}%` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--ink-soft)]">Return:</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setReturnQtys((q) => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? 0) - 1) }))}
                          className="flex h-6 w-6 items-center justify-center rounded bg-[var(--mist)] text-white transition-all duration-200 ease-out hover:bg-[var(--mist)] active:scale-[0.98]">−</button>
                        <span className="w-6 text-center text-sm font-bold text-white">{returnQtys[item.id] ?? 0}</span>
                        <button onClick={() => setReturnQtys((q) => ({ ...q, [item.id]: Math.min(item.quantity, (q[item.id] ?? 0) + 1) }))}
                          className="flex h-6 w-6 items-center justify-center rounded bg-[var(--mist)] text-white transition-all duration-200 ease-out hover:bg-[var(--mist)] active:scale-[0.98]">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Reason (optional)</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Damaged, wrong item, customer changed mind..."
                  className="w-full rounded-xl border border-[var(--line-strong)] bg-[var(--mist)] px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 ease-out focus:border-[var(--brand)]" />
              </div>
            </div>

            <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink)]">Refund Summary</h3>
              <div className="mt-4 space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)]/40 p-3">
                <div className="flex items-center justify-between text-sm text-[var(--ink-soft)]">
                  <span>Items Selected</span>
                  <span>{Object.values(returnQtys).reduce((s, v) => s + v, 0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--line)] pt-2 text-base font-bold text-white">
                  <span>Total Refund</span>
                  <span>{formatINR(totalRefund)}</span>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">Refund Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CASH", "UPI", "WALLET"] as RefundMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setRefundMethod(method)}
                      className={`rounded-xl border py-2 text-xs font-semibold transition-all duration-200 ease-out active:scale-[0.98] ${refundMethod === method ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line-strong)] bg-[var(--mist)] text-[var(--ink)] hover:border-[var(--line-strong)]"}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {totalRefund > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--brand-dark)] bg-[color-mix(in_srgb,var(--brand)_25%,transparent)] px-4 py-3">
                  <span className="text-sm font-medium text-[var(--brand-light)]">Refund Amount</span>
                  <span className="text-lg font-bold text-[var(--brand-light)]">{formatINR(totalRefund)}</span>
                </div>
              )}

              <button onClick={processReturn} disabled={processing || totalRefund === 0}
                className="mt-4 w-full rounded-xl bg-[var(--brand)] py-3 text-sm font-bold text-white transition-all duration-200 ease-out hover:bg-[var(--brand-mid)] active:scale-[0.98] disabled:opacity-40">
                {processing ? "Processing..." : "Process Return & Refund"}
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

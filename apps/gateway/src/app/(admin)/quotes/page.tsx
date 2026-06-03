"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/admin-api";
import LeadToCashGuide from "@/components/LeadToCashGuide";
import LeadToCashUnderstanding from "@/components/LeadToCashUnderstanding";

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  date: string;
  validUntil: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  customer: { id: string; name: string } | null;
  items?: QuoteItem[];
}

interface QuoteItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface Customer { id: string; name: string; phone?: string; }
interface Product { id: string; name: string; sku: string; sellPrice: number; unit: string; }

interface SOLine {
  productId: string;
  productName: string;
  qty: string;
  unitPrice: string;
  discount: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
  EXPIRED: "bg-orange-100 text-orange-700",
};

type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

const QUOTE_NEXT: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

const QUOTE_HINT: Record<QuoteStatus, string> = {
  DRAFT: "Prepare and send",
  SENT: "Waiting for customer response",
  ACCEPTED: "Ready to convert into order",
  REJECTED: "Closed",
  EXPIRED: "Closed",
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [lines, setLines] = useState<SOLine[]>([]);
  const [formNotes, setFormNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  // Detail
  const [selected, setSelected] = useState<Quote | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const statusCounts = (["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as QuoteStatus[]).reduce((acc, status) => {
    acc[status] = quotes.filter((q) => q.status === status).length;
    return acc;
  }, {} as Record<QuoteStatus, number>);

  function notify(text: string, type: "ok" | "err" = "ok") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const [qRes, cRes, pRes] = await Promise.all([
        api(`/api/quotes?${params}`),
        api("/api/customers?limit=200"),
        api("/api/products?limit=500"),
      ]);
      setQuotes(qRes.data);
      setTotal(qRes.meta?.total ?? qRes.data.length);
      setCustomers(cRes.data);
      setProducts(pRes.data);
      if (cRes.data.length > 0 && !customerId) setCustomerId(cRes.data[0].id);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to load", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!productSearch.trim()) { setSuggestions([]); return; }
    const q = productSearch.toLowerCase();
    setSuggestions(products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8));
  }, [productSearch, products]);

  function addLine(product: Product) {
    const existing = lines.findIndex(l => l.productId === product.id);
    if (existing >= 0) {
      setLines(ls => ls.map((l, i) => i === existing ? { ...l, qty: String(Number(l.qty) + 1) } : l));
    } else {
      setLines(ls => [...ls, { productId: product.id, productName: product.name, qty: "1", unitPrice: String(product.sellPrice), discount: "0" }]);
    }
    setProductSearch(""); setSuggestions([]);
  }

  function removeLine(idx: number) { setLines(ls => ls.filter((_, i) => i !== idx)); }

  function lineTotal(line: SOLine) {
    const qty = Number(line.qty) || 0;
    const price = Number(line.unitPrice) || 0;
    const disc = Number(line.discount) || 0;
    return qty * price * (1 - disc / 100);
  }

  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const tax = subtotal * 0.05;

  async function createQuote() {
    if (!customerId) { notify("Select a customer", "err"); return; }
    if (lines.length === 0) { notify("Add at least one product", "err"); return; }
    setSaving(true);
    try {
      await api("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          date: new Date(date).toISOString(),
          validUntil: new Date(validUntil).toISOString(),
          notes: formNotes.trim() || undefined,
          items: lines.map(l => ({
            productId: l.productId,
            productName: l.productName,
            quantity: Number(l.qty),
            unitPrice: Number(l.unitPrice),
            discount: Number(l.discount) || 0,
          })),
        }),
      });
      notify("Quote created");
      setShowForm(false);
      setLines([]); setFormNotes("");
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to create quote", "err");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(quote: Quote, status: string) {
    const current = quote.status as QuoteStatus;
    if (!QUOTE_NEXT[current]?.includes(status as QuoteStatus)) {
      notify(`Cannot move from ${quote.status} to ${status}`, "err");
      return;
    }
    try {
      await api(`/api/quotes/${quote.id}?action=status`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify(`Quote marked as ${status}`);
      if (selected?.id === quote.id) setSelected({ ...selected, status });
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to update status", "err");
    }
  }

  async function openDetail(quote: Quote) {
    try {
      const res = await api(`/api/quotes/${quote.id}`);
      setSelected(res.data);
    } catch {
      setSelected(quote);
    }
  }

  async function convertToOrder(quote: Quote) {
    if (!quote.items || quote.items.length === 0) {
      notify("Load quote detail first", "err");
      return;
    }
    try {
      // First find a warehouse
      const wRes = await api("/api/warehouses?limit=5");
      const warehouseId = wRes.data[0]?.id;
      if (!warehouseId) { notify("No warehouse found", "err"); return; }

      await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerId: quote.customer?.id,
          quoteId: quote.id,
          warehouseId,
          items: quote.items.map((i: QuoteItem) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });
      notify("Sales order created from quote!");
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to convert to order", "err");
    }
  }

  return (
    <div className="p-6">
      <LeadToCashGuide current="quotes" />
      <LeadToCashUnderstanding current="quotes" />

      {customers.length === 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No customers found. Create a customer from the Leads conversion drawer or directly in the Customers page before creating quotes.
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500">{total} total quotes</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
          + New Quote
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msgType === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-5">
        {(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as QuoteStatus[]).map((status) => {
          const active = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(active ? "" : status)}
              className={`rounded-lg border p-3 text-left transition ${active ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{status}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[status]}`}>{statusCounts[status]}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{QUOTE_HINT[status]}</p>
            </button>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["", "DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${statusFilter === s ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">New Quote</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer *</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Quote Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valid Until *</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          {/* Product search */}
          <div className="mb-3 relative">
            <label className="block text-xs text-gray-500 mb-1">Add Products</label>
            <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
              placeholder="Search product by name or SKU..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            {suggestions.length > 0 && (
              <div className="absolute z-10 bg-white border rounded-lg shadow-lg w-full mt-1">
                {suggestions.map(p => (
                  <button key={p.id} onClick={() => addLine(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between">
                    <span>{p.name} <span className="text-gray-400 text-xs">({p.sku})</span></span>
                    <span className="text-gray-500">₹{p.sellPrice}/{p.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lines */}
          {lines.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Product</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 w-20">Qty</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 w-28">Unit Price</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 w-20">Disc %</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium text-gray-800">{l.productName}</td>
                      <td className="px-3 py-2">
                        <input value={l.qty} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                          className="w-full border rounded px-2 py-1 text-xs text-center" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={l.unitPrice} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, unitPrice: e.target.value } : x))}
                          className="w-full border rounded px-2 py-1 text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={l.discount} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, discount: e.target.value } : x))}
                          className="w-full border rounded px-2 py-1 text-xs text-center" />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">₹{lineTotal(l).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</td>
                    <td className="px-3 py-2 text-right font-semibold">₹{subtotal.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="px-3 py-2 text-right text-xs text-gray-500">Tax (5%)</td>
                    <td className="px-3 py-2 text-right text-gray-600">₹{tax.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  <tr className="bg-green-50">
                    <td colSpan={4} className="px-3 py-2 text-right text-sm font-bold text-gray-800">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-green-700">₹{(subtotal + tax).toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setLines([]); }} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={createQuote} disabled={saving}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving..." : "Create Quote"}
            </button>
          </div>
        </div>
      )}

      {/* Quotes table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : quotes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No quotes yet. Create your first quote above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Quote #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Valid Until</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map(quote => (
                <tr key={quote.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(quote)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{quote.quoteNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{quote.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(quote.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(quote.validUntil).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-medium">₹{Number(quote.total).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[quote.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      {QUOTE_NEXT[quote.status as QuoteStatus].map((nextStatus) => (
                        <button
                          key={nextStatus}
                          onClick={() => changeStatus(quote, nextStatus)}
                          className={`text-xs px-2 py-1 rounded border hover:brightness-95 ${
                            nextStatus === "SENT"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : nextStatus === "ACCEPTED"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {nextStatus}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-[480px] bg-white h-full shadow-2xl overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.quoteNumber}</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] ?? "bg-gray-100 text-gray-600"}`}>{selected.status}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{selected.customer?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{new Date(selected.date).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Valid Until</span><span>{new Date(selected.validUntil).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{Number(selected.subtotal).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>₹{Number(selected.tax).toLocaleString()}</span></div>
              <div className="flex justify-between font-semibold text-green-700"><span>Total</span><span>₹{Number(selected.total).toLocaleString()}</span></div>
            </div>

            {selected.items && selected.items.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Product</th>
                        <th className="text-right px-3 py-2">Qty</th>
                        <th className="text-right px-3 py-2">Price</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selected.items.map((item: QuoteItem) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">₹{Number(item.unitPrice).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-medium">₹{Number(item.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              {QUOTE_NEXT[selected.status as QuoteStatus].map((nextStatus) => (
                <button
                  key={nextStatus}
                  onClick={() => changeStatus(selected, nextStatus)}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium ${
                    nextStatus === "SENT"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : nextStatus === "ACCEPTED"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "border border-red-300 text-red-600 hover:bg-red-50"
                  }`}
                >
                  {nextStatus === "SENT" ? "Mark as Sent" : `Mark as ${nextStatus}`}
                </button>
              ))}
              {selected.status === "ACCEPTED" && (
                <button onClick={() => convertToOrder(selected)}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700">
                  Convert to Sales Order →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

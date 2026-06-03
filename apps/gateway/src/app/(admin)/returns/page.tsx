"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/admin-api";

interface SalesReturn {
  id: string;
  returnNumber: string;
  status: string;
  reason: string | null;
  notes: string | null;
  total: number;
  createdAt: string;
  customer: { id: string; name: string } | null;
  order: { id: string; orderNumber: string } | null;
  items?: ReturnItem[];
}

interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  customer: { name: string } | null;
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  shippedQty: number;
  unitPrice: number;
}

interface Warehouse { id: string; name: string; }

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  const [statusFilter, setStatusFilter] = useState("");

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Detail / actions
  const [selected, setSelected] = useState<SalesReturn | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [completeWarehouse, setCompleteWarehouse] = useState("");
  const [actioning, setActioning] = useState(false);

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
      const res = await api(`/api/returns?${params}`);
      setReturns(res.data);
      setTotal(res.meta?.total ?? res.data.length);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to load returns", "err");
    } finally {
      setLoading(false);
    }
  }

  async function loadFormData() {
    try {
      const [oRes, wRes] = await Promise.all([
        api("/api/orders?status=SHIPPED&limit=100"),
        api("/api/warehouses?limit=50"),
      ]);
      // Also get INVOICED and PARTIALLY_SHIPPED
      const [oRes2] = await Promise.all([api("/api/orders?status=INVOICED&limit=100")]);
      const allOrders = [...(oRes.data ?? []), ...(oRes2.data ?? [])];
      setOrders(allOrders);
      setWarehouses(wRes.data ?? []);
      if (wRes.data?.length > 0) setCompleteWarehouse(wRes.data[0].id);
      if (allOrders.length > 0) setSelectedOrderId(allOrders[0].id);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to load data", "err");
    }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedOrderId) { setOrderItems([]); return; }
    setLoadingItems(true);
    api(`/api/orders/${selectedOrderId}`)
      .then(res => {
        const items: OrderItem[] = res.data?.items ?? [];
        setOrderItems(items.filter(i => i.shippedQty > 0));
        const initQtys: Record<string, string> = {};
        items.filter(i => i.shippedQty > 0).forEach(i => { initQtys[i.id] = "0"; });
        setReturnQtys(initQtys);
      })
      .catch(() => setOrderItems([]))
      .finally(() => setLoadingItems(false));
  }, [selectedOrderId]);

  async function openForm() {
    await loadFormData();
    setShowForm(true);
  }

  async function createReturn() {
    const returnItems = orderItems
      .filter(i => Number(returnQtys[i.id]) > 0)
      .map(i => ({
        orderItemId: i.id,
        productId: i.productId,
        productName: i.productName,
        quantity: Number(returnQtys[i.id]),
        unitPrice: i.unitPrice,
      }));

    if (returnItems.length === 0) { notify("Select at least one item to return", "err"); return; }

    setSaving(true);
    try {
      await api("/api/returns", {
        method: "POST",
        body: JSON.stringify({
          orderId: selectedOrderId,
          reason: reason.trim() || undefined,
          notes: formNotes.trim() || undefined,
          items: returnItems,
        }),
      });
      notify("Sales return created");
      setShowForm(false);
      setReason(""); setFormNotes("");
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to create return", "err");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(sr: SalesReturn) {
    try {
      const res = await api(`/api/returns/${sr.id}`);
      setSelected(res.data);
    } catch {
      setSelected(sr);
    }
  }

  async function doAction(action: string) {
    if (!selected) return;
    setActioning(true);
    try {
      const body = action === "complete" ? JSON.stringify({ warehouseId: completeWarehouse }) : "{}";
      await api(`/api/returns/${selected.id}?action=${action}`, { method: "PATCH", body });
      notify(`Return ${action}d successfully`);
      const res = await api(`/api/returns/${selected.id}`);
      setSelected(res.data);
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : `Failed to ${action}`, "err");
    } finally {
      setActioning(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Returns</h1>
          <p className="text-sm text-gray-500">{total} total returns</p>
        </div>
        <button onClick={openForm}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
          + New Return
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msgType === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["", "PENDING", "APPROVED", "COMPLETED", "REJECTED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${statusFilter === s ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">New Sales Return</h2>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Select Shipped/Invoiced Order *</label>
            <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.orderNumber} — {o.customer?.name} ({o.status})</option>
              ))}
            </select>
            {orders.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">No shipped or invoiced orders found. Ship an order first.</p>
            )}
          </div>

          {loadingItems ? (
            <div className="text-sm text-gray-400 py-3">Loading order items...</div>
          ) : orderItems.length > 0 ? (
            <div className="border rounded-lg overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Product</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Shipped</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orderItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-gray-800">{item.productName}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{item.shippedQty}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number" min="0" max={item.shippedQty}
                          value={returnQtys[item.id] ?? "0"}
                          onChange={e => setReturnQtys(q => ({ ...q, [item.id]: e.target.value }))}
                          className="w-20 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedOrderId ? (
            <p className="text-xs text-gray-400 py-2">No shipped items on this order.</p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reason</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged, Wrong item"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={createReturn} disabled={saving || orders.length === 0}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? "Saving..." : "Create Return"}
            </button>
          </div>
        </div>
      )}

      {/* Returns table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : returns.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No sales returns yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Return #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Reason</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {returns.map(sr => (
                <tr key={sr.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(sr)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{sr.returnNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{sr.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{sr.order?.orderNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{sr.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">₹{Number(sr.total).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[sr.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {sr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(sr.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-[440px] bg-white h-full shadow-2xl overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.returnNumber}</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] ?? "bg-gray-100 text-gray-600"}`}>{selected.status}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{selected.customer?.name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Order</span><span className="font-medium">{selected.order?.orderNumber ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Reason</span><span>{selected.reason ?? "—"}</span></div>
              <div className="flex justify-between font-semibold"><span className="text-gray-500">Total</span><span className="text-green-700">₹{Number(selected.total).toLocaleString()}</span></div>
            </div>

            {selected.items && selected.items.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Return Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Product</th>
                        <th className="text-right px-3 py-2">Qty</th>
                        <th className="text-right px-3 py-2">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selected.items.map((item: ReturnItem) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">₹{Number(item.unitPrice).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            {selected.status === "PENDING" && (
              <div className="space-y-2">
                <button onClick={() => doAction("approve")} disabled={actioning}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {actioning ? "Processing..." : "Approve Return"}
                </button>
                <button onClick={() => doAction("reject")} disabled={actioning}
                  className="w-full border border-red-300 text-red-600 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                  {actioning ? "Processing..." : "Reject Return"}
                </button>
              </div>
            )}

            {selected.status === "APPROVED" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Restock to Warehouse</label>
                  <select value={completeWarehouse} onChange={e => setCompleteWarehouse(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <button onClick={() => doAction("complete")} disabled={actioning || !completeWarehouse}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {actioning ? "Processing..." : "Complete & Restock Inventory"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Button, PageScaffold, StatusBadge } from "@erp/ui";
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
    <PageScaffold
      hero={{
        eyebrow: "Trading operations",
        title: "Sales returns",
        description: `${total} returns. Process dealer orders on Order Desk.`,
        actions: (
          <Button type="button" onClick={openForm}>
            + New return
          </Button>
        ),
      }}
    >

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${msgType === "ok" ? "border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] text-[var(--success)]" : "border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_10%,white)] text-[var(--danger)]"}`}>
          {msg}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["", "PENDING", "APPROVED", "COMPLETED", "REJECTED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${statusFilter === s ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-white text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--line-strong)]"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-[var(--ink)] mb-4">New Sales Return</h2>

          <div className="mb-3">
            <label className="block text-xs text-[var(--ink-soft)] mb-1">Select Shipped/Invoiced Order *</label>
            <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]">
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.orderNumber} — {o.customer?.name} ({o.status})</option>
              ))}
            </select>
            {orders.length === 0 && (
              <p className="text-xs text-[var(--warning)] mt-1">No shipped or invoiced orders found. Ship an order first.</p>
            )}
          </div>

          {loadingItems ? (
            <div className="text-sm text-[var(--ink-soft)] py-3">Loading order items...</div>
          ) : orderItems.length > 0 ? (
            <div className="border rounded-lg overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead className="bg-[var(--mist)]">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-[var(--ink-soft)]">Product</th>
                    <th className="text-right px-3 py-2 text-xs text-[var(--ink-soft)]">Shipped</th>
                    <th className="text-right px-3 py-2 text-xs text-[var(--ink-soft)]">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orderItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-[var(--ink)]">{item.productName}</td>
                      <td className="px-3 py-2 text-right text-[var(--ink-soft)]">{item.shippedQty}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number" min="0" max={item.shippedQty}
                          value={returnQtys[item.id] ?? "0"}
                          onChange={e => setReturnQtys(q => ({ ...q, [item.id]: e.target.value }))}
                          className="w-20 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedOrderId ? (
            <p className="text-xs text-[var(--ink-soft)] py-2">No shipped items on this order.</p>
          ) : null}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">Reason</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged, Wrong item"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--ink-soft)] mb-1">Notes</label>
              <input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-[var(--ink-soft)] border rounded-lg hover:bg-[var(--mist)]">Cancel</button>
            <button onClick={createReturn} disabled={saving || orders.length === 0}
              className="ws-btn ws-btn--primary">
              {saving ? "Saving..." : "Create Return"}
            </button>
          </div>
        </div>
      )}

      {/* Returns table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-[var(--ink-soft)] text-sm">Loading...</div>
        ) : returns.length === 0 ? (
          <div className="p-8 text-center text-[var(--ink-soft)] text-sm">No sales returns yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--mist)] border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--ink-soft)]">Return #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--ink-soft)]">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--ink-soft)]">Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--ink-soft)]">Reason</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--ink-soft)]">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--ink-soft)]">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--ink-soft)]">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {returns.map(sr => (
                <tr key={sr.id} className="hover:bg-[var(--mist)] cursor-pointer" onClick={() => openDetail(sr)}>
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">{sr.returnNumber}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{sr.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)] text-xs">{sr.order?.orderNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--ink-soft)] text-xs">{sr.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">₹{Number(sr.total).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sr.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-soft)] text-xs">{new Date(sr.createdAt).toLocaleDateString()}</td>
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
                <h2 className="text-lg font-bold text-[var(--ink)]">{selected.returnNumber}</h2>
                <StatusBadge status={selected.status} />
              </div>
              <button onClick={() => setSelected(null)} className="text-[var(--ink-soft)] hover:text-[var(--ink-soft)] text-xl">✕</button>
            </div>

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between"><span className="text-[var(--ink-soft)]">Customer</span><span className="font-medium">{selected.customer?.name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--ink-soft)]">Order</span><span className="font-medium">{selected.order?.orderNumber ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-[var(--ink-soft)]">Reason</span><span>{selected.reason ?? "—"}</span></div>
              <div className="flex justify-between font-semibold"><span className="text-[var(--ink-soft)]">Total</span><span className="text-[var(--success)]">₹{Number(selected.total).toLocaleString()}</span></div>
            </div>

            {selected.items && selected.items.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-[var(--ink-soft)] uppercase mb-2">Return Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--mist)]">
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
                  className="w-full bg-[var(--brand)] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--brand-mid)] disabled:opacity-50">
                  {actioning ? "Processing..." : "Approve Return"}
                </button>
                <button onClick={() => doAction("reject")} disabled={actioning}
                  className="w-full border border-[color-mix(in_srgb,var(--danger)_45%,var(--line))] text-[var(--danger)] py-2.5 rounded-lg text-sm font-medium hover:bg-[color-mix(in_srgb,var(--danger)_10%,white)] disabled:opacity-50">
                  {actioning ? "Processing..." : "Reject Return"}
                </button>
              </div>
            )}

            {selected.status === "APPROVED" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-[var(--ink-soft)] mb-1">Restock to Warehouse</label>
                  <select value={completeWarehouse} onChange={e => setCompleteWarehouse(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <button onClick={() => doAction("complete")} disabled={actioning || !completeWarehouse}
                  className="ws-btn ws-btn--primary w-full">
                  {actioning ? "Processing..." : "Complete & Restock Inventory"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageScaffold>
  );
}

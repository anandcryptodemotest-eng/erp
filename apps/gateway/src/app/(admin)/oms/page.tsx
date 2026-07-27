"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/admin-api";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  marginPercent?: number;
  workflowId?: string | null;
  customer: { name: string } | null;
  items?: OrderItem[];
  modifications?: { action: string; remarks?: string; createdAt: string }[];
  workflow?: { id: string; code: string; name: string; templateId: string } | null;
  nextActions?: { action: string; label: string; uiPanel: string; roleHint: string | null }[];
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  availableQty?: number | null;
  shortageQty?: number | null;
  unitPrice: number;
  purchasePrice?: number | null;
}

interface WorkflowActive {
  id: string;
  code: string;
  name: string;
  templateId: string;
  trackedStatuses: string[];
  steps: { action: string; label: string; fromStatuses: string[]; uiPanel: string }[];
}

interface WorkflowTemplate {
  templateId: string;
  code: string;
  name: string;
  description: string;
  stepCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_SALES_REVIEW: "bg-amber-100 text-amber-800",
  REVIEWED: "bg-blue-100 text-blue-700",
  STOCK_VERIFIED: "bg-cyan-100 text-cyan-800",
  VENDOR_REQUESTED: "bg-orange-100 text-orange-800",
  PRICING_PENDING: "bg-purple-100 text-purple-700",
  PRICING_COMPLETED: "bg-indigo-100 text-indigo-700",
  READY_FOR_DISPATCH: "bg-teal-100 text-teal-800",
  DISPATCHED: "bg-sky-100 text-sky-800",
  DELIVERED: "bg-green-100 text-green-700",
  CLOSED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-600",
  CONFIRMED: "bg-blue-100 text-blue-700",
  AWAITING_PICKUP: "bg-yellow-100 text-yellow-800",
  OUT_FOR_DELIVERY: "bg-sky-100 text-sky-800",
  INVOICED: "bg-purple-100 text-purple-700",
};

export default function OmsOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowActive | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [purchaseInputs, setPurchaseInputs] = useState<Record<string, string>>({});
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");

  async function loadWorkflow() {
    const [active, tmpls] = await Promise.all([
      api("/api/order-workflows?active=1"),
      api("/api/order-workflows/templates"),
    ]);
    setWorkflow(active.data ?? null);
    setTemplates(tmpls.data ?? []);
  }

  async function load() {
    setLoading(true);
    try {
      await loadWorkflow();
      const r = await api("/api/orders?limit=50");
      setOrders(r.data ?? []);
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const tracked = useMemo(() => {
    const set = new Set(workflow?.trackedStatuses ?? []);
    if (set.size === 0) {
      // fallback until a template is applied
      return null;
    }
    return set;
  }, [workflow]);

  const visibleOrders = useMemo(() => {
    if (!tracked) return orders;
    return orders.filter((o) => tracked.has(o.status) || o.status === "CANCELLED");
  }, [orders, tracked]);

  async function applyTemplate(templateId: string) {
    try {
      const r = await api("/api/order-workflows", {
        method: "POST",
        body: JSON.stringify({ templateId, setDefault: true }),
      });
      setMsg(`Applied workflow: ${r.data?.name ?? templateId}`);
      await load();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function openOrder(id: string) {
    try {
      const r = await api(`/api/orders/${id}`);
      setSelected(r.data);
      const stock: Record<string, string> = {};
      const purchase: Record<string, string> = {};
      for (const item of r.data.items ?? []) {
        stock[item.id] = String(item.availableQty ?? item.quantity);
        purchase[item.id] = String(item.purchasePrice ?? "");
      }
      setStockInputs(stock);
      setPurchaseInputs(purchase);
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function runAction(action: string, uiPanel: string) {
    if (!selected) return;
    try {
      let body: Record<string, unknown> = {};
      if (action === "verify-stock" || uiPanel === "stock") {
        body = {
          items: (selected.items ?? []).map((i) => ({
            orderItemId: i.id,
            availableQty: Number(stockInputs[i.id] ?? i.quantity),
          })),
        };
      } else if (action === "complete-pricing" || uiPanel === "pricing") {
        body = {
          items: (selected.items ?? []).map((i) => ({
            orderItemId: i.id,
            purchasePrice: purchaseInputs[i.id] ? Number(purchaseInputs[i.id]) : undefined,
            unitPrice: i.unitPrice,
          })),
        };
      } else if (action === "dispatch" || uiPanel === "dispatch") {
        body = { vehicleInfo: vehicle || undefined, assignedDriverId: driver || undefined };
      } else if (action === "review") {
        body = { remarks: "Reviewed via OMS board" };
      } else if (action === "confirm") {
        body = { warehouseId: "seed-warehouse-main" };
      }

      const r = await api(`/api/orders/${selected.id}?action=${encodeURIComponent(action)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMsg(`${action} → ${r.data?.status}`);
      await openOrder(selected.id);
      load();
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const nextActions = selected?.nextActions ?? [];
  const showStock = nextActions.some((a) => a.uiPanel === "stock") || selected?.status === "REVIEWED";
  const showPricing =
    nextActions.some((a) => a.uiPanel === "pricing") || selected?.status === "PRICING_PENDING";
  const showDispatch =
    nextActions.some((a) => a.uiPanel === "dispatch") ||
    selected?.status === "READY_FOR_DISPATCH";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">OMS Workflow</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lifecycle is tenant-configurable. Active:{" "}
            <strong>{workflow?.name ?? "None — apply a template below"}</strong>
          </p>
        </div>
      </div>

      {!workflow && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm text-amber-900">
            No order workflow for this tenant. Apply a pack (do not invent one-off statuses in code):
          </p>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.templateId}
                type="button"
                onClick={() => applyTemplate(t.templateId)}
                className="px-3 py-2 bg-gray-900 text-white text-sm rounded-lg"
              >
                Apply {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {workflow && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-sm">
              <span className="font-medium">{workflow.name}</span>
              <span className="text-gray-400 ml-2 font-mono text-xs">{workflow.templateId}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.templateId}
                  type="button"
                  onClick={() => applyTemplate(t.templateId)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Switch to {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {workflow.steps.map((s) => (
              <span key={s.action} className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className="text-sm px-3 py-2 rounded bg-gray-50 border border-gray-200">{msg}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-medium text-gray-700">
            Orders {loading ? "…" : `(${visibleOrders.length})`}
          </div>
          <ul className="divide-y max-h-[70vh] overflow-y-auto">
            {visibleOrders.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => openOrder(o.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                    selected?.id === o.id ? "bg-gray-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{o.orderNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[o.status] ?? "bg-gray-100"}`}>
                      {o.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {o.customer?.name ?? "—"} · ₹{Number(o.total).toFixed(2)}
                  </div>
                </button>
              </li>
            ))}
            {!loading && visibleOrders.length === 0 && (
              <li className="px-4 py-8 text-center text-gray-400 text-sm">
                No orders for this workflow. Create a draft under Orders, then advance it here.
              </li>
            )}
          </ul>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-4 min-h-[320px]">
          {!selected ? (
            <p className="text-sm text-gray-400">Select an order. Next buttons come from the active workflow config.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{selected.orderNumber}</h2>
                  <p className="text-sm text-gray-500">{selected.customer?.name}</p>
                  {selected.workflow && (
                    <p className="text-xs text-gray-400 mt-1">Workflow: {selected.workflow.name}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[selected.status] ?? "bg-gray-100"}`}>
                  {selected.status}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-gray-500">Lines</h3>
                {(selected.items ?? []).map((item) => (
                  <div key={item.id} className="border border-gray-100 rounded p-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>{item.productName}</span>
                      <span className="text-gray-500">Qty {item.quantity}</span>
                    </div>
                    {showStock && (
                      <label className="flex items-center gap-2 text-xs">
                        Available
                        <input
                          className="border rounded px-2 py-1 w-24"
                          value={stockInputs[item.id] ?? ""}
                          onChange={(e) => setStockInputs({ ...stockInputs, [item.id]: e.target.value })}
                        />
                      </label>
                    )}
                    {showPricing && (
                      <label className="flex items-center gap-2 text-xs">
                        Purchase price
                        <input
                          className="border rounded px-2 py-1 w-24"
                          value={purchaseInputs[item.id] ?? ""}
                          onChange={(e) => setPurchaseInputs({ ...purchaseInputs, [item.id]: e.target.value })}
                        />
                        <span className="text-gray-400">Sell {item.unitPrice}</span>
                      </label>
                    )}
                    {(item.shortageQty ?? 0) > 0 && (
                      <p className="text-xs text-orange-600">Shortage: {item.shortageQty}</p>
                    )}
                  </div>
                ))}
              </div>

              {showDispatch && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="border rounded px-2 py-1.5 text-sm"
                    placeholder="Vehicle"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                  />
                  <input
                    className="border rounded px-2 py-1.5 text-sm"
                    placeholder="Driver id / name"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {nextActions.map((a) => (
                  <button
                    key={a.action}
                    onClick={() => runAction(a.action, a.uiPanel)}
                    className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded"
                    title={a.roleHint ?? undefined}
                  >
                    {a.label}
                  </button>
                ))}
                {nextActions.length === 0 && (
                  <p className="text-xs text-gray-400">No next steps from workflow for this status.</p>
                )}
              </div>

              {selected.modifications && selected.modifications.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">History</h3>
                  <ul className="text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                    {selected.modifications.map((m, i) => (
                      <li key={i}>
                        {m.action}
                        {m.remarks ? ` — ${m.remarks}` : ""} · {new Date(m.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

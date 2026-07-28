"use client";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, AlertCircle, PackageSearch, Truck } from "lucide-react";
import {
  Button,
  Card,
  Input,
  StatusBadge,
  KpiCard,
  PageHeader,
  EmptyState,
  Timeline,
  useToast,
  type TimelineEvent,
} from "@erp/ui";
import { api, getAdminUser } from "@/lib/admin-api";

interface WorkflowTask {
  id: string;
  action: string;
  title: string;
  assignedRole: string;
  assignedUserId?: string | null;
  status: string;
  order: OrderSummary;
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  marginPercent?: number;
  customer: { name: string } | null;
  items?: OrderItem[];
}

interface OrderDetails extends OrderSummary {
  workflow?: { id: string; code: string; name: string; templateId: string } | null;
  nextActions?: { action: string; label: string; uiPanel: string; roleHint: string | null }[];
  modifications?: { action: string; remarks?: string; createdAt: string }[];
  workflowRuntime?: {
    id: string;
    currentStatus: string;
    currentStepKey?: string | null;
    tasks?: {
      id: string;
      title: string;
      action: string;
      assignedRole: string;
      status: string;
      createdAt: string;
    }[];
    events?: {
      id: string;
      type: string;
      action?: string | null;
      fromStatus?: string | null;
      toStatus?: string | null;
      actorRole?: string | null;
      createdAt: string;
      remarks?: string | null;
    }[];
  } | null;
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

type WorkbenchKey = "SALES_EXECUTIVE" | "PRICING_EXECUTIVE" | "DISPATCH_EXECUTIVE" | "DELIVERY_EXECUTIVE";

const WORKBENCH_LABELS: Record<WorkbenchKey, string> = {
  SALES_EXECUTIVE: "Sales Executive",
  PRICING_EXECUTIVE: "Pricing Executive",
  DISPATCH_EXECUTIVE: "Dispatch Executive",
  DELIVERY_EXECUTIVE: "Delivery Executive",
};

function roleToWorkbench(role?: string | null): WorkbenchKey {
  if (role === "SALES_REP") return "SALES_EXECUTIVE";
  if (role === "PRICING_EXECUTIVE") return "PRICING_EXECUTIVE";
  if (role === "DISPATCH_EXECUTIVE") return "DISPATCH_EXECUTIVE";
  if (role === "DELIVERY_EXECUTIVE") return "DELIVERY_EXECUTIVE";
  return "SALES_EXECUTIVE";
}

function eventState(event: NonNullable<OrderDetails["workflowRuntime"]>["events"] extends (infer E)[] | undefined ? E : never): TimelineEvent["state"] {
  if (event.type === "TASK_CREATED") return "current";
  return "completed";
}

export default function OmsOrdersPage() {
  const toast = useToast();
  const adminUser = getAdminUser();
  const currentRole = adminUser?.role ?? "ADMIN";
  const canSwitchWorkbench = ["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"].includes(currentRole);

  const [workflow, setWorkflow] = useState<WorkflowActive | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"role" | "mine">("role");
  const [workbench, setWorkbench] = useState<WorkbenchKey>(roleToWorkbench(currentRole));
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [summary, setSummary] = useState({ pending: 0, inProgress: 0, overdue: 0, orders: 0 });
  const [selected, setSelected] = useState<OrderDetails | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [purchaseInputs, setPurchaseInputs] = useState<Record<string, string>>({});
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  function reportError(e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  }

  async function loadWorkflow() {
    const [active, tmpls] = await Promise.all([
      api("/api/order-workflows?active=1"),
      api("/api/order-workflows/templates"),
    ]);
    setWorkflow(active.data ?? null);
    setTemplates(tmpls.data ?? []);
  }

  async function loadTasks(targetWorkbench = workbench, targetScope = scope) {
    const r = await api(
      `/api/workflow-tasks?role=${encodeURIComponent(targetWorkbench)}&scope=${encodeURIComponent(targetScope)}`
    );
    setTasks(r.data ?? []);
    setSummary(r.meta ?? { pending: 0, inProgress: 0, overdue: 0, orders: 0 });
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadWorkflow(), loadTasks()]);
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTasks(workbench, scope).catch(reportError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbench, scope]);

  async function applyTemplate(templateId: string) {
    try {
      const r = await api("/api/order-workflows", {
        method: "POST",
        body: JSON.stringify({ templateId, setDefault: true }),
      });
      toast.success(`Applied workflow: ${r.data?.name ?? templateId}`);
      await loadAll();
    } catch (e: unknown) {
      reportError(e);
    }
  }

  async function openOrder(orderId: string) {
    try {
      const r = await api(`/api/orders/${orderId}`);
      const order: OrderDetails = r.data;
      setSelected(order);
      const stock: Record<string, string> = {};
      const purchase: Record<string, string> = {};
      for (const item of order.items ?? []) {
        stock[item.id] = String(item.availableQty ?? item.quantity);
        purchase[item.id] = String(item.purchasePrice ?? "");
      }
      setStockInputs(stock);
      setPurchaseInputs(purchase);
      setVehicle("");
      setDriver("");
    } catch (e: unknown) {
      reportError(e);
    }
  }

  async function updateTaskState(taskId: string, status: "IN_PROGRESS" | "PENDING") {
    try {
      await api(`/api/workflow-tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadTasks();
      if (selected) {
        await openOrder(selected.id);
      }
    } catch (e: unknown) {
      reportError(e);
    }
  }

  async function runAction(action: string, uiPanel: string) {
    if (!selected) return;
    setActionBusy(action);
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
        body = { remarks: "Reviewed via OMS workbench" };
      } else if (action === "confirm") {
        body = { warehouseId: "seed-warehouse-main" };
      }

      const r = await api(`/api/orders/${selected.id}?action=${encodeURIComponent(action)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(`Order ${selected.orderNumber} → ${r.data?.status}`);
      await Promise.all([openOrder(selected.id), loadTasks()]);
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setActionBusy(null);
    }
  }

  const visibleWorkbenches = useMemo(() => {
    if (canSwitchWorkbench) {
      return Object.keys(WORKBENCH_LABELS) as WorkbenchKey[];
    }
    return [roleToWorkbench(currentRole)];
  }, [canSwitchWorkbench, currentRole]);

  const nextActions = selected?.nextActions ?? [];
  const showStock = nextActions.some((a) => a.uiPanel === "stock") || selected?.status === "REVIEWED";
  const showPricing = nextActions.some((a) => a.uiPanel === "pricing") || selected?.status === "PRICING_PENDING";
  const showDispatch = nextActions.some((a) => a.uiPanel === "dispatch") || selected?.status === "READY_FOR_DISPATCH";

  const timelineEvents: TimelineEvent[] = (selected?.workflowRuntime?.events ?? []).map((event) => ({
    key: event.id,
    label: `${event.type}${event.action ? ` · ${event.action}` : ""}`,
    description: `${event.fromStatus ? `${event.fromStatus} → ` : ""}${event.toStatus ?? "—"}${event.actorRole ? ` · ${event.actorRole}` : ""}`,
    timestamp: new Date(event.createdAt).toLocaleString(),
    state: eventState(event),
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="OMS Workbench"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "OMS Workbench" }]}
        secondaryActions={
          <div className="flex flex-wrap items-center gap-2">
            {canSwitchWorkbench &&
              visibleWorkbenches.map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={workbench === key ? "primary" : "outline"}
                  onClick={() => setWorkbench(key)}
                >
                  {WORKBENCH_LABELS[key]}
                </Button>
              ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setScope((s) => (s === "role" ? "mine" : "role"))}
            >
              {scope === "role" ? "Team queue" : "My tasks"}
            </Button>
          </div>
        }
      />

      <p className="text-sm text-slate-500 -mt-4">
        Active workflow: <strong className="text-slate-700">{workflow?.name ?? "No workflow applied"}</strong>
      </p>

      {!workflow && (
        <Card className="border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No OMS workflow is active for this tenant. Apply a workflow pack first.
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button key={t.templateId} type="button" size="sm" onClick={() => applyTemplate(t.templateId)}>
                Apply {t.name}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Pending" value={summary.pending} icon={ClipboardList} color="amber" />
        <KpiCard label="In Progress" value={summary.inProgress} icon={Loader2} color="blue" />
        <KpiCard label="Orders In Queue" value={summary.orders} icon={PackageSearch} color="indigo" />
        <KpiCard label="Overdue" value={summary.overdue} icon={AlertCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-6">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-700 flex items-center justify-between">
            <span>{WORKBENCH_LABELS[workbench]} queue</span>
            <span className="text-xs text-slate-400">{loading ? "Loading…" : `${tasks.length} tasks`}</span>
          </div>
          <ul className="divide-y divide-slate-100 max-h-[72vh] overflow-y-auto">
            {tasks.map((task) => (
              <li key={task.id}>
                <div className={`px-4 py-3 hover:bg-slate-50 ${selected?.id === task.order.id ? "bg-slate-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => openOrder(task.order.id)} className="text-left min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{task.order.orderNumber}</div>
                      <div className="text-xs text-slate-500 mt-1 truncate">{task.order.customer?.name ?? "—"}</div>
                    </button>
                    <StatusBadge status={task.order.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-600">{task.title}</div>
                    {task.status === "PENDING" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTaskState(task.id, "IN_PROGRESS");
                        }}
                      >
                        Start
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTaskState(task.id, "PENDING");
                        }}
                      >
                        In progress
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {!loading && tasks.length === 0 && (
            <EmptyState icon={ClipboardList} title="No work assigned" subtitle="This workbench queue is clear for now." />
          )}
        </Card>

        <Card className="p-5 space-y-5 min-h-[420px]">
          {!selected ? (
            <EmptyState
              icon={PackageSearch}
              title="Select a task"
              subtitle="Choose a task or order from the queue on the left to open workbench details."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selected.orderNumber}</h2>
                  <p className="text-sm text-slate-500">{selected.customer?.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{selected.workflow?.name ?? "No workflow bound"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-sm font-medium text-slate-900">₹{Number(selected.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Order Lines</h3>
                    <div className="space-y-2">
                      {(selected.items ?? []).map((item) => (
                        <div key={item.id} className="rounded-lg border border-slate-100 p-3 text-sm space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-slate-800">{item.productName}</span>
                            <span className="text-slate-500">Qty {item.quantity}</span>
                          </div>

                          {showStock && (
                            <Input
                              label="Available qty"
                              className="w-32"
                              value={stockInputs[item.id] ?? ""}
                              onChange={(e) => setStockInputs({ ...stockInputs, [item.id]: e.target.value })}
                            />
                          )}

                          {showPricing && (
                            <div className="flex items-end gap-3">
                              <Input
                                label="Purchase price"
                                className="w-32"
                                value={purchaseInputs[item.id] ?? ""}
                                onChange={(e) => setPurchaseInputs({ ...purchaseInputs, [item.id]: e.target.value })}
                              />
                              <span className="text-xs text-slate-400 pb-2">Sell {item.unitPrice}</span>
                            </div>
                          )}

                          {(item.shortageQty ?? 0) > 0 && (
                            <p className="text-xs text-amber-600">Shortage: {item.shortageQty}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {showDispatch && (
                    <div className="rounded-lg border border-slate-100 p-3 space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" /> Dispatch Setup
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
                        <Input
                          placeholder="Driver / executive id"
                          value={driver}
                          onChange={(e) => setDriver(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {nextActions.map((a) => (
                      <Button
                        key={a.action}
                        onClick={() => runAction(a.action, a.uiPanel)}
                        loading={actionBusy === a.action}
                        title={a.roleHint ?? undefined}
                      >
                        {a.label}
                      </Button>
                    ))}
                    {nextActions.length === 0 && (
                      <p className="text-xs text-slate-400">No next steps available from this stage.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-100 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Open Tasks</h3>
                    <ul className="space-y-2 text-xs text-slate-600">
                      {(selected.workflowRuntime?.tasks ?? []).map((task) => (
                        <li key={task.id} className="flex items-center justify-between gap-2">
                          <span>{task.title}</span>
                          <span className="text-slate-400">{task.assignedRole}</span>
                        </li>
                      ))}
                      {(selected.workflowRuntime?.tasks ?? []).length === 0 && (
                        <li className="text-slate-400">No open runtime tasks.</li>
                      )}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-slate-100 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Timeline</h3>
                    <div className="max-h-80 overflow-y-auto">
                      {timelineEvents.length > 0 ? (
                        <Timeline events={timelineEvents} />
                      ) : (
                        <p className="text-xs text-slate-400">No workflow events yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

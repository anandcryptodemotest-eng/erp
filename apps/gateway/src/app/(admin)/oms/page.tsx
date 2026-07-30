"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ClipboardList,
  Loader2,
  PackageSearch,
  Plane,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Input,
  KpiCard,
  PageHeader,
  StatusBadge,
  useToast,
} from "@erp/ui";
import { api, getAdminUser } from "@/lib/admin-api";
import { ScreenController } from "@/lib/ui-runtime/ScreenController";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface WorkflowTask {
  id: string;
  action: string;
  title: string;
  assignedRole: string;
  assignedUserId?: string | null;
  status: string;
  dueAt?: string | null;
  order: OrderSummary;
  blockedBy?: string[];
  ui?: StepUi;
}

type StepUi = {
  description?: string;
  fields?: {
    key: string;
    label: string;
    type: "number" | "text" | "readonly" | "textarea" | "select";
    scope: "per-item" | "order";
    source?: string;
    required?: boolean;
  }[];
  confirmLabel?: string;
  theme?: "emerald" | "amber" | string;
  themeId?: string;
  title?: string;
  formId?: string;
  layout?: { widget: string; props?: Record<string, unknown> }[];
};

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  marginPercent?: number;
  customer: { name: string } | null;
  items?: OrderItem[];
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
  taxRate?: number;
  remarks?: string | null;
}

interface EditableLine {
  key: string;
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  sku?: string | null;
  sellPrice?: number | null;
}

interface OrderDetails extends OrderSummary {
  salesRemarks?: string | null;
  deliveryDate?: string | null;
  salesRequest?: {
    id: string;
    requestNumber: string;
    status: string;
    createdAt?: string;
  } | null;
  workflow?: { id: string; code: string; name: string; templateId: string } | null;
  nextActions?: {
    action: string;
    label: string;
    uiPanel: string;
    roleHint: string | null;
    sortOrder: number;
    blockedBy?: string[];
    ui?: StepUi;
  }[];
  modifications?: { action: string; remarks?: string; createdAt: string }[];
  runtimePath?: "v5";
  workflowRuntime?: {
    id: string;
    currentStatus: string;
    currentStepKey?: string | null;
    snapshot?: unknown;
    tasks?: {
      id: string;
      title: string;
      action: string;
      assignedRole: string;
      status: string;
      createdAt: string;
      completedAt?: string | null;
      phase?: string;
      kind?: string;
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

interface SreqItem {
  id?: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  total?: number;
}

interface CustomerSummary {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  creditLimit?: number | null;
  outstandingBalance?: number | null;
  portalLinked?: boolean;
  isBlocked?: boolean;
  blockedReason?: string | null;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  date: string;
}

interface SalesRequestRow {
  id: string;
  requestNumber: string;
  status: string;
  total: number;
  createdAt: string;
  paymentMethod?: string;
  notes?: string | null;
  customer: { id?: string; name: string; phone?: string | null; email?: string | null } | null;
  salesOrder?: { id: string; orderNumber: string; status: string } | null;
  items?: SreqItem[];
  /** Present on GET /api/sales-requests/:id */
  customerSummary?: CustomerSummary;
  deliveryAddressResolved?: string | null;
  recentOrders?: RecentOrder[];
  soNumber?: string | null;
  soStatus?: string | null;
}

type WorkbenchKey =
  | "SALES_EXECUTIVE"
  | "PRICING_EXECUTIVE"
  | "PROCUREMENT_OFFICER"
  | "DISPATCH_EXECUTIVE"
  | "DELIVERY_EXECUTIVE"
  | "ACCOUNTANT";

type DeskTab = "sreq" | "tasks" | "inflight";

const WORKBENCH_LABELS: Record<WorkbenchKey, string> = {
  SALES_EXECUTIVE: "Sales",
  PRICING_EXECUTIVE: "Pricing",
  PROCUREMENT_OFFICER: "Procurement",
  DISPATCH_EXECUTIVE: "Warehouse / Dispatch",
  DELIVERY_EXECUTIVE: "Delivery",
  ACCOUNTANT: "Finance",
};

const IN_FLIGHT_STATUSES = new Set([
  "CONFIRMED",
  "FULFILLING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "DELIVERED",
  "INVOICED",
  "PAID",
]);

function roleToWorkbench(role?: string | null): WorkbenchKey {
  if (role === "SALES_REP" || role === "SALES_EXECUTIVE") return "SALES_EXECUTIVE";
  if (role === "PRICING_EXECUTIVE") return "PRICING_EXECUTIVE";
  if (role === "PROCUREMENT_OFFICER") return "PROCUREMENT_OFFICER";
  if (role === "DISPATCH_EXECUTIVE") return "DISPATCH_EXECUTIVE";
  if (role === "DELIVERY_EXECUTIVE") return "DELIVERY_EXECUTIVE";
  if (role === "ACCOUNTANT") return "ACCOUNTANT";
  return "SALES_EXECUTIVE";
}

function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dateInputToIso(dateStr: string): string | undefined {
  if (!dateStr.trim()) return undefined;
  return `${dateStr}T00:00:00.000Z`;
}

function formatMoney(n: number | null | undefined): string {
  return `₹${Number(n ?? 0).toFixed(2)}`;
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function OmsOrdersPage() {
  const toast = useToast();
  const adminUser = getAdminUser();
  const currentRole = adminUser?.role ?? "ADMIN";
  const canSwitchWorkbench = ["ADMIN", "MANAGER", "ORG_ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"].includes(
    currentRole
  );
  const isSalesLocked = currentRole === "SALES_EXECUTIVE" || currentRole === "SALES_REP";
  const canEditPrice = !isSalesLocked && [
    "ADMIN",
    "MANAGER",
    "ORG_ADMIN",
    "SUPER_ADMIN",
    "BRANCH_ADMIN",
    "PRICING_EXECUTIVE",
  ].includes(currentRole);
  const myTaskRoles = new Set(
    isSalesLocked ? ["SALES_EXECUTIVE", "SALES_REP"] : [currentRole]
  );

  function isMyRoleAction(roleHint: string | null | undefined): boolean {
    if (canSwitchWorkbench) return true;
    if (!roleHint) return true;
    return myTaskRoles.has(roleHint) || (isSalesLocked && roleHint === "SALES_EXECUTIVE");
  }

  const [workflow, setWorkflow] = useState<WorkflowActive | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"role" | "mine">("role");
  // Non-sales roles don't manage SREQs — start them on their task queue
  const [deskTab, setDeskTab] = useState<DeskTab>(isSalesLocked ? "sreq" : "tasks");
  const [myWorkFilter, setMyWorkFilter] = useState<"all" | "overdue">("all");
  const [sreqs, setSreqs] = useState<SalesRequestRow[]>([]);
  const [selectedSreq, setSelectedSreq] = useState<SalesRequestRow | null>(null);
  const [workbench, setWorkbench] = useState<WorkbenchKey>(
    isSalesLocked ? "SALES_EXECUTIVE" : roleToWorkbench(currentRole)
  );
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [inflightOrders, setInflightOrders] = useState<OrderSummary[]>([]);
  const [summary, setSummary] = useState({ pending: 0, inProgress: 0, overdue: 0, orders: 0 });
  const [selected, setSelected] = useState<OrderDetails | null>(null);
  // Generic step-field inputs: key = "fieldKey" (order scope) or "fieldKey:itemId" (per-item)
  const [stepInputs, setStepInputs] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  function stepInput(fieldKey: string, itemId?: string) {
    return stepInputs[itemId ? `${fieldKey}:${itemId}` : fieldKey] ?? "";
  }
  function setStepInput(fieldKey: string, value: string, itemId?: string) {
    setStepInputs((prev) => ({ ...prev, [itemId ? `${fieldKey}:${itemId}` : fieldKey]: value }));
  }

  /* SREQ edit local state */
  const [sreqNotes, setSreqNotes] = useState("");
  const [sreqItemQty, setSreqItemQty] = useState<Record<string, string>>({});
  const [sreqItemPrice, setSreqItemPrice] = useState<Record<string, string>>({});

  /* Reject modal */
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  /* Sales review form (SO) */
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [reviewDeliveryDate, setReviewDeliveryDate] = useState("");
  const [reviewQty, setReviewQty] = useState<Record<string, string>>({});
  const [reviewUnitPrice, setReviewUnitPrice] = useState<Record<string, string>>({});
  const [reviewLines, setReviewLines] = useState<EditableLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productHits, setProductHits] = useState<CatalogProduct[]>([]);
  const [productSearching, setProductSearching] = useState(false);

  function reportError(e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  }

  function itemKey(item: SreqItem, idx: number): string {
    return item.id ?? `${item.productId}-${idx}`;
  }

  function hydrateSreqEdit(sreq: SalesRequestRow) {
    setSreqNotes(sreq.notes ?? "");
    const qty: Record<string, string> = {};
    const price: Record<string, string> = {};
    (sreq.items ?? []).forEach((item, idx) => {
      const key = itemKey(item, idx);
      qty[key] = String(item.quantity);
      price[key] = String(item.unitPrice);
    });
    setSreqItemQty(qty);
    setSreqItemPrice(price);
  }

  function hydrateReviewForm(order: OrderDetails) {
    setReviewRemarks(order.salesRemarks ?? "");
    setReviewDeliveryDate(toDateInputValue(order.deliveryDate));
    const qty: Record<string, string> = {};
    const price: Record<string, string> = {};
    const lines: EditableLine[] = [];
    for (const item of order.items ?? []) {
      qty[item.id] = String(item.quantity);
      price[item.id] = String(item.unitPrice);
      lines.push({
        key: item.id,
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    }
    setReviewQty(qty);
    setReviewUnitPrice(price);
    setReviewLines(lines);
    setProductSearch("");
    setProductHits([]);
  }

  async function loadWorkflow() {
    const [active, tmpls] = await Promise.all([
      api("/api/order-workflows?active=1"),
      api("/api/order-workflows/templates"),
    ]);
    setWorkflow(active.data ?? null);
    setTemplates(tmpls.data ?? []);
  }

  async function loadSreqs() {
    const r = await api("/api/sales-requests?status=OPEN&limit=50");
    setSreqs(r.data ?? []);
  }

  async function loadTasks(targetWorkbench = workbench, targetScope = scope) {
    const r = await api(
      `/api/workflow-tasks?role=${encodeURIComponent(targetWorkbench)}&scope=${encodeURIComponent(targetScope)}`
    );
    setTasks(r.data ?? []);
    setSummary(r.meta ?? { pending: 0, inProgress: 0, overdue: 0, orders: 0 });
  }

  async function loadInflight() {
    const r = await api("/api/orders?limit=50");
    const rows: OrderSummary[] = r.data ?? [];
    setInflightOrders(rows.filter((o) => IN_FLIGHT_STATUSES.has(o.status)));
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadWorkflow(), loadTasks(), loadSreqs(), loadInflight()]);
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
    if (isSalesLocked && workbench !== "SALES_EXECUTIVE") {
      setWorkbench("SALES_EXECUTIVE");
      return;
    }
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

  async function openSreq(id: string) {
    try {
      const r = await api(`/api/sales-requests/${id}`);
      const data: SalesRequestRow = r.data;
      setSelectedSreq(data);
      setSelected(null);
      setShowRejectModal(false);
      setRejectReason("");
      hydrateSreqEdit(data);
      if (data?.salesOrder?.id) {
        await openOrder(data.salesOrder.id);
      }
    } catch (e: unknown) {
      reportError(e);
    }
  }

  async function saveSreqChanges(id: string) {
    if (!selectedSreq) return;
    setActionBusy("save-sreq");
    try {
      const items = (selectedSreq.items ?? []).map((item, idx) => {
        const key = itemKey(item, idx);
        return {
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId ?? undefined,
          quantity: Math.max(1, Math.round(Number(sreqItemQty[key] ?? item.quantity))),
          unitPrice: canEditPrice
            ? Math.max(0, Number(sreqItemPrice[key] ?? item.unitPrice))
            : item.unitPrice,
          taxRate: item.taxRate ?? 0,
        };
      });
      const r = await api(`/api/sales-requests/${id}?action=update`, {
        method: "PATCH",
        body: JSON.stringify({ notes: sreqNotes, items }),
      });
      toast.success("Sales request saved");
      const refreshed = r.data as SalesRequestRow;
      // Keep rich fields from prior detail fetch where PATCH may omit them
      const merged: SalesRequestRow = {
        ...selectedSreq,
        ...refreshed,
        customerSummary: selectedSreq.customerSummary,
        deliveryAddressResolved: selectedSreq.deliveryAddressResolved,
        recentOrders: selectedSreq.recentOrders,
        notes: refreshed.notes ?? sreqNotes,
      };
      setSelectedSreq(merged);
      hydrateSreqEdit(merged);
      await loadSreqs();
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setActionBusy(null);
    }
  }

  async function convertSreq(id: string) {
    setActionBusy("convert");
    try {
      // Persist line/notes edits before convert so SO inherits them
      if (selectedSreq?.status === "OPEN") {
        const items = (selectedSreq.items ?? []).map((item, idx) => {
          const key = itemKey(item, idx);
          return {
            productId: item.productId,
            productName: item.productName,
            variantId: item.variantId ?? undefined,
            quantity: Math.max(1, Math.round(Number(sreqItemQty[key] ?? item.quantity))),
            unitPrice: canEditPrice
              ? Math.max(0, Number(sreqItemPrice[key] ?? item.unitPrice))
              : item.unitPrice,
            taxRate: item.taxRate ?? 0,
          };
        });
        await api(`/api/sales-requests/${id}?action=update`, {
          method: "PATCH",
          body: JSON.stringify({ notes: sreqNotes, items }),
        });
      }

      const r = await api(`/api/sales-requests/${id}/convert`, { method: "POST", body: "{}" });
      toast.success(`Converted → ${r.data?.soNumber ?? r.data?.salesOrder?.orderNumber}`);
      await Promise.all([loadSreqs(), loadInflight()]);
      const orderId = r.data?.salesOrder?.id as string | undefined;
      if (orderId) {
        setSelectedSreq(null);
        setDeskTab("tasks");
        await openOrder(orderId);
        await loadTasks();
      }
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setActionBusy(null);
    }
  }

  async function rejectSreq(id: string) {
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error("Reject reason must be at least 3 characters");
      return;
    }
    setActionBusy("reject");
    try {
      await api(`/api/sales-requests/${id}?action=reject`, {
        method: "PATCH",
        body: JSON.stringify({ rejectReason: reason }),
      });
      toast.success("Sales request rejected");
      setSelectedSreq(null);
      setShowRejectModal(false);
      setRejectReason("");
      await loadSreqs();
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setActionBusy(null);
    }
  }

  async function openOrder(orderId: string) {
    try {
      const r = await api(`/api/orders/${orderId}`);
      const order: OrderDetails = r.data;
      setSelected(order);
      setSelectedSreq(null);
      // Pre-fill step inputs from order item data
      const inputs: Record<string, string> = {};
      for (const item of order.items ?? []) {
        inputs[`availableQty:${item.id}`] = String(item.availableQty ?? item.quantity);
        inputs[`purchasePrice:${item.id}`] = String(item.purchasePrice ?? "");
        inputs[`unitPrice:${item.id}`] = String(item.unitPrice ?? "");
      }
      setStepInputs(inputs);
      hydrateReviewForm(order);
    } catch (e: unknown) {
      reportError(e);
    }
  }

  function resolveTaskId(action: string): string | undefined {
    const fromRuntime = (selected?.workflowRuntime?.tasks ?? []).find(
      (t) =>
        t.action === action &&
        ["READY", "CLAIMED", "IN_PROGRESS", "PENDING"].includes(t.status)
    );
    if (fromRuntime?.id) return fromRuntime.id;
    const fromQueue = tasks.find(
      (t) =>
        t.order.id === selected?.id &&
        t.action === action &&
        ["READY", "CLAIMED", "IN_PROGRESS", "PENDING"].includes(t.status)
    );
    return fromQueue?.id;
  }

  async function completeTaskOrPatch(
    action: string,
    body: Record<string, unknown>
  ): Promise<{ data?: { status?: string } }> {
    const taskId = resolveTaskId(action);
    const isV5 = Boolean(selected?.workflowRuntime?.snapshot) || selected?.runtimePath === "v5";
    if (taskId && isV5) {
      return api(`/api/workflow-tasks/${taskId}?action=complete`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    return api(`/api/orders/${selected!.id}?action=${encodeURIComponent(action)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async function completeReview() {
    if (!selected) return;
    if (reviewLines.length === 0) {
      toast.error("Add at least one product, or cancel the order");
      return;
    }
    setActionBusy("review");
    try {
      const items = reviewLines.map((line) => ({
        id: line.id,
        productId: line.productId,
        productName: line.productName,
        quantity: Math.max(1, Math.round(Number(reviewQty[line.key] ?? line.quantity))),
        unitPrice: canEditPrice
          ? Math.max(0, Number(reviewUnitPrice[line.key] ?? line.unitPrice))
          : line.unitPrice,
      }));
      const body: Record<string, unknown> = {
        remarks: reviewRemarks || undefined,
        items,
      };
      const deliveryIso = dateInputToIso(reviewDeliveryDate);
      if (deliveryIso) body.deliveryDate = deliveryIso;

      const r = await completeTaskOrPatch("review", body);
      toast.success(`Review done · ${selected.orderNumber} → ${r.data?.status ?? selected.status}`);
      await Promise.all([openOrder(selected.id), loadTasks(), loadInflight()]);
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setActionBusy(null);
    }
  }

  async function searchProducts(q: string) {
    setProductSearch(q);
    if (q.trim().length < 2) {
      setProductHits([]);
      return;
    }
    setProductSearching(true);
    try {
      const r = await api(`/api/products?search=${encodeURIComponent(q.trim())}&limit=8`);
      const rows = (r.data ?? r.items ?? []) as CatalogProduct[];
      setProductHits(Array.isArray(rows) ? rows : []);
    } catch {
      setProductHits([]);
    } finally {
      setProductSearching(false);
    }
  }

  function addProductToReview(p: CatalogProduct) {
    const exists = reviewLines.find((l) => l.productId === p.id);
    if (exists) {
      const nextQty = exists.quantity + 1;
      setReviewLines(
        reviewLines.map((l) => (l.key === exists.key ? { ...l, quantity: nextQty } : l))
      );
      setReviewQty({ ...reviewQty, [exists.key]: String(nextQty) });
    } else {
      const key = `new-${p.id}-${Date.now()}`;
      const unitPrice = Number(p.sellPrice ?? 0);
      setReviewLines([
        ...reviewLines,
        {
          key,
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice,
        },
      ]);
      setReviewQty({ ...reviewQty, [key]: "1" });
      setReviewUnitPrice({ ...reviewUnitPrice, [key]: String(unitPrice) });
    }
    setProductSearch("");
    setProductHits([]);
    toast.success(`Added ${p.name}`);
  }

  async function removeReviewLine(key: string) {
    if (reviewLines.length <= 1) {
      const ok = window.confirm(
        "This is the last product. Removing it will cancel this Sales Order and the linked Sales Request. Continue?"
      );
      if (!ok || !selected) return;
      setActionBusy("cancel");
      try {
        await api(`/api/orders/${selected.id}?action=cancel`, {
          method: "PATCH",
          body: "{}",
        });
        toast.success("Sales Order and Sales Request cancelled");
        setSelected(null);
        await Promise.all([loadTasks(), loadInflight(), loadSreqs()]);
        setDeskTab("sreq");
      } catch (e: unknown) {
        reportError(e);
      } finally {
        setActionBusy(null);
      }
      return;
    }
    setReviewLines(reviewLines.filter((l) => l.key !== key));
    const nextQty = { ...reviewQty };
    const nextPrice = { ...reviewUnitPrice };
    delete nextQty[key];
    delete nextPrice[key];
    setReviewQty(nextQty);
    setReviewUnitPrice(nextPrice);
  }

  async function cancelSelectedOrder() {
    if (!selected) return;
    const ok = window.confirm(
      `Cancel ${selected.orderNumber}? This also cancels the linked Sales Request.`
    );
    if (!ok) return;
    setActionBusy("cancel");
    try {
      await api(`/api/orders/${selected.id}?action=cancel`, {
        method: "PATCH",
        body: "{}",
      });
      toast.success("Sales Order and Sales Request cancelled");
      setSelected(null);
      await Promise.all([loadTasks(), loadInflight(), loadSreqs()]);
      setDeskTab("sreq");
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setActionBusy(null);
    }
  }

  async function runAction(
    action: string,
    _uiPanel?: string,
    actionUi?: typeof myNextActions[0]["ui"],
    collected?: Record<string, unknown>
  ) {
    if (!selected) return;
    setActionBusy(action);
    try {
      let body: Record<string, unknown> = collected ? { ...collected } : {};

      if (!collected) {
        const fields = actionUi?.fields ?? [];
        const perItemFields = fields.filter((f) => f.scope === "per-item" && f.type !== "readonly");
        const orderFields = fields.filter((f) => f.scope === "order");
        if (perItemFields.length > 0) {
          body = {
            items: (selected.items ?? []).map((item) => {
              const row: Record<string, unknown> = { orderItemId: item.id };
              for (const f of perItemFields) {
                const raw = stepInput(f.key, item.id);
                row[f.key] = f.type === "number" && raw ? Number(raw) : raw || undefined;
              }
              const readonlyFields = fields.filter(
                (f) => f.scope === "per-item" && f.type === "readonly"
              );
              for (const f of readonlyFields) {
                row[f.key] = (item as unknown as Record<string, unknown>)[f.source ?? f.key];
              }
              return row;
            }),
          };
        }
        for (const f of orderFields) {
          const raw = stepInput(f.key);
          body[f.key] = raw || undefined;
        }
      }

      // Normalize inventory payload shape
      if (action === "verify-stock" && Array.isArray(body.items)) {
        body.items = (body.items as Record<string, unknown>[]).map((row) => ({
          orderItemId: row.orderItemId ?? row.id,
          availableQty: Number(row.availableQty ?? 0),
        }));
      }
      if (action === "complete-pricing" && Array.isArray(body.items)) {
        body.items = (body.items as Record<string, unknown>[]).map((row) => ({
          orderItemId: row.orderItemId ?? row.id,
          purchasePrice: row.purchasePrice != null ? Number(row.purchasePrice) : undefined,
          unitPrice: row.unitPrice != null ? Number(row.unitPrice) : undefined,
        }));
      }
      if (action === "review" && body.deliveryDate) {
        const iso = dateInputToIso(String(body.deliveryDate));
        if (iso) body.deliveryDate = iso;
      }

      if (action === "confirm" && !Object.keys(body).length) {
        body = { warehouseId: "seed-warehouse-main" };
      }

      const r = await completeTaskOrPatch(action, body);
      toast.success(`Order ${selected.orderNumber} → ${r.data?.status}`);
      await Promise.all([openOrder(selected.id), loadTasks(), loadInflight()]);
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
    // Each role sees only their own workbench tab (no switching)
    return [roleToWorkbench(currentRole)] as WorkbenchKey[];
  }, [canSwitchWorkbench, currentRole]);

  const nextActions = selected?.nextActions ?? [];
  const myNextActions = nextActions.filter((a) => isMyRoleAction(a.roleHint));

  const prepTasks = (selected?.workflowRuntime?.tasks ?? []).filter(
    (t) => t.kind !== "SYSTEM"
  );

  const myPrepTasks = prepTasks.filter(
    (t) =>
      !t.assignedRole ||
      myTaskRoles.has(t.assignedRole) ||
      (isSalesLocked && t.assignedRole === "SALES_EXECUTIVE")
  );
  const otherPrepTasks = prepTasks.filter((t) => !myPrepTasks.some((m) => m.id === t.id));

  const openMyAction = (action: string) => {
    const fromRuntime = myPrepTasks.some(
      (t) => t.action === action && ["PENDING", "IN_PROGRESS", "READY", "CLAIMED"].includes(t.status)
    );
    const fromNext = myNextActions.some((a) => a.action === action);
    const fromQueue = tasks.some(
      (t) =>
        t.order.id === selected?.id &&
        t.action === action &&
        ["PENDING", "IN_PROGRESS", "READY", "CLAIMED"].includes(t.status)
    );
    return fromRuntime || fromNext || fromQueue;
  };

  // Build a single sorted list of actions available to the current user.
  // Sources: (1) myNextActions from API, (2) tasks queue for this order (catches post-PREP sequential actions)
  const myVisibleActions = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof myNextActions = [];

    // Helper: get blockedBy from the tasks queue for a given action on the current order
    const getBlockedBy = (action: string): string[] => {
      const t = tasks.find((t) => t.order.id === selected?.id && t.action === action);
      return t?.blockedBy ?? [];
    };

    // Source 1: nextActions from API (already have ui metadata from backend)
    for (const a of myNextActions) {
      if (seen.has(a.action)) continue;
      if (openMyAction(a.action)) {
        seen.add(a.action);
        result.push({ ...a, ui: a.ui, blockedBy: a.blockedBy ?? getBlockedBy(a.action) });
      }
    }

    // Source 2: tasks queue for this order (any human task assigned to my roles)
    for (const t of tasks) {
      if (t.order.id !== selected?.id) continue;
      if (seen.has(t.action)) continue;
      if (!myTaskRoles.has(t.assignedRole)) continue;
      if (!["PENDING", "IN_PROGRESS", "READY", "CLAIMED"].includes(t.status)) continue;
      seen.add(t.action);
      result.push({
        action: t.action,
        label: t.title,
        uiPanel: "none",
        roleHint: t.assignedRole,
        sortOrder: 999,
        blockedBy: t.blockedBy ?? [],
        ui: t.ui,
      });
    }

    // Source 3: workflowRuntime tasks (covers custom actions not in left queue yet)
    for (const t of selected?.workflowRuntime?.tasks ?? []) {
      if (seen.has(t.action)) continue;
      if (t.kind === "SYSTEM") continue;
      if (!myTaskRoles.has(t.assignedRole) && !(isSalesLocked && t.assignedRole === "SALES_EXECUTIVE")) {
        continue;
      }
      if (!["PENDING", "IN_PROGRESS", "READY", "CLAIMED"].includes(t.status)) continue;
      seen.add(t.action);
      result.push({
        action: t.action,
        label: t.title,
        uiPanel: "none",
        roleHint: t.assignedRole,
        sortOrder: 999,
        blockedBy: [],
        ui: undefined,
      });
    }

    return result.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myNextActions, isSalesLocked, selected?.id, selected?.workflowRuntime?.tasks, tasks, myTaskRoles]);

  const needsLineEditor = myVisibleActions.some(
    (a) =>
      a.action === "review" ||
      (a.ui?.layout ?? []).some(
        (w) =>
          w.widget === "CatalogSearch" ||
          (w.widget === "ProductList" &&
            (Boolean(w.props?.editable) || Boolean(w.props?.allowRemove)))
      )
  );
  const canEditLines =
    needsLineEditor && ["CONFIRMED", "FULFILLING"].includes(selected?.status ?? "");

  /** Group left-queue tasks by Sales Order (parent → child steps) */
  const workOrders = useMemo(() => {
    const map = new Map<
      string,
      {
        order: OrderSummary;
        tasks: WorkflowTask[];
        done: number;
        open: number;
        overdue: boolean;
      }
    >();
    const now = Date.now();
    for (const task of tasks) {
      const isOverdue = Boolean(
        task.dueAt && new Date(task.dueAt).getTime() < now && task.status !== "COMPLETED"
      );
      const cur = map.get(task.order.id);
      if (cur) {
        cur.tasks.push(task);
        if (task.status === "COMPLETED") cur.done += 1;
        else cur.open += 1;
        if (isOverdue) cur.overdue = true;
      } else {
        map.set(task.order.id, {
          order: task.order,
          tasks: [task],
          done: task.status === "COMPLETED" ? 1 : 0,
          open: task.status === "COMPLETED" ? 0 : 1,
          overdue: isOverdue,
        });
      }
    }
    const groups = Array.from(map.values()).map((g) => ({
      ...g,
      tasks: [...g.tasks].sort((a, b) => {
        const order = ["review", "verify-stock", "request-vendors", "complete-pricing", "warehouse-ready"];
        return order.indexOf(a.action) - order.indexOf(b.action);
      }),
    }));
    if (myWorkFilter === "overdue") return groups.filter((g) => g.overdue);
    return groups;
  }, [tasks, myWorkFilter]);

  const nextMyStep = myPrepTasks.find((t) =>
    ["PENDING", "IN_PROGRESS", "READY", "CLAIMED"].includes(t.status)
  );

  const myWorkOrderCount = useMemo(
    () => summary.orders || new Set(tasks.map((t) => t.order.id)).size,
    [summary.orders, tasks]
  );

  const customerSummary = selectedSreq?.customerSummary;
  const listLoadingLabel =
    deskTab === "sreq"
      ? `${sreqs.length} open`
      : deskTab === "inflight"
        ? `${inflightOrders.length} in flight`
        : myWorkFilter === "overdue"
          ? `${workOrders.length} overdue`
          : `${workOrders.length} order${workOrders.length === 1 ? "" : "s"}`;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Sales desk"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Sales desk" }]}
        primaryAction={
          deskTab === "sreq" &&
          selectedSreq?.status === "OPEN" &&
          !selectedSreq.salesOrder?.id ? (
            <button
              type="button"
              disabled={actionBusy === "convert" || customerSummary?.isBlocked === true}
              onClick={() => convertSreq(selectedSreq.id)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              {actionBusy === "convert" ? "Converting…" : "Convert to Sales Order"}
            </button>
          ) : undefined
        }
        secondaryActions={
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: "sreq" as const,
                  label: `Open SREQs (${sreqs.length})`,
                  onClick: () => {
                    setDeskTab("sreq");
                    setSelected(null);
                    setMyWorkFilter("all");
                  },
                },
                {
                  id: "tasks" as const,
                  label: `My work (${myWorkOrderCount})`,
                  onClick: () => {
                    setDeskTab("tasks");
                    setMyWorkFilter("all");
                  },
                },
                {
                  id: "inflight" as const,
                  label: `Sales orders (${inflightOrders.length})`,
                  onClick: () => {
                    setDeskTab("inflight");
                    setMyWorkFilter("all");
                    loadInflight().catch(reportError);
                  },
                },
              ] as const
            ).map((tab) => {
              const active = deskTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={tab.onClick}
                  className={
                    active
                      ? "inline-flex h-8 items-center rounded-lg bg-emerald-800 px-3 text-sm font-semibold text-white shadow-sm ring-2 ring-emerald-800 ring-offset-2"
                      : "inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  }
                >
                  {tab.label}
                </button>
              );
            })}
            {deskTab === "tasks" && canSwitchWorkbench &&
              visibleWorkbenches.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setWorkbench(key)}
                  className={
                    workbench === key
                      ? "inline-flex h-8 items-center rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white"
                      : "inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  }
                >
                  {WORKBENCH_LABELS[key]}
                </button>
              ))}
            {deskTab === "tasks" && canSwitchWorkbench && (
              <button
                type="button"
                onClick={() => setScope((s) => (s === "role" ? "mine" : "role"))}
                className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {scope === "role" ? "Team queue" : "Assigned to me"}
              </button>
            )}
          </div>
        }
      />

      <p className="text-sm text-slate-500 -mt-4">
        Documents: <strong className="text-slate-700">Sales Request (SREQ)</strong> → convert →{" "}
        <strong className="text-slate-700">Sales Order (SO)</strong>. Work on the SO is a checklist
        (review, stock, pricing…) — not a second document.
        {workflow?.name ? (
          <>
            {" "}
            Process pack: <strong className="text-slate-700">{workflow.name}</strong>
          </>
        ) : null}
      </p>

      {!workflow && (
        <Card className="border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No OMS workflow is active for this tenant. Apply OMS Trading (v3) first.
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
        <KpiCard
          label="Open SREQs"
          value={sreqs.length}
          icon={ClipboardList}
          color="amber"
          onClick={() => {
            setDeskTab("sreq");
            setSelected(null);
            setMyWorkFilter("all");
          }}
        />
        <KpiCard
          label="Orders in my work"
          value={myWorkOrderCount}
          icon={Loader2}
          color="blue"
          onClick={() => {
            setDeskTab("tasks");
            setMyWorkFilter("all");
            setSelected(null);
          }}
        />
        <KpiCard
          label="Sales orders"
          value={inflightOrders.length}
          icon={Plane}
          color="indigo"
          onClick={() => {
            setDeskTab("inflight");
            setMyWorkFilter("all");
            setSelected(null);
            loadInflight().catch(reportError);
          }}
        />
        <KpiCard
          label="Overdue"
          value={summary.overdue}
          icon={AlertCircle}
          color="red"
          onClick={() => {
            setDeskTab("tasks");
            setMyWorkFilter("overdue");
            setSelected(null);
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-6">
        {/* ── Left queue ─────────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-700 flex items-center justify-between">
            <span>
              {deskTab === "sreq"
                ? "Open sales requests"
                : deskTab === "inflight"
                  ? "Sales orders in progress"
                  : myWorkFilter === "overdue"
                    ? "Overdue orders in my work"
                    : isSalesLocked
                      ? "Orders needing your steps"
                      : `${WORKBENCH_LABELS[workbench]} queue`}
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-2">
              {deskTab === "tasks" && myWorkFilter === "overdue" && (
                <button
                  type="button"
                  className="text-emerald-700 underline"
                  onClick={() => setMyWorkFilter("all")}
                >
                  Show all
                </button>
              )}
              {loading ? "Loading…" : listLoadingLabel}
            </span>
          </div>

          {deskTab === "sreq" && (
            <ul className="divide-y divide-slate-100 max-h-[72vh] overflow-y-auto">
              {sreqs.map((sreq) => (
                <li key={sreq.id} className={selectedSreq?.id === sreq.id ? "bg-slate-50" : ""}>
                  <button
                    type="button"
                    onClick={() => openSreq(sreq.id)}
                    className="w-full px-4 pt-3 pb-2 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {sreq.requestNumber}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 truncate">
                          {sreq.customer?.name ?? "—"}
                        </div>
                      </div>
                      <StatusBadge status={sreq.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>{formatMoney(sreq.total)}</span>
                      {sreq.paymentMethod && (
                        <span className="text-slate-400">{sreq.paymentMethod}</span>
                      )}
                    </div>
                  </button>
                  {sreq.status === "OPEN" && (
                    <div className="px-4 pb-3">
                      <button
                        type="button"
                        disabled={actionBusy === "convert"}
                        onClick={(e) => {
                          e.stopPropagation();
                          void convertSreq(sreq.id);
                        }}
                        className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {actionBusy === "convert" ? "Converting…" : "Convert to Sales Order"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {!loading && sreqs.length === 0 && (
                <EmptyState
                  icon={ClipboardList}
                  title="No open requests"
                  subtitle="Customer checkouts create SREQs here."
                />
              )}
            </ul>
          )}

          {deskTab === "tasks" && (
            <ul className="divide-y divide-slate-100 max-h-[72vh] overflow-y-auto">
              {workOrders.map((group) => {
                const openTitles = group.tasks
                  .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
                  .map((t) => t.title);
                return (
                  <li key={group.order.id}>
                    <button
                      type="button"
                      onClick={() => openOrder(group.order.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                        selected?.id === group.order.id ? "bg-emerald-50/60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {group.order.orderNumber}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {group.order.customer?.name ?? "—"} · {formatMoney(group.order.total)}
                          </div>
                        </div>
                        <StatusBadge status={group.order.status} />
                      </div>

                      {/* Child tasks under the SO */}
                      <ul className="mt-3 ml-1 space-y-1.5 border-l-2 border-slate-200 pl-3">
                        {group.tasks.map((task) => {
                          const done = task.status === "COMPLETED";
                          const active = task.status === "IN_PROGRESS";
                          return (
                            <li
                              key={task.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span
                                className={
                                  done
                                    ? "text-slate-400 line-through"
                                    : active
                                      ? "font-medium text-emerald-800"
                                      : "text-slate-700"
                                }
                              >
                                {done ? "✓ " : active ? "● " : "○ "}
                                {task.title}
                              </span>
                              <span className="flex flex-col items-end gap-0.5">
                                <span
                                  className={
                                    done
                                      ? "text-emerald-600"
                                      : active
                                        ? "text-amber-600"
                                        : task.blockedBy && task.blockedBy.length > 0
                                          ? "text-orange-500"
                                          : "text-slate-400"
                                  }
                                >
                                  {done ? "Done" : active ? "In progress" : task.blockedBy && task.blockedBy.length > 0 ? "Blocked" : "To do"}
                                </span>
                                {!done && task.blockedBy && task.blockedBy.length > 0 && (
                                  <span className="text-[10px] text-orange-400 max-w-[140px] truncate" title={`Waiting for: ${task.blockedBy.join(", ")}`}>
                                    Waiting: {task.blockedBy.join(", ")}
                                  </span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {openTitles.length > 0 && (
                        <p className="mt-2 text-[11px] text-slate-400">
                          Open in detail to complete · {openTitles.join(" · ")}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
              {!loading && workOrders.length === 0 && (
                <EmptyState
                  icon={ClipboardList}
                  title="No orders in your queue"
                  subtitle="Convert an open SREQ to create a Sales Order with your steps."
                />
              )}
            </ul>
          )}

          {deskTab === "inflight" && (
            <ul className="divide-y divide-slate-100 max-h-[72vh] overflow-y-auto">
              {inflightOrders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => openOrder(order.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                      selected?.id === order.id ? "bg-slate-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {order.orderNumber}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 truncate">
                          {order.customer?.name ?? "—"}
                        </div>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-2 text-xs text-slate-600">{formatMoney(order.total)}</div>
                  </button>
                </li>
              ))}
              {!loading && inflightOrders.length === 0 && (
                <EmptyState
                  icon={PackageSearch}
                  title="No in-flight orders"
                  subtitle="Converted SOs appear here until closed or cancelled."
                />
              )}
            </ul>
          )}
        </Card>

        {/* ── Detail pane ────────────────────────────────────────────────── */}
        <Card className="p-5 space-y-5 min-h-[420px]">
          {/* Rich SREQ detail */}
          {deskTab === "sreq" && selectedSreq && !selected ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedSreq.requestNumber}</h2>
                  <p className="text-sm text-slate-500">
                    {customerSummary?.name ?? selectedSreq.customer?.name ?? "—"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Created {new Date(selectedSreq.createdAt).toLocaleString()}
                    {selectedSreq.paymentMethod ? ` · ${selectedSreq.paymentMethod}` : ""}
                  </p>
                  {selectedSreq.salesOrder && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Linked {selectedSreq.salesOrder.orderNumber} · {selectedSreq.salesOrder.status}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedSreq.status} />
                  <span className="text-sm font-medium text-slate-900">
                    {formatMoney(selectedSreq.total)}
                  </span>
                </div>
              </div>

              {/* Clear next-step guidance — primary CTA at top of detail */}
              {selectedSreq.status === "OPEN" && !selectedSreq.salesOrder?.id && (
                <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4 space-y-3">
                  <div>
                    <p className="text-base font-semibold text-emerald-950">
                      Next step: convert this request
                    </p>
                    <p className="mt-1 text-sm text-emerald-900/85">
                      SREQ is not an order yet. Review lines below, then convert to create the Sales
                      Order and start prep work.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={actionBusy === "convert" || customerSummary?.isBlocked === true}
                    title={
                      customerSummary?.isBlocked
                        ? "Customer is blocked — cannot convert"
                        : "Create Sales Order from this request"
                    }
                    onClick={() => convertSreq(selectedSreq.id)}
                    className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {actionBusy === "convert" ? "Converting…" : "Convert to Sales Order"}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-700 underline"
                    onClick={() => {
                      setShowRejectModal(true);
                      setRejectReason("");
                    }}
                  >
                    Or reject this request…
                  </button>
                </div>
              )}

              {selectedSreq.salesOrder?.id && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-emerald-950">Already converted</p>
                  <p className="text-sm text-emerald-900/80">
                    Linked {selectedSreq.salesOrder.orderNumber} ({selectedSreq.salesOrder.status}).
                    Continue checklist work on that Sales Order.
                  </p>
                  <Button
                    onClick={() => {
                      setDeskTab("tasks");
                      openOrder(selectedSreq.salesOrder!.id);
                    }}
                  >
                    Open {selectedSreq.salesOrder.orderNumber} in My work
                  </Button>
                </div>
              )}

              {/* Customer summary */}
              <div className="rounded-lg border border-slate-100 p-3 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700">
                  <div>
                    <span className="text-slate-400">Phone · </span>
                    {customerSummary?.phone ?? selectedSreq.customer?.phone ?? "—"}
                  </div>
                  <div>
                    <span className="text-slate-400">Email · </span>
                    {customerSummary?.email ?? selectedSreq.customer?.email ?? "—"}
                  </div>
                  <div>
                    <span className="text-slate-400">Credit limit · </span>
                    {formatMoney(customerSummary?.creditLimit)}
                  </div>
                  <div>
                    <span className="text-slate-400">Outstanding · </span>
                    {formatMoney(customerSummary?.outstandingBalance)}
                  </div>
                  <div>
                    <span className="text-slate-400">Portal · </span>
                    {customerSummary?.portalLinked ? "Linked" : "Not linked"}
                  </div>
                  <div>
                    <span className="text-slate-400">Blocked · </span>
                    {customerSummary?.isBlocked ? (
                      <span className="text-red-600">
                        Yes{customerSummary.blockedReason ? ` — ${customerSummary.blockedReason}` : ""}
                      </span>
                    ) : (
                      "No"
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery + notes */}
              <div className="space-y-2">
                <div className="rounded-lg border border-slate-100 p-3 text-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Delivery address
                  </h3>
                  <p className="text-slate-700">
                    {selectedSreq.deliveryAddressResolved ?? "—"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sales remarks
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 min-h-[80px]"
                    value={sreqNotes}
                    onChange={(e) => setSreqNotes(e.target.value)}
                    disabled={selectedSreq.status !== "OPEN"}
                    placeholder="Internal sales notes for this request…"
                  />
                </div>
              </div>

              {/* Editable lines */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Line items
                </h3>
                <div className="space-y-2">
                  {(selectedSreq.items ?? []).map((item, idx) => {
                    const key = itemKey(item, idx);
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-slate-100 p-3 text-sm space-y-2"
                      >
                        <div className="font-medium text-slate-800">{item.productName}</div>
                        <div className="flex flex-wrap items-end gap-3">
                          <Input
                            label="Qty"
                            className="w-28"
                            type="number"
                            min={1}
                            value={sreqItemQty[key] ?? String(item.quantity)}
                            onChange={(e) =>
                              setSreqItemQty({ ...sreqItemQty, [key]: e.target.value })
                            }
                            disabled={selectedSreq.status !== "OPEN"}
                          />
                          {canEditPrice ? (
                            <Input
                              label="Unit price"
                              className="w-32"
                              type="number"
                              min={0}
                              step="0.01"
                              value={sreqItemPrice[key] ?? String(item.unitPrice)}
                              onChange={(e) =>
                                setSreqItemPrice({ ...sreqItemPrice, [key]: e.target.value })
                              }
                              disabled={selectedSreq.status !== "OPEN"}
                            />
                          ) : (
                            <div className="text-xs text-slate-500 pb-2">
                              Unit price {formatMoney(item.unitPrice)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(selectedSreq.items ?? []).length === 0 && (
                    <p className="text-xs text-slate-400">No line items.</p>
                  )}
                </div>
              </div>

              {/* Customer order history (not linked to this SREQ until convert) */}
              {(selectedSreq.recentOrders?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-slate-100 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Customer history
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Other documents for this customer — not created from this request until you
                    convert.
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {selectedSreq.recentOrders!.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="text-left text-slate-700 hover:text-slate-900 truncate"
                          onClick={() => {
                            setDeskTab("inflight");
                            openOrder(o.id);
                          }}
                        >
                          {o.orderNumber}
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={o.status} />
                          <span className="text-xs text-slate-500">{formatMoney(o.total)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedSreq.status === "OPEN" && !selectedSreq.salesOrder?.id && (
                <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-slate-200 bg-white pt-4">
                  <button
                    type="button"
                    disabled={actionBusy === "convert" || customerSummary?.isBlocked === true}
                    onClick={() => convertSreq(selectedSreq.id)}
                    className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {actionBusy === "convert" ? "Converting…" : "Convert to Sales Order"}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      loading={actionBusy === "save-sreq"}
                      variant="outline"
                      onClick={() => saveSreqChanges(selectedSreq.id)}
                    >
                      Save changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRejectModal(true);
                        setRejectReason("");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Reject modal */}
              {showRejectModal && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-red-900">Reject sales request</h3>
                  <p className="text-xs text-red-700">
                    Provide a reason (min 3 characters). The customer will be notified.
                  </p>
                  <textarea
                    className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-300 min-h-[72px] bg-white"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection…"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      loading={actionBusy === "reject"}
                      onClick={() => rejectSreq(selectedSreq.id)}
                      disabled={rejectReason.trim().length < 3}
                    >
                      Confirm reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRejectModal(false);
                        setRejectReason("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : !selected ? (
            <EmptyState
              icon={PackageSearch}
              title={
                deskTab === "sreq"
                  ? "Select a sales request"
                  : deskTab === "inflight"
                    ? "Select an in-flight SO"
                    : "Select a sales order"
              }
              subtitle={
                deskTab === "sreq"
                  ? "Review customer, lines, and notes — then convert to create the Sales Order."
                  : deskTab === "inflight"
                    ? "Track converted orders through fulfillment and payment."
                    : "Pick an order on the left. Complete each step in the detail panel."
              }
            />
          ) : (
            /* ── SO detail ──────────────────────────────────────────────── */
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selected.orderNumber}</h2>
                  <p className="text-sm text-slate-500">{selected.customer?.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selected.salesRequest
                      ? `From ${selected.salesRequest.requestNumber}`
                      : selected.workflow?.name ?? "Sales order"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-sm font-medium text-slate-900">
                    {formatMoney(selected.total)}
                  </span>
                </div>
              </div>

              {/* Delivery tracking — shown for READY_FOR_DISPATCH and beyond */}
              {["READY_FOR_DISPATCH", "DISPATCHED", "DELIVERED", "INVOICED", "PAID", "CLOSED"].includes(selected.status) && (() => {
                const journey = [
                  { key: "READY_FOR_DISPATCH", label: "Ready" },
                  { key: "DISPATCHED", label: "Dispatched" },
                  { key: "DELIVERED", label: "Delivered" },
                  { key: "INVOICED", label: "Invoiced" },
                  { key: "PAID", label: "Paid" },
                  { key: "CLOSED", label: "Closed" },
                ];
                const statusOrder = journey.map((s) => s.key);
                const currentIdx = statusOrder.indexOf(selected.status);
                // Pull dispatch meta from workflowRuntime tasks or modifications
                const dispatchTask = (selected.workflowRuntime?.tasks ?? []).find((t) => t.action === "dispatch" && t.status === "COMPLETED");
                const deliverTask = (selected.workflowRuntime?.tasks ?? []).find((t) => t.action === "deliver-oms" && t.status === "COMPLETED");
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery journey</h3>
                    <ol className="flex flex-wrap items-center gap-2">
                      {journey.map((step, idx) => {
                        const done = idx <= currentIdx;
                        const current = idx === currentIdx;
                        return (
                          <li key={step.key} className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                              current ? "bg-emerald-700 text-white" : done ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-400 border border-slate-200"
                            }`}>
                              {done && !current && <span>✓</span>}
                              {step.label}
                            </span>
                            {idx < journey.length - 1 && <span className="text-slate-300">→</span>}
                          </li>
                        );
                      })}
                    </ol>
                    {(dispatchTask || deliverTask) && (
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100">
                        {dispatchTask && (
                          <span>
                            <span className="font-medium text-slate-700">Dispatched</span>{" "}
                            {dispatchTask.completedAt ? new Date(dispatchTask.completedAt).toLocaleString() : "—"}
                          </span>
                        )}
                        {deliverTask && (
                          <span>
                            <span className="font-medium text-slate-700">Delivered</span>{" "}
                            {deliverTask.completedAt ? new Date(deliverTask.completedAt).toLocaleString() : "—"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Visual flow: your steps on this SO */}
              {["CONFIRMED", "FULFILLING"].includes(selected.status) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Your path on this order
                    </h3>
                    {nextMyStep && (
                      <span className="text-[11px] font-medium text-emerald-700">
                        Now: {nextMyStep.title}
                      </span>
                    )}
                  </div>
                  <ol className="flex flex-wrap items-center gap-2 text-sm">
                    {(myPrepTasks.length > 0
                      ? myPrepTasks.map((t) => ({
                          id: t.id,
                          title: t.title,
                          status: t.status,
                          action: t.action,
                        }))
                      : []
                    ).map((task, idx, arr) => {
                      const done = task.status === "COMPLETED";
                      const current = Boolean(
                        !done && nextMyStep && (nextMyStep.id === task.id || nextMyStep.action === task.action)
                      );
                      return (
                        <li key={task.id} className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                              done
                                ? "bg-emerald-100 text-emerald-800"
                                : current
                                  ? "bg-emerald-700 text-white"
                                  : "bg-white text-slate-500 border border-slate-200"
                            }`}
                          >
                            <span className="opacity-70">{idx + 1}</span>
                            {task.title.replace(/^Complete\s+/i, "").replace(/^Send\s+/i, "")}
                          </span>
                          {idx < arr.length - 1 && (
                            <span className="text-slate-300" aria-hidden>
                              →
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {myPrepTasks.length === 0 && (
                    <p className="text-[11px] text-slate-400">
                      No human steps assigned to your role on this workflow.
                    </p>
                  )}
                  {otherPrepTasks.length > 0 && (
                    <p className="text-[11px] text-slate-400">
                      Other teams (view only):{" "}
                      {otherPrepTasks
                        .map(
                          (t) =>
                            `${t.title.replace(/^Complete\s+/i, "")} (${
                              t.status === "COMPLETED" ? "done" : "pending"
                            })`
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {/* Sticky current-step banner — driven by first visible action */}
                {myVisibleActions.length > 0 && (() => {
                  const cur = myVisibleActions[0];
                  const curUi = cur.ui;
                  const isBlocked = (cur.blockedBy ?? []).length > 0;
                  return (
                    <div className={`sticky top-0 z-20 -mx-1 rounded-xl border px-4 py-3 shadow-md ${isBlocked ? "border-orange-400 bg-orange-50 text-orange-900" : "border-emerald-700 bg-emerald-700 text-white"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-[11px] font-semibold uppercase tracking-wide ${isBlocked ? "text-orange-500" : "text-emerald-100"}`}>
                            {isBlocked ? "Waiting on other teams" : "Current step"}
                          </p>
                          <p className="text-sm font-semibold truncate">
                            {isBlocked
                              ? `Blocked by: ${cur.blockedBy!.join(", ")}`
                              : (curUi?.description ?? cur.label)}
                          </p>
                        </div>
                        {!isBlocked && (
                          <button
                            type="button"
                            disabled={Boolean(actionBusy)}
                            onClick={() => void runAction(cur.action, cur.uiPanel, curUi)}
                            className="shrink-0 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            {actionBusy ? "Working…" : (curUi?.confirmLabel ?? "Complete this step →")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Screen Controller → UI Runtime */}
                {myVisibleActions.map((act) => {
                    const ui = act.ui;
                    if ((act.blockedBy ?? []).length > 0) {
                      return (
                        <div
                          key={act.action}
                          className="rounded-xl border-2 border-orange-400 bg-orange-50 p-4 space-y-2"
                        >
                          <h3 className="text-base font-semibold text-orange-950">{act.label}</h3>
                          <p className="text-sm text-orange-800">
                            Waiting on: {act.blockedBy!.join(", ")}
                          </p>
                        </div>
                      );
                    }

                    const useDraftLines =
                      act.action === "review" ||
                      (ui?.layout ?? []).some(
                        (w) =>
                          w.widget === "CatalogSearch" ||
                          (w.widget === "ProductList" &&
                            (Boolean(w.props?.editable) || Boolean(w.props?.allowRemove)))
                      );

                    const items = useDraftLines
                      ? reviewLines.map((line) => ({
                          id: line.id ?? line.key,
                          productId: line.productId,
                          productName: line.productName,
                          quantity: Number(reviewQty[line.key] ?? line.quantity),
                          unitPrice: Number(reviewUnitPrice[line.key] ?? line.unitPrice),
                        }))
                      : (selected.items ?? []).map((i) => ({
                          id: i.id,
                          productId: i.productId,
                          productName: i.productName,
                          quantity: i.quantity,
                          unitPrice: i.unitPrice,
                          purchasePrice: i.purchasePrice,
                          availableQty: i.availableQty,
                        }));

                    const fieldValues = useDraftLines
                      ? {
                          ...stepInputs,
                          remarks: reviewRemarks,
                          deliveryDate: reviewDeliveryDate,
                          ...Object.fromEntries(
                            reviewLines.flatMap((line) => [
                              [`quantity:${line.id ?? line.key}`, reviewQty[line.key] ?? String(line.quantity)],
                              [`unitPrice:${line.id ?? line.key}`, reviewUnitPrice[line.key] ?? String(line.unitPrice)],
                            ])
                          ),
                        }
                      : stepInputs;

                    return (
                      <ScreenController
                        key={act.action}
                        action={act.action}
                        label={act.label}
                        ui={ui}
                        order={selected as unknown as Record<string, unknown>}
                        customer={selected.customer}
                        items={items}
                        canComplete={!actionBusy}
                        fieldValues={fieldValues}
                        setFieldValue={(key, value, itemId) => {
                          if (key === "remarks") {
                            setReviewRemarks(value);
                            return;
                          }
                          if (key === "deliveryDate") {
                            setReviewDeliveryDate(value);
                            return;
                          }
                          if (useDraftLines && itemId && (key === "quantity" || key === "unitPrice")) {
                            const line = reviewLines.find((l) => (l.id ?? l.key) === itemId || l.key === itemId);
                            if (!line) return;
                            if (key === "quantity") setReviewQty({ ...reviewQty, [line.key]: value });
                            else setReviewUnitPrice({ ...reviewUnitPrice, [line.key]: value });
                            return;
                          }
                          setStepInput(key, value, itemId);
                        }}
                        busy={Boolean(actionBusy)}
                        toast={{ success: toast.success, error: (m) => toast.error(m) }}
                        inventory={(selected.items ?? []).map((i) => ({
                          productId: i.productId,
                          productName: i.productName,
                          orderedQty: i.quantity,
                          availableQty: i.availableQty,
                          shortageQty: i.shortageQty,
                        }))}
                        timeline={(selected.workflowRuntime?.events ?? []).map((ev) => ({
                          id: ev.id,
                          type: ev.type,
                          title: [ev.type, ev.action, ev.toStatus].filter(Boolean).join(" · ") || ev.type,
                          at: ev.createdAt,
                          actor: ev.actorRole,
                          remarks: ev.remarks,
                        }))}
                        comments={(selected.modifications ?? [])
                          .filter((m) => m.remarks)
                          .map((m, i) => ({
                            id: `${m.action}-${m.createdAt}-${i}`,
                            body: m.remarks ?? "",
                            author: m.action,
                            at: m.createdAt,
                          }))}
                        hostApis={{
                          uploadFile: async (file) => {
                            const fd = new FormData();
                            fd.append("file", file);
                            const r = await api("/api/uploads/attachment", {
                              method: "POST",
                              body: fd,
                            });
                            const data = (r.data ?? r) as {
                              id?: string;
                              url?: string;
                              name?: string;
                              mimeType?: string;
                              size?: number;
                            };
                            return {
                              id: data.id ?? `att-${Date.now()}`,
                              name: data.name ?? file.name,
                              url: data.url,
                              mimeType: data.mimeType ?? file.type,
                              size: data.size ?? file.size,
                            };
                          },
                          addComment: async (body) => {
                            setStepInput("commentsAppend", body);
                          },
                        }}
                        onComplete={(payload) => void runAction(act.action, act.uiPanel, ui, payload)}
                        lineEditor={
                          useDraftLines
                            ? {
                                canAdd: canEditLines,
                                canRemove: canEditLines,
                                canEditPrice,
                                searchProducts: async (q) => {
                                  const r = await api(`/api/products?search=${encodeURIComponent(q)}&limit=8`);
                                  const rows = (r.data ?? r.items ?? []) as CatalogProduct[];
                                  return Array.isArray(rows) ? rows : [];
                                },
                                addProduct: (p) => addProductToReview(p),
                                removeLine: (lineId) => {
                                  const line = reviewLines.find((l) => (l.id ?? l.key) === lineId || l.key === lineId);
                                  if (line) void removeReviewLine(line.key);
                                },
                                cancelOrder: () => void cancelSelectedOrder(),
                              }
                            : undefined
                        }
                      />
                    );
                  })}

                {myVisibleActions.length === 0 && (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
                    <p>Your steps on this order are complete.</p>
                    {otherPrepTasks.some((t) => t.status !== "COMPLETED") ? (
                      <p className="text-xs text-orange-700">
                        Order stays in prep until other teams finish:{" "}
                        {otherPrepTasks
                          .filter((t) => t.status !== "COMPLETED")
                          .map((t) => t.title)
                          .join(", ")}
                        . Then dispatch can start.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Other teams continue the journey — track progress in the checklist below.
                      </p>
                    )}
                  </div>
                )}

                {/* Compact team checklist */}
                {prepTasks.length > 0 && (
                  <div className="rounded-lg border border-slate-100 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                      Full prep status
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {prepTasks.map((task) => {
                        const mine = myPrepTasks.some((m) => m.id === task.id);
                        return (
                          <li
                            key={task.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5"
                          >
                            <span className={mine ? "text-slate-800" : "text-slate-500"}>
                              {task.title}
                              {!mine && " · other team"}
                            </span>
                            <StatusBadge status={task.status} />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

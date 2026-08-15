"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ClipboardList,
  PackageSearch,
} from "lucide-react";
import {
  Button,
  Card,
  DetailPanel,
  EmptyState,
  Input,
  PageScaffold,
  QueuePanel,
  StatusBadge,
  WorkspaceBottomBar,
  WorkspaceLayout,
  useToast,
} from "@erp/ui";
import { api, getAdminUser, getTenantId, openAuthenticatedDocument } from "@/lib/admin-api";
import {
  buildLinePricingMeta,
  fetchPricingQuote,
} from "@/lib/pricing-quote";
import { ScreenController } from "@/lib/ui-runtime/ScreenController";
import { CommercialLineEditor } from "./commercial/CommercialLineEditor";
import { buildJourneySteps, buildWorkItemJourneySteps, JourneyTimeline } from "./panels/JourneyTimeline";
import { workItemKeyForActivity } from "@erp/workflow";
import { InboxQueue } from "./panels/InboxQueue";
import { MessagesQueue } from "./panels/MessagesQueue";
import { deskTabToStage, StageRail, stageToDeskTab, type DeskStage } from "./panels/StageRail";

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
  /** BL-035 Work Item fields when queue returns work items */
  workItemKey?: string;
  primaryTaskId?: string | null;
  primaryAction?: string | null;
  label?: string;
  key?: string;
  actionable?: boolean;
  activityKeys?: string[];
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
  date?: string;
  createdAt?: string;
  updatedAt?: string;
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
  customSnapshot?: Record<string, unknown> | null;
}

interface EditableLine {
  key: string;
  id?: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  /** Pricing engine meta nested under customSnapshot.pricing when persisting */
  pricingMeta?: ReturnType<typeof buildLinePricingMeta> | null;
  customSnapshot?: Record<string, unknown> | null;
}

interface CatalogProduct {
  id: string;
  name: string;
  sku?: string | null;
  sellPrice?: number | null;
  productStructure?: "SIMPLE" | "VARIANT" | null;
  customAttributes?: Record<string, unknown> | null;
}

interface CatalogVariant {
  id: string;
  sku: string;
  name: string;
  attributes?: Record<string, unknown> | null;
  costPrice?: number | null;
  sellPrice?: number | null;
}

interface OrderDetails extends Omit<OrderSummary, "customer"> {
  salesRemarks?: string | null;
  deliveryDate?: string | null;
  salesRequest?: {
    id: string;
    requestNumber: string;
    status: string;
    createdAt?: string;
  } | null;
  customer?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    creditLimit?: number;
    paymentTerms?: number;
    isBlocked?: boolean;
    blockedReason?: string | null;
    customerGroup?: string | null;
    portalUserId?: string | null;
    wallet?: number;
  } | null;
  orderNotes?: {
    id: string;
    body: string;
    authorUserId?: string | null;
    authorRole?: string | null;
    sourceStep?: string | null;
    createdAt: string;
  }[];
  documents?: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    createdAt: string;
  }[];
  workflow?: { id: string; code: string; name: string; templateId: string } | null;
  nextActions?: {
    action: string;
    label: string;
    uiPanel: string;
    roleHint: string | null;
    sortOrder: number;
    blockedBy?: string[];
    ui?: StepUi;
    stepKey?: string;
    taskId?: string;
  }[];
  workItems?: {
    key: string;
    label: string;
    status: string;
    actionable?: boolean;
    primaryAction?: string | null;
    primaryStepKey?: string | null;
    primaryTaskId?: string | null;
    activityKeys?: string[];
  }[];
  modifications?: { action: string; remarks?: string; createdAt: string }[];
  fulfillmentMode?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  porterBookingStatus?: string | null;
  vehicleInfo?: string | null;
  assignedDriverId?: string | null;
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
  documents?: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
  }[];
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

type DeskTab = "sreq" | "tasks" | "inflight" | "messages";

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

/** User-facing task copy — same actions, clearer verbs. */
function friendlyTaskLabel(action: string, fallback: string): string {
  const map: Record<string, string> = {
    review: "Confirm Order",
    "verify-stock": "Check Stock",
    "request-vendors": "Procurement Exception",
    "complete-pricing": "Pricing Review",
    "warehouse-ready": "Dispatch Order",
    dispatch: "Dispatch Order",
    "deliver-oms": "Confirm Delivery",
    invoice: "Bill & Collect",
    "collect-payment": "Bill & Collect",
  };
  return map[action] ?? fallback;
}

function workItemKeyForAction(action: string, stepKey?: string | null): string | null {
  if (stepKey) {
    const fromStep = workItemKeyForActivity(stepKey);
    if (fromStep) return fromStep;
  }
  const byAction: Record<string, string> = {
    review: "confirm_order",
    "verify-stock": "check_stock",
    "request-vendors": "procurement_exception",
    "complete-pricing": "pricing_review",
    "warehouse-ready": "dispatch_order",
    dispatch: "dispatch_order",
    "deliver-oms": "confirm_delivery",
    invoice: "bill_and_collect",
    "collect-payment": "bill_and_collect",
  };
  return byAction[action] ?? null;
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export function SalesDeskWorkspace({
  initialSreqId,
  initialSalesOrderId,
  initialStatus,
  initialFrom,
  initialTo,
  initialTab,
  initialTaskStatus,
  initialSreqStatus,
}: {
  initialSreqId?: string | null;
  initialSalesOrderId?: string | null;
  /** Dashboard chart deep-link: inflight | CONFIRMED | … */
  initialStatus?: string | null;
  /** YYYY-MM-DD — filter inflight orders by day range */
  initialFrom?: string | null;
  initialTo?: string | null;
  /** tasks | sreq | inflight | messages */
  initialTab?: string | null;
  initialTaskStatus?: string | null;
  initialSreqStatus?: string | null;
} = {}) {
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
    "ACCOUNTANT",
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
  const [messageConversationId, setMessageConversationId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
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
  /** Host-hydrated documents for task screens (invoice PDF, etc.). */
  const [taskDocuments, setTaskDocuments] = useState<
    Record<string, { id?: string; number?: string; pdfUrl?: string; status?: string }>
  >({});
  const [porterEnabled, setPorterEnabled] = useState(true);
  const [porterBookUrl, setPorterBookUrl] = useState("https://porter.in/");
  const [taskLookups, setTaskLookups] = useState<{
    warehouses: { id: string; label: string }[];
    drivers: { id: string; label: string }[];
  }>({ warehouses: [], drivers: [] });
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  /** Sync lock — React state alone cannot block double-clicks before re-render */
  const convertingRef = useRef(false);

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
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [reservedQty, setReservedQty] = useState<number | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInCustomerQuery, setWalkInCustomerQuery] = useState("");
  const [walkInCustomerHits, setWalkInCustomerHits] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
  const [walkInCustomerId, setWalkInCustomerId] = useState<string | null>(null);
  const [walkInCustomerName, setWalkInCustomerName] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInNotes, setWalkInNotes] = useState("");
  const [walkInLines, setWalkInLines] = useState<{ productId: string; productName: string; quantity: number; unitPrice: number }[]>([]);
  const [walkInProducts, setWalkInProducts] = useState<CatalogProduct[]>([]);
  const [walkInProductId, setWalkInProductId] = useState("");
  const [walkInQty, setWalkInQty] = useState("1");
  const [walkInBusy, setWalkInBusy] = useState(false);

  /* Sales review form (SO) */
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [reviewDeliveryDate, setReviewDeliveryDate] = useState("");
  const [reviewQty, setReviewQty] = useState<Record<string, string>>({});
  const [reviewUnitPrice, setReviewUnitPrice] = useState<Record<string, string>>({});
  const [reviewLines, setReviewLines] = useState<EditableLine[]>([]);
  /** MA3: phone = glance; Bill & Collect full edit stays tablet+ */
  const [phoneOps, setPhoneOps] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productHits, setProductHits] = useState<CatalogProduct[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [pricingWarning, setPricingWarning] = useState<string | null>(null);
  const [quotingProductId, setQuotingProductId] = useState<string | null>(null);
  const [variantPicker, setVariantPicker] = useState<{
    product: CatalogProduct;
    variants: CatalogVariant[];
  } | null>(null);
  const [variantPickerBusy, setVariantPickerBusy] = useState(false);

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
    setPricingWarning(null);
    const qty: Record<string, string> = {};
    const price: Record<string, string> = {};
    const lines: EditableLine[] = [];
    for (const item of order.items ?? []) {
      qty[item.id] = String(item.quantity);
      price[item.id] = String(item.unitPrice);
      const snap = item.customSnapshot ?? null;
      const pricing =
        snap && typeof snap === "object" && snap.pricing && typeof snap.pricing === "object"
          ? (snap.pricing as ReturnType<typeof buildLinePricingMeta>)
          : null;
      lines.push({
        key: item.id,
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customSnapshot: snap,
        pricingMeta: pricing,
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
    const want = (initialSreqStatus ?? "").trim().replaceAll(" ", "_").toUpperCase();
    const path =
      want && want !== "ALL"
        ? `/api/sales-requests?status=${encodeURIComponent(want)}&limit=50`
        : `/api/sales-requests?status=OPEN&limit=50`;
    const r = await api(path);
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
    let rows: OrderSummary[] = r.data ?? [];
    rows = rows.filter((o) => IN_FLIGHT_STATUSES.has(o.status));
    const statusFilter = (initialStatus ?? "").trim();
    if (statusFilter && statusFilter.toLowerCase() !== "inflight") {
      const want = statusFilter.replaceAll(" ", "_").toUpperCase();
      rows = rows.filter((o) => o.status === want);
    }
    const fromDay = (initialFrom ?? "").trim().slice(0, 10);
    const toDay = (initialTo ?? initialFrom ?? "").trim().slice(0, 10);
    if (fromDay) {
      rows = rows.filter((o) => {
        const day = String(o.date || o.updatedAt || o.createdAt || "").slice(0, 10);
        if (!day) return true;
        if (day < fromDay) return false;
        if (toDay && day > toDay) return false;
        return true;
      });
    }
    setInflightOrders(rows);
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
    void (async () => {
      await loadAll();
      if (initialSreqId) {
        setDeskTab("sreq");
        await openSreq(initialSreqId);
      } else if (initialSalesOrderId) {
        setDeskTab("inflight");
        await openOrder(initialSalesOrderId);
      } else if (initialTab === "tasks" || initialTaskStatus) {
        setDeskTab("tasks");
      } else if (initialTab === "sreq" || initialSreqStatus) {
        setDeskTab("sreq");
      } else if (
        initialTab === "inflight" ||
        initialTab === "messages" ||
        initialStatus ||
        initialFrom ||
        initialTo
      ) {
        setDeskTab(
          initialTab === "messages" ? "messages" : "inflight"
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhoneOps(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const soId = selectedSreq?.salesOrder?.id;
    if (!soId) {
      setReservedQty(null);
      return;
    }
    let alive = true;
    void api<{ meta?: { totalQty?: number } }>(`/api/stock/reserve?reference=${encodeURIComponent(soId)}`)
      .then((r) => {
        if (!alive) return;
        const qty = r.meta?.totalQty;
        setReservedQty(typeof qty === "number" ? qty : null);
      })
      .catch(() => {
        if (alive) setReservedQty(null);
      });
    return () => {
      alive = false;
    };
  }, [selectedSreq?.salesOrder?.id]);

  useEffect(() => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    void api(`/api/tenants/${tenantId}/settings`)
      .then((r) => {
        const settings = (r.data ?? {}) as Record<string, string>;
        if (settings["logistics.porter.enabled"] === "false") setPorterEnabled(false);
        const url = settings["logistics.porter.bookUrl"]?.trim();
        if (url) setPorterBookUrl(url);
      })
      .catch(() => undefined);
  }, []);

  /** Hydrate WarehousePicker / DriverPicker lookups for OMS task widgets. */
  useEffect(() => {
    const tenantId = getTenantId();
    let alive = true;
    void (async () => {
      const warehouses: { id: string; label: string }[] = [];
      const drivers: { id: string; label: string }[] = [];
      try {
        const wh = await api<{ data?: { id: string; name: string }[] }>("/api/warehouses?limit=100");
        for (const w of wh.data ?? []) {
          warehouses.push({ id: w.id, label: w.name });
        }
      } catch {
        /* picker shows empty */
      }
      if (tenantId) {
        try {
          const users = await api<{
            data?: { userId?: string; id?: string; name?: string | null; email?: string; role?: string }[];
          }>(`/api/tenants/${tenantId}/users?limit=100`);
          for (const u of users.data ?? []) {
            const role = (u.role ?? "").toUpperCase();
            if (role !== "DELIVERY_EXECUTIVE" && role !== "DISPATCH_EXECUTIVE") continue;
            const id = u.userId ?? u.id;
            if (!id) continue;
            drivers.push({
              id,
              label: u.name?.trim() || u.email || id,
            });
          }
        } catch {
          /* non-admin desks may 403 — DispatchFulfillment still has free-text driver */
        }
      }
      if (alive) setTaskLookups({ warehouses, drivers });
    })();
    return () => {
      alive = false;
    };
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
      setConfirmConvert(false);
      setReservedQty(null);
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
    if (convertingRef.current || actionBusy === "convert") return;
    convertingRef.current = true;
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
      const soNum = r.data?.soNumber ?? r.data?.salesOrder?.orderNumber;
      setConfirmConvert(false);
      toast.success(
        r.data?.alreadyConverted
          ? `Already converted → ${soNum}`
          : `Converted → ${soNum}`
      );
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
      convertingRef.current = false;
      setActionBusy(null);
    }
  }

  async function openWalkInForm() {
    setShowWalkIn(true);
    setWalkInCustomerQuery("");
    setWalkInCustomerHits([]);
    setWalkInCustomerId(null);
    setWalkInCustomerName("");
    setWalkInName("");
    setWalkInPhone("");
    setWalkInNotes("");
    setWalkInLines([]);
    setWalkInProductId("");
    setWalkInQty("1");
    try {
      const r = await api("/api/products?limit=100");
      setWalkInProducts(r.data ?? []);
    } catch (e: unknown) {
      reportError(e);
    }
  }

  async function searchWalkInCustomers(q: string) {
    setWalkInCustomerQuery(q);
    if (q.trim().length < 2) {
      setWalkInCustomerHits([]);
      return;
    }
    try {
      const r = await api(`/api/customers/search?q=${encodeURIComponent(q.trim())}`);
      setWalkInCustomerHits(r.data ?? []);
    } catch {
      setWalkInCustomerHits([]);
    }
  }

  function addWalkInLine() {
    const p = walkInProducts.find((x) => x.id === walkInProductId);
    if (!p) {
      toast.error("Select a product");
      return;
    }
    const quantity = Math.max(1, parseInt(walkInQty, 10) || 1);
    setWalkInLines((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        quantity,
        unitPrice: Number(p.sellPrice ?? 0),
      },
    ]);
    setWalkInProductId("");
    setWalkInQty("1");
  }

  async function submitWalkInOrder() {
    if (walkInLines.length === 0) {
      toast.error("Add at least one line");
      return;
    }
    if (!walkInCustomerId && !walkInName.trim()) {
      toast.error("Select an existing customer or enter a walk-in name");
      return;
    }
    setWalkInBusy(true);
    try {
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          sourceKind: "WALK_IN",
          customerId: walkInCustomerId ?? undefined,
          walkInName: walkInCustomerId ? undefined : walkInName.trim() || undefined,
          walkInPhone: walkInCustomerId ? undefined : walkInPhone.trim() || undefined,
          notes: walkInNotes.trim() || undefined,
          items: walkInLines,
        }),
      });
      const orderId = r.data?.id as string | undefined;
      toast.success(`Walk-in order ${r.data?.orderNumber ?? ""} created`);
      setShowWalkIn(false);
      await Promise.all([loadInflight(), loadTasks()]);
      if (orderId) {
        setSelectedSreq(null);
        setDeskTab("tasks");
        await openOrder(orderId);
        await loadTasks();
      }
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setWalkInBusy(false);
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
      inputs.fulfillmentMode = order.fulfillmentMode || "own_fleet";
      inputs.porterBookingStatus = order.porterBookingStatus || "NOT_BOOKED";
      inputs.carrier = order.carrier || "";
      inputs.trackingNumber = order.trackingNumber || "";
      inputs.trackingUrl = order.trackingUrl || "";
      inputs.vehicleInfo = order.vehicleInfo || "";
      inputs.assignedDriverId = order.assignedDriverId || "";
      // Hydrate linked invoice into TaskContext.documents + fieldValues mirror
      try {
        const invRes = await api(
          `/api/invoices?sourceRef=${encodeURIComponent(orderId)}&type=RECEIVABLE&limit=1`
        );
        const rows = (invRes.data ?? []) as Array<{
          id?: string;
          number?: string;
          pdfUrl?: string | null;
          status?: string;
        }>;
        const inv = Array.isArray(rows) ? rows[0] : undefined;
        if (inv?.id) {
          setTaskDocuments({
            invoice: {
              id: inv.id,
              number: inv.number,
              pdfUrl: inv.pdfUrl ?? undefined,
              status: inv.status,
            },
          });
          if (inv.pdfUrl) inputs.invoicePdfUrl = inv.pdfUrl;
          inputs.invoiceId = inv.id;
          if (inv.number) inputs.invoiceNumber = inv.number;
        } else {
          setTaskDocuments({});
        }
      } catch {
        setTaskDocuments({});
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
        (t.action === action || t.primaryAction === action) &&
        ["READY", "CLAIMED", "IN_PROGRESS", "PENDING"].includes(t.status)
    );
    return fromQueue?.primaryTaskId ?? fromQueue?.id;
  }

  function resolveWorkItemKeyForAction(action: string): string | null {
    const fromQueue = tasks.find(
      (t) =>
        t.order.id === selected?.id &&
        (t.action === action || t.primaryAction === action || t.workItemKey === action)
    );
    if (fromQueue?.workItemKey) return fromQueue.workItemKey;
    const fromWi = selected?.workItems?.find(
      (w) => w.primaryAction === action || w.key === action
    );
    if (fromWi?.key) return fromWi.key;
    const stepKey = selected?.nextActions?.find((a) => a.action === action)?.stepKey;
    return workItemKeyForAction(action, stepKey);
  }

  async function completeTaskOrPatch(
    action: string,
    body: Record<string, unknown>
  ): Promise<{ data?: { status?: string } }> {
    const workItemKey = resolveWorkItemKeyForAction(action);
    const isV5 = Boolean(selected?.workflowRuntime?.snapshot) || selected?.runtimePath === "v5";
    if (workItemKey && selected && isV5) {
      return api(`/api/workflow-work-items`, {
        method: "POST",
        body: JSON.stringify({
          salesOrderId: selected.id,
          workItemKey,
          ...body,
        }),
      });
    }
    const taskId = resolveTaskId(action);
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
      const items = reviewLines.map((line) => {
        const unitPrice = canEditPrice
          ? Math.max(0, Number(reviewUnitPrice[line.key] ?? line.unitPrice))
          : line.unitPrice;
        let customSnapshot = line.customSnapshot ? { ...line.customSnapshot } : undefined;
        if (line.pricingMeta) {
          const overridden =
            Math.abs(unitPrice - line.pricingMeta.quotedUnitPrice) > 0.0001;
          const snap = line.pricingMeta.pricingSnapshot;
          customSnapshot = {
            ...(customSnapshot ?? {}),
            pricing: {
              ...line.pricingMeta,
              pricingSnapshot: {
                ...snap,
                overridden: overridden || Boolean(snap && typeof snap === "object" && (snap as { overridden?: boolean }).overridden),
              },
            },
          };
        }
        return {
          id: line.id,
          productId: line.productId,
          productName: line.productName,
          variantId: line.variantId ?? undefined,
          quantity: Math.max(1, Math.round(Number(reviewQty[line.key] ?? line.quantity))),
          unitPrice,
          ...(customSnapshot ? { customSnapshot } : {}),
        };
      });
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

  async function addProductToReview(p: CatalogProduct) {
    if (p.productStructure === "VARIANT") {
      setQuotingProductId(p.id);
      try {
        const r = await api(`/api/products/${p.id}/variants?limit=100`);
        const variants = (r.data ?? []) as CatalogVariant[];
        if (!variants.length) {
          toast.error(`${p.name} has no variants — create size/SKU variants first`);
          return;
        }
        setVariantPicker({ product: p, variants });
        setProductSearch("");
        setProductHits([]);
      } catch (e: unknown) {
        reportError(e);
      } finally {
        setQuotingProductId(null);
      }
      return;
    }

    await commitReviewLine(p);
  }

  async function commitReviewLine(p: CatalogProduct, variant?: CatalogVariant) {
    const lineKeyMatch = (l: EditableLine) =>
      l.productId === p.id && (l.variantId ?? null) === (variant?.id ?? null);
    const exists = reviewLines.find(lineKeyMatch);
    if (exists) {
      const nextQty = exists.quantity + 1;
      setReviewLines(
        reviewLines.map((l) => (l.key === exists.key ? { ...l, quantity: nextQty } : l))
      );
      setReviewQty({ ...reviewQty, [exists.key]: String(nextQty) });
      setProductSearch("");
      setProductHits([]);
      setVariantPicker(null);
      toast.success(`Added ${variant ? variant.name : p.name}`);
      return;
    }

    setQuotingProductId(p.id);
    setVariantPickerBusy(true);
    try {
      const result = await fetchPricingQuote({
        productId: p.id,
        variantId: variant?.id,
        quantity: 1,
        attributes:
          (variant?.attributes as Record<string, unknown> | undefined) ??
          (p.customAttributes as Record<string, unknown> | undefined) ??
          undefined,
      });

      if (!result.ok && !result.soft) {
        toast.error(`Cannot add ${p.name}: ${result.error}`);
        return;
      }

      let unitPrice = Number(variant?.sellPrice ?? p.sellPrice ?? 0);
      let pricingMeta: ReturnType<typeof buildLinePricingMeta> | null = null;
      if (result.ok) {
        unitPrice = result.quote.unitPrice;
        pricingMeta = buildLinePricingMeta(result);
        setPricingWarning(null);
      } else {
        if ((variant?.sellPrice ?? p.sellPrice) == null) {
          toast.error(`Cannot add ${p.name}: ${result.error}`);
          return;
        }
        setPricingWarning(
          `Pricing service unavailable — using catalog sell price for ${p.name}. ${result.error}`
        );
        toast.error(`Pricing unavailable — used sell price for ${p.name}`);
      }

      const displayName = variant ? `${p.name} · ${variant.name}` : p.name;
      const key = `new-${p.id}-${variant?.id ?? "simple"}-${Date.now()}`;
      setReviewLines([
        ...reviewLines,
        {
          key,
          productId: p.id,
          productName: displayName,
          variantId: variant?.id ?? null,
          quantity: 1,
          unitPrice,
          pricingMeta,
          customSnapshot: pricingMeta ? { pricing: pricingMeta } : null,
        },
      ]);
      setReviewQty({ ...reviewQty, [key]: "1" });
      setReviewUnitPrice({ ...reviewUnitPrice, [key]: String(unitPrice) });
      setProductSearch("");
      setProductHits([]);
      setVariantPicker(null);
      toast.success(`Added ${displayName}`);
    } finally {
      setQuotingProductId(null);
      setVariantPickerBusy(false);
    }
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

      const fields = actionUi?.fields ?? [];
      const perItemFields = fields.filter((f) => f.scope === "per-item" && f.type !== "readonly");
      const orderFields = fields.filter((f) => f.scope === "order");
      const missingItems = !Array.isArray(body.items) || (body.items as unknown[]).length === 0;

      // Build per-item payload when ScreenController collected nothing useful
      // (FormFields used to skip per-item → empty {} still truthy).
      if (missingItems && perItemFields.length > 0) {
        body = {
          ...body,
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
        if (body[f.key] != null && body[f.key] !== "") continue;
        const raw = stepInput(f.key);
        if (raw) body[f.key] = raw;
      }

      // Bill & Collect: always pull payment fields from desk inputs (invoice or payment form)
      if (action === "invoice" || action === "collect-payment") {
        for (const key of ["paymentAmount", "paymentMethod", "paymentReference"] as const) {
          if (body[key] != null && body[key] !== "") continue;
          const raw = stepInput(key);
          if (raw) body[key] = key === "paymentAmount" ? Number(raw) : raw;
        }
      }

      // Normalize inventory payload shape
      if (action === "verify-stock") {
        const hasRows = Array.isArray(body.items) && (body.items as unknown[]).length > 0;
        const rows = (hasRows
          ? (body.items as Record<string, unknown>[])
          : (selected.items ?? []).map((item) => ({
              orderItemId: item.id,
              availableQty: Number(
                stepInput("availableQty", item.id) || item.availableQty || item.quantity || 0
              ),
            }))) as Record<string, unknown>[];
        body.items = rows.map((row) => {
          const id = String(row.orderItemId ?? row.id ?? "");
          const fromInput = id ? stepInput("availableQty", id) : "";
          const qty =
            row.availableQty != null && row.availableQty !== ""
              ? Number(row.availableQty)
              : Number(fromInput || 0);
          return {
            orderItemId: row.orderItemId ?? row.id,
            availableQty: Number.isFinite(qty) ? qty : 0,
          };
        });
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
      if (action === "review" && Array.isArray(body.items)) {
        body.items = (body.items as Record<string, unknown>[]).map((row) => {
          const productId = String(row.productId ?? "");
          const line =
            reviewLines.find(
              (l) =>
                l.productId === productId ||
                l.id === row.id ||
                l.key === row.id ||
                (l.id ?? l.key) === row.id
            ) ?? null;
          const unitPrice = Number(row.unitPrice ?? line?.unitPrice ?? 0);
          let customSnapshot = line?.customSnapshot
            ? { ...line.customSnapshot }
            : undefined;
          if (line?.pricingMeta) {
            const overridden =
              Math.abs(unitPrice - line.pricingMeta.quotedUnitPrice) > 0.0001;
            const snap = line.pricingMeta.pricingSnapshot;
            customSnapshot = {
              ...(customSnapshot ?? {}),
              pricing: {
                ...line.pricingMeta,
                pricingSnapshot: {
                  ...snap,
                  overridden:
                    overridden ||
                    Boolean(
                      snap &&
                        typeof snap === "object" &&
                        (snap as { overridden?: boolean }).overridden
                    ),
                },
              },
            };
          }
          return {
            id: row.id ?? line?.id,
            productId: row.productId ?? line?.productId,
            productName: row.productName ?? line?.productName,
            variantId: row.variantId ?? line?.variantId ?? undefined,
            quantity: Number(row.quantity ?? 1),
            unitPrice,
            ...(customSnapshot ? { customSnapshot } : {}),
          };
        });
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
        result.push({
          ...a,
          label: friendlyTaskLabel(a.action, a.label),
          ui: a.ui,
          blockedBy: a.blockedBy ?? getBlockedBy(a.action),
        });
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
        label: friendlyTaskLabel(t.action, t.title),
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
        label: friendlyTaskLabel(t.action, t.title),
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
    needsLineEditor &&
    ["CONFIRMED", "FULFILLING", "READY_FOR_DISPATCH", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED", "INVOICED"].includes(
      selected?.status ?? ""
    );

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
    const want = (initialTaskStatus ?? "").trim().replaceAll(" ", "_").toUpperCase();
    if (want) {
      const aliases = new Set([want]);
      if (want === "PENDING") aliases.add("READY");
      if (want === "READY") aliases.add("PENDING");
      return groups.filter((g) =>
        g.tasks.some((t) => aliases.has(String(t.status ?? "").toUpperCase()))
      );
    }
    return groups;
  }, [tasks, myWorkFilter, initialTaskStatus]);

  const nextMyStep = myPrepTasks.find((t) =>
    ["PENDING", "IN_PROGRESS", "READY", "CLAIMED"].includes(t.status)
  );

  const myWorkOrderCount = useMemo(
    () => summary.orders || new Set(tasks.map((t) => t.order.id)).size,
    [summary.orders, tasks]
  );

  const customerSummary = selectedSreq?.customerSummary;
  const detailOpen =
    deskTab === "sreq"
      ? Boolean(selectedSreq)
      : deskTab === "messages"
        ? Boolean(messageConversationId)
        : Boolean(selected);
  const listLoadingLabel =
    deskTab === "sreq"
      ? `${sreqs.length} open`
      : deskTab === "inflight"
        ? `${inflightOrders.length} in fulfillment`
        : deskTab === "messages"
          ? `${messageCount} chat${messageCount === 1 ? "" : "s"}`
          : myWorkFilter === "overdue"
            ? `${workOrders.length} overdue`
            : `${workOrders.length} order${workOrders.length === 1 ? "" : "s"}`;

  return (
    <PageScaffold
      wide
      hero={{
        eyebrow: "Trading operations",
        title: "Order Desk",
        description: "Process sales requests, complete your tasks, and move orders through fulfillment. Counter orders that need pick/dispatch use New walk-in order — pay-and-take stays on Quick Bill.",
        actions: (
          <div className="flex flex-wrap items-center gap-2">
            {(canSwitchWorkbench || isSalesLocked) && (
              <Button type="button" variant="secondary" onClick={() => void openWalkInForm()}>
                New walk-in order
              </Button>
            )}
            <a
              href="/admin/quick-bill"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-semibold text-[var(--ink)] shadow-[var(--shadow-1)] transition-[background,transform] duration-[var(--motion-fast)] hover:bg-[var(--surface-sunken)] active:scale-[var(--press-scale)]"
            >
              Quick Bill
            </a>
            <a
              href="/admin/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-semibold text-[var(--ink)] shadow-[var(--shadow-1)] transition-[background,transform] duration-[var(--motion-fast)] hover:bg-[var(--surface-sunken)] active:scale-[var(--press-scale)]"
            >
              ← Dashboard
            </a>
          </div>
        ),
      }}
    >
      <StageRail
        className="mb-6"
        stage={deskTabToStage(deskTab)}
        counts={{
          inbox: sreqs.length,
          mywork: myWorkOrderCount,
          active: inflightOrders.length,
          messages: messageCount,
        }}
        onChange={(stage: DeskStage) => {
          const tab = stageToDeskTab(stage);
          setDeskTab(tab);
          setMyWorkFilter("all");
          if (stage === "inbox") setSelected(null);
          if (stage === "active") loadInflight().catch(reportError);
          if (stage === "messages") {
            setSelected(null);
            setSelectedSreq(null);
          }
        }}
      />

      {deskTab === "tasks" && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMyWorkFilter((f) => (f === "overdue" ? "all" : "overdue"))}
            className={
              myWorkFilter === "overdue"
                ? "inline-flex h-8 items-center rounded-[var(--radius-sm)] bg-[var(--danger)] px-3 text-sm font-semibold text-[var(--ink-inverse)]"
                : "inline-flex h-8 items-center rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--mist)]"
            }
          >
            Overdue{summary.overdue ? ` (${summary.overdue})` : ""}
          </button>
          {canSwitchWorkbench &&
            visibleWorkbenches.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setWorkbench(key)}
                className={
                  workbench === key
                    ? "inline-flex h-8 items-center rounded-[var(--radius-sm)] bg-[var(--brand)] px-3 text-sm font-semibold text-[var(--ink-inverse)]"
                    : "inline-flex h-8 items-center rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--mist)]"
                }
              >
                {WORKBENCH_LABELS[key]}
              </button>
            ))}
          {canSwitchWorkbench && (
            <button
              type="button"
              onClick={() => setScope((s) => (s === "role" ? "mine" : "role"))}
              className="inline-flex h-8 items-center rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--mist)]"
            >
              {scope === "role" ? "Team queue" : "Assigned to me"}
            </button>
          )}
        </div>
      )}

      {!loading && !workflow ? (
        <div className="ws-empty mt-4">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-[var(--brand)]" aria-hidden />
          <h2>Apply OMS Trading template</h2>
          <p>
            Order Desk needs an active workflow before you can convert sales requests. Apply the
            trading process pack to continue.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {templates.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">No templates available. Check Process Studio.</p>
            ) : (
              templates.map((t) => (
                <Button key={t.templateId} type="button" onClick={() => applyTemplate(t.templateId)}>
                  Apply {t.name}
                </Button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {!workflow ? null : (
      <>
      <WorkspaceLayout
        detailOpen={detailOpen}
        onMobileBack={() => {
          setSelected(null);
          setSelectedSreq(null);
          setMessageConversationId(null);
        }}
        queue={
          <QueuePanel
            className="max-h-[72vh]"
            title={
              deskTab === "sreq"
                ? "Inbox"
                : deskTab === "inflight"
                  ? "Fulfillment"
                  : deskTab === "messages"
                    ? "Messages"
                    : myWorkFilter === "overdue"
                      ? "Overdue orders in my work"
                      : isSalesLocked
                        ? "Orders needing your steps"
                        : `${WORKBENCH_LABELS[workbench]} queue`
            }
            actions={
              <span className="text-xs text-[var(--ink-soft)] flex items-center gap-2">
                {deskTab === "tasks" && myWorkFilter === "overdue" && (
                  <button
                    type="button"
                    className="text-[var(--brand)] underline"
                    onClick={() => setMyWorkFilter("all")}
                  >
                    Show all
                  </button>
                )}
                {loading ? "Loading…" : listLoadingLabel}
              </span>
            }
          >

          {deskTab === "sreq" && (
            <InboxQueue
              sreqs={sreqs}
              selectedId={selectedSreq?.id}
              loading={loading}
              onSelect={(id) => void openSreq(id)}
              onRefresh={() => void loadSreqs()}
            />
          )}

          {deskTab === "messages" && (
            <MessagesQueue
              selectedId={messageConversationId}
              onCountChange={setMessageCount}
              onSelect={(id) => {
                setMessageConversationId(id);
                window.location.href = `/admin/messages`;
              }}
              onOpenFull={() => {
                window.location.href = `/admin/messages`;
              }}
            />
          )}

          {deskTab === "tasks" && (
            <ul className="divide-y divide-[var(--line)] max-h-[72vh] overflow-y-auto">
              {phoneOps && workOrders.length > 0 ? (
                <li className="sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--mist)] px-4 py-2.5 lg:hidden">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Needs action</p>
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {workOrders.length} order{workOrders.length === 1 ? "" : "s"}
                  </p>
                </li>
              ) : null}
              {workOrders.map((group) => {
                const openTitles = group.tasks
                  .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
                  .map((t) => friendlyTaskLabel(t.action, t.title));
                return (
                  <li key={group.order.id}>
                    <button
                      type="button"
                      onClick={() => openOrder(group.order.id)}
                      className={`relative w-full px-4 py-3 text-left transition-colors hover:bg-[var(--mist)] ${
                        selected?.id === group.order.id ? "bg-[var(--mist)]" : ""
                      }`}
                    >
                      {selected?.id === group.order.id ? (
                        <span className="absolute inset-y-0 left-0 w-0.5 bg-[var(--brand)]" aria-hidden />
                      ) : null}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--ink)] truncate">
                            {group.order.orderNumber}
                          </div>
                          <div className="text-xs text-[var(--ink-soft)] mt-0.5 truncate">
                            {group.order.customer?.name ?? "—"} · {formatMoney(group.order.total)}
                          </div>
                        </div>
                        <StatusBadge status={group.order.status} />
                      </div>

                      {/* Phone glance: next action only. Desktop: full task tree. */}
                      {phoneOps ? (
                        openTitles.length > 0 ? (
                          <p className="mt-3 rounded-md bg-[var(--mist)] px-3 py-2 text-sm font-semibold text-[var(--brand)]">
                            Next: {openTitles[0]}
                            {openTitles.length > 1 ? (
                              <span className="ml-1 font-normal text-[var(--ink-soft)]">
                                · +{openTitles.length - 1} more
                              </span>
                            ) : null}
                          </p>
                        ) : (
                          <p className="mt-3 text-xs text-[var(--ink-soft)]">All work items done</p>
                        )
                      ) : (
                        <>
                          <ul className="mt-3 ml-1 space-y-1.5 border-l-2 border-[var(--line)] pl-3">
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
                                        ? "text-[var(--ink-soft)] line-through"
                                        : active
                                          ? "font-medium text-[var(--brand)]"
                                          : "text-[var(--ink-soft)]"
                                    }
                                  >
                                    {done ? "✓ " : active ? "● " : "○ "}
                                    {friendlyTaskLabel(task.action, task.title)}
                                  </span>
                                  <span className="flex flex-col items-end gap-0.5">
                                    <span
                                      className={
                                        done
                                          ? "text-[var(--brand)]"
                                          : active
                                            ? "text-[var(--accent)]"
                                            : task.blockedBy && task.blockedBy.length > 0
                                              ? "text-[var(--danger)]"
                                              : "text-[var(--ink-soft)]"
                                      }
                                    >
                                      {done
                                        ? "Done"
                                        : active
                                          ? "In progress"
                                          : task.blockedBy && task.blockedBy.length > 0
                                            ? "Blocked"
                                            : "To do"}
                                    </span>
                                    {!done && task.blockedBy && task.blockedBy.length > 0 && (
                                      <span
                                        className="text-[10px] text-[var(--danger)] max-w-[140px] truncate"
                                        title={`Waiting for: ${task.blockedBy.join(", ")}`}
                                      >
                                        Waiting: {task.blockedBy.join(", ")}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          {openTitles.length > 0 && (
                            <p className="mt-2 text-[11px] text-[var(--ink-soft)]">
                              Open in detail to complete · {openTitles.join(" · ")}
                            </p>
                          )}
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
              {!loading && workOrders.length === 0 && (
                <EmptyState
                  icon={ClipboardList}
                  title="Nothing in My Work"
                  subtitle="Convert an Inbox request to get work on a Sales Order."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setDeskTab("sreq");
                        setSelected(null);
                      }}
                    >
                      Go to Inbox
                    </Button>
                  }
                />
              )}
            </ul>
          )}

          {deskTab === "inflight" && (
            <ul className="divide-y divide-[var(--line)] max-h-[72vh] overflow-y-auto">
              {phoneOps && inflightOrders.length > 0 ? (
                <li className="sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--mist)] px-4 py-2.5 lg:hidden">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink-soft)]">In flight</p>
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {inflightOrders.length} order{inflightOrders.length === 1 ? "" : "s"}
                  </p>
                </li>
              ) : null}
              {inflightOrders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => openOrder(order.id)}
                    className={`relative w-full px-4 py-3 text-left transition-colors hover:bg-[var(--mist)] ${
                      selected?.id === order.id ? "bg-[var(--mist)]" : ""
                    }`}
                  >
                    {selected?.id === order.id ? (
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-[var(--brand)]" aria-hidden />
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--ink)] truncate">
                          {order.orderNumber}
                        </div>
                        <div className="text-xs text-[var(--ink-soft)] mt-1 truncate">
                          {order.customer?.name ?? "—"}
                        </div>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-2 text-xs text-[var(--ink-soft)]">{formatMoney(order.total)}</div>
                  </button>
                </li>
              ))}
              {!loading && inflightOrders.length === 0 && (
                <EmptyState
                  icon={PackageSearch}
                  title="No fulfillment work"
                  subtitle="Orders ready for dispatch or already in flight appear here."
                  action={
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setDeskTab("tasks");
                        setSelected(null);
                      }}
                    >
                      Go to My Work
                    </Button>
                  }
                />
              )}
            </ul>
          )}
          </QueuePanel>
        }
        detail={
          <DetailPanel className="min-h-[420px]" aria-label="Document detail">
            <div className="space-y-6 p-5">
          {/* Rich SREQ detail */}
          {deskTab === "sreq" && selectedSreq && !selected ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ink)]">{selectedSreq.requestNumber}</h2>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {customerSummary?.name ?? selectedSreq.customer?.name ?? "—"}
                  </p>
                  <p className="text-xs text-[var(--ink-soft)] mt-1">
                    Created {new Date(selectedSreq.createdAt).toLocaleString()}
                    {selectedSreq.paymentMethod ? ` · ${selectedSreq.paymentMethod}` : ""}
                  </p>
                  {(selectedSreq.items?.length ?? 0) > 0 ? (
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">
                      {selectedSreq.items!.length} line
                      {selectedSreq.items!.length === 1 ? "" : "s"} ·{" "}
                      {selectedSreq.items!.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}{" "}
                      units from dealer quote
                      {reservedQty != null && reservedQty > 0
                        ? ` · ${reservedQty} units reserved`
                        : selectedSreq.salesOrder
                          ? " · reservation lookup unavailable"
                          : " · stock reserved at convert"}
                    </p>
                  ) : null}
                  {selectedSreq.salesOrder && (
                    <p className="text-xs text-[var(--brand)] mt-1">
                      Linked {selectedSreq.salesOrder.orderNumber} · {selectedSreq.salesOrder.status}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedSreq.status} />
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {formatMoney(selectedSreq.total)}
                  </span>
                </div>
              </div>

              <JourneyTimeline
                steps={buildJourneySteps({
                  status: selectedSreq.status,
                  converted: Boolean(selectedSreq.salesOrder?.id),
                })}
              />

              {selectedSreq.salesOrder?.id && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--mist)] p-4 space-y-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">Already converted</p>
                  <p className="text-sm text-[var(--ink)]/80">
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
              <div className="rounded-lg border border-[var(--line)] p-3 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                  Customer
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-[var(--ink-soft)]">
                  <div>
                    <span className="text-[var(--ink-soft)]">Phone · </span>
                    {customerSummary?.phone ?? selectedSreq.customer?.phone ?? "—"}
                  </div>
                  <div>
                    <span className="text-[var(--ink-soft)]">Email · </span>
                    {customerSummary?.email ?? selectedSreq.customer?.email ?? "—"}
                  </div>
                  <div>
                    <span className="text-[var(--ink-soft)]">Credit limit · </span>
                    {formatMoney(customerSummary?.creditLimit)}
                  </div>
                  <div>
                    <span className="text-[var(--ink-soft)]">Outstanding · </span>
                    {formatMoney(customerSummary?.outstandingBalance)}
                  </div>
                  <div>
                    <span className="text-[var(--ink-soft)]">Portal · </span>
                    {customerSummary?.portalLinked ? "Linked" : "Not linked"}
                  </div>
                  <div>
                    <span className="text-[var(--ink-soft)]">Blocked · </span>
                    {customerSummary?.isBlocked ? (
                      <span className="text-[var(--danger)]">
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
                <div className="rounded-lg border border-[var(--line)] p-3 text-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-1">
                    Delivery address
                  </h3>
                  <p className="text-[var(--ink-soft)]">
                    {selectedSreq.deliveryAddressResolved ?? "—"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">
                    Buyer / sales notes
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-slate-300 min-h-[80px]"
                    value={sreqNotes}
                    onChange={(e) => setSreqNotes(e.target.value)}
                    disabled={selectedSreq.status !== "OPEN"}
                    placeholder="Checkout delivery notes and internal sales remarks…"
                  />
                </div>
                {(selectedSreq.documents?.length ?? 0) > 0 ? (
                  <div className="rounded-lg border border-[var(--line)] p-3 text-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-2">
                      Buyer attachments
                    </h3>
                    <ul className="space-y-1">
                      {selectedSreq.documents!.map((d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            className="text-[var(--brand)] underline"
                            onClick={() => void openAuthenticatedDocument(d.fileUrl, d.fileName)}
                          >
                            {d.fileName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {/* Commercial lines */}
              <div>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  Commercial
                </h3>
                <CommercialLineEditor
                  lines={(selectedSreq.items ?? []).map((item, idx) => {
                    const key = itemKey(item, idx);
                    return {
                      key,
                      id: item.id,
                      productId: item.productId,
                      productName: item.productName,
                      quantity: Number(sreqItemQty[key] ?? item.quantity),
                      unitPrice: Number(sreqItemPrice[key] ?? item.unitPrice),
                      taxRate: item.taxRate ?? null,
                    };
                  })}
                  readOnly={selectedSreq.status !== "OPEN"}
                  onQuantityChange={
                    selectedSreq.status === "OPEN"
                      ? (key, quantity) =>
                          setSreqItemQty({ ...sreqItemQty, [key]: String(quantity) })
                      : undefined
                  }
                  onUnitPriceChange={
                    selectedSreq.status === "OPEN" && canEditPrice
                      ? (key, unitPrice) =>
                          setSreqItemPrice({ ...sreqItemPrice, [key]: String(unitPrice) })
                      : undefined
                  }
                  emptyLabel="No lines on this request"
                />
              </div>

              

              {/* Customer order history (not linked to this SREQ until convert) */}
              {(selectedSreq.recentOrders?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-[var(--line)] p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-1">
                    Customer history
                  </h3>
                  <p className="text-[11px] text-[var(--ink-soft)] mb-2">
                    Other documents for this customer — not created from this request until you
                    convert.
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {selectedSreq.recentOrders!.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="text-left text-[var(--ink-soft)] hover:text-[var(--ink)] truncate"
                          onClick={() => {
                            setDeskTab("inflight");
                            openOrder(o.id);
                          }}
                        >
                          {o.orderNumber}
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={o.status} />
                          <span className="text-xs text-[var(--ink-soft)]">{formatMoney(o.total)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}


              {/* Reject modal */}
              {showRejectModal && (
                <div className="rounded-lg border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface-raised))] p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--ink)]">Reject sales request</h3>
                  <p className="text-xs text-[var(--danger)]">
                    Provide a reason (min 3 characters). The customer will be notified.
                  </p>
                  <textarea
                    className="w-full rounded-lg border border-[var(--danger)]/30 px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--danger)] min-h-[72px] bg-white"
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
                  ? "Select a request from Inbox"
                  : deskTab === "inflight"
                    ? "Select a fulfillment order"
                    : deskTab === "messages"
                      ? "Select a chat from Messages"
                      : "Select an order from My Work"
              }
              subtitle={
                deskTab === "sreq"
                  ? "Review commercial lines, then use Convert in the action bar below."
                  : deskTab === "inflight"
                    ? "Track picking, dispatch, invoice, and payment on the journey."
                    : deskTab === "messages"
                      ? "WhatsApp-style threads live here. Pick a conversation or open full Messages."
                      : "Complete your workflow step using the action bar below."
              }
            />
          ) : (
            /* ── SO detail ──────────────────────────────────────────────── */
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ink)]">{selected.orderNumber}</h2>
                  <p className="text-sm text-[var(--ink-soft)]">{selected.customer?.name}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-1">
                    {selected.salesRequest
                      ? `From ${selected.salesRequest.requestNumber}`
                      : selected.workflow?.name ?? "Sales order"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {formatMoney(selected.total)}
                  </span>
                </div>
              </div>

              <JourneyTimeline
                steps={
                  selected.workItems?.length
                    ? buildWorkItemJourneySteps(selected.workItems)
                    : buildJourneySteps({
                        status: selected.status,
                        converted: true,
                        highlight:
                          myVisibleActions[0]?.action === "complete-pricing"
                            ? "pricing"
                            : myVisibleActions[0]?.action === "verify-stock"
                              ? "inventory"
                              : null,
                      })
                }
              />

              {/* Phase 1 host chrome: Customer + Messages (not form widgets) */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3 space-y-1.5">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    Customer
                  </h3>
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {selected.customer?.name ?? "—"}
                  </p>
                  {selected.customer?.phone ? (
                    <p className="text-xs text-[var(--ink-soft)]">📞 {selected.customer.phone}</p>
                  ) : null}
                  {selected.customer?.email ? (
                    <p className="text-xs text-[var(--ink-soft)]">✉ {selected.customer.email}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selected.customer?.isBlocked ? (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,white)] px-2 py-0.5 text-[10px] font-semibold text-[var(--danger)]">
                        Blocked
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--mist)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-soft)]">
                        Active
                      </span>
                    )}
                    {typeof selected.customer?.creditLimit === "number" ? (
                      <span className="text-[10px] text-[var(--ink-soft)]">
                        Credit {formatMoney(selected.customer.creditLimit)}
                      </span>
                    ) : null}
                  </div>
                  {(selected.orderNotes?.length ?? 0) > 0 || (selected.documents?.length ?? 0) > 0 ? (
                    <p className="text-[10px] text-[var(--ink-soft)] pt-1 border-t border-[var(--line)] mt-2">
                      {(selected.orderNotes?.length ?? 0) > 0
                        ? `${selected.orderNotes!.length} note${selected.orderNotes!.length === 1 ? "" : "s"}`
                        : null}
                      {(selected.orderNotes?.length ?? 0) > 0 && (selected.documents?.length ?? 0) > 0
                        ? " · "
                        : null}
                      {(selected.documents?.length ?? 0) > 0
                        ? `${selected.documents!.length} attachment${selected.documents!.length === 1 ? "" : "s"}`
                        : null}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-3 space-y-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    Messages
                  </h3>
                  <p className="text-xs text-[var(--ink-soft)]">
                    WhatsApp-style chat is under{" "}
                    <strong className="font-semibold text-[var(--ink)]">Communication → Messages</strong>{" "}
                    in the left sidebar (not task notes).
                  </p>
                  <a
                    href={`/admin/messages`}
                    className="inline-flex text-sm font-semibold text-[var(--brand)] hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/admin/messages`;
                    }}
                  >
                    Open Messages
                  </a>
                  <button
                    type="button"
                    className="block text-xs font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    onClick={async () => {
                      try {
                        const q = new URLSearchParams({
                          contextModule: "sales",
                          contextEntity: "SalesOrder",
                          contextId: selected.orderNumber,
                          status: "OPEN",
                        });
                        const r = await api(`/api/communication/conversations?${q}`);
                        const rows = (r.data ?? []) as Array<{ id?: string; title?: string | null }>;
                        if (rows[0]?.id) {
                          window.location.href = `/admin/messages`;
                          toast.success(`Found conversation for ${selected.orderNumber}`);
                        } else {
                          toast.success(
                            `No thread yet for ${selected.orderNumber} — open Messages to start one with SalesOrder context.`
                          );
                          window.location.href = `/admin/messages`;
                        }
                      } catch (err: unknown) {
                        reportError(err);
                      }
                    }}
                  >
                    Find / open order thread
                  </button>
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
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--mist)]/80 p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Delivery journey</h3>
                    <ol className="flex flex-wrap items-center gap-2">
                      {journey.map((step, idx) => {
                        const done = idx <= currentIdx;
                        const current = idx === currentIdx;
                        return (
                          <li key={step.key} className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                              current ? "bg-[var(--brand)] text-[var(--ink-inverse)]" : done ? "bg-[var(--mist)] text-[var(--brand)]" : "bg-white text-[var(--ink-soft)] border border-[var(--line)]"
                            }`}>
                              {done && !current && <span>✓</span>}
                              {step.label}
                            </span>
                            {idx < journey.length - 1 && <span className="text-[var(--ink-soft)]">→</span>}
                          </li>
                        );
                      })}
                    </ol>
                    {(dispatchTask || deliverTask || selected.trackingUrl || selected.fulfillmentMode) && (
                      <div className="flex flex-wrap gap-4 text-xs text-[var(--ink-soft)] pt-1 border-t border-[var(--line)]">
                        {selected.fulfillmentMode === "porter" ? (
                          <span>
                            <span className="font-medium text-[var(--ink-soft)]">Carrier</span> Porter
                            {selected.porterBookingStatus ? ` · ${selected.porterBookingStatus.replaceAll("_", " ")}` : ""}
                          </span>
                        ) : selected.vehicleInfo ? (
                          <span>
                            <span className="font-medium text-[var(--ink-soft)]">Vehicle</span> {selected.vehicleInfo}
                          </span>
                        ) : null}
                        {dispatchTask && (
                          <span>
                            <span className="font-medium text-[var(--ink-soft)]">Dispatched</span>{" "}
                            {dispatchTask.completedAt ? new Date(dispatchTask.completedAt).toLocaleString() : "—"}
                          </span>
                        )}
                        {deliverTask && (
                          <span>
                            <span className="font-medium text-[var(--ink-soft)]">Delivered</span>{" "}
                            {deliverTask.completedAt ? new Date(deliverTask.completedAt).toLocaleString() : "—"}
                          </span>
                        )}
                        {selected.trackingUrl ? (
                          <a
                            href={selected.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[var(--brand)] underline"
                          >
                            Track shipment
                          </a>
                        ) : selected.trackingNumber ? (
                          <span>
                            <span className="font-medium text-[var(--ink-soft)]">Tracking</span>{" "}
                            {selected.trackingNumber}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Visual flow: your steps on this SO */}
              {["CONFIRMED", "FULFILLING"].includes(selected.status) && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--mist)]/80 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                      Your path on this order
                    </h3>
                    {nextMyStep && (
                      <span className="text-[11px] font-medium text-[var(--brand)]">
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
                                ? "bg-[var(--mist)] text-[var(--brand)]"
                                : current
                                  ? "bg-[var(--brand)] text-white"
                                  : "bg-white text-[var(--ink-soft)] border border-[var(--line)]"
                            }`}
                          >
                            <span className="opacity-70">{idx + 1}</span>
                            {task.title.replace(/^Complete\s+/i, "").replace(/^Send\s+/i, "")}
                          </span>
                          {idx < arr.length - 1 && (
                            <span className="text-[var(--ink-soft)]" aria-hidden>
                              →
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {myPrepTasks.length === 0 && (
                    <p className="text-[11px] text-[var(--ink-soft)]">
                      No human steps assigned to your role on this workflow.
                    </p>
                  )}
                  {otherPrepTasks.length > 0 && (
                    <p className="text-[11px] text-[var(--ink-soft)]">
                      Other teams (view only):{" "}
                      {otherPrepTasks
                        .map(
                          (t) =>
                            `${t.title.replace(/^Complete\s+/i, "")} (${
                              t.status === "COMPLETED"
                                ? "done"
                                : t.status === "SKIPPED"
                                  ? "skipped"
                                  : "pending"
                            })`
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {/* Sticky current-step banner — driven by first visible action */}
                <div className="border-t border-[var(--line)] pt-4">
                  <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    Workflow
                  </h3>
                {myVisibleActions.length > 0 && (() => {
                  const cur = myVisibleActions[0];
                  const curUi = cur.ui;
                  const isBlocked = (cur.blockedBy ?? []).length > 0;
                  return (
                    <div
                      className={`rounded-[var(--radius-sm)] border px-4 py-3 ${
                        isBlocked
                          ? "border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface-raised))] text-[var(--ink)]"
                          : "border-[var(--line)] bg-[var(--mist)] text-[var(--ink)]"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                        {isBlocked ? "Waiting on other teams" : "Current step"}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {isBlocked
                          ? `Blocked by: ${cur.blockedBy!.join(", ")}`
                          : (curUi?.description ?? cur.label)}
                      </p>
                    </div>
                  );
                })()}

                {/* Screen Controller → UI Runtime */}
                {pricingWarning && (
                  <div className="rounded-lg border border-[var(--accent)]/40 bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface-raised))] px-3 py-2 text-sm text-[var(--ink)]">
                    {pricingWarning}
                    <button
                      type="button"
                      className="ml-2 text-[var(--ink-soft)] underline"
                      onClick={() => setPricingWarning(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {quotingProductId && (
                  <p className="text-xs text-[var(--ink-soft)]">Fetching price from pricing engine…</p>
                )}
                {myVisibleActions.map((act) => {
                    const ui = act.ui;
                    if ((act.blockedBy ?? []).length > 0) {
                      return (
                        <div
                          key={act.action}
                          className="rounded-xl border-2 border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface-raised))] p-4 space-y-2"
                        >
                          <h3 className="text-base font-semibold text-[var(--ink)]">{act.label}</h3>
                          <p className="text-sm text-[var(--ink-soft)]">
                            Waiting on: {act.blockedBy!.join(", ")}
                          </p>
                        </div>
                      );
                    }

                    const isBillCollect =
                      act.action === "invoice" || act.action === "collect-payment";
                    const phoneBillReadOnly = phoneOps && isBillCollect;

                    const useDraftLines =
                      !phoneBillReadOnly &&
                      (act.action === "review" ||
                        (ui?.layout ?? []).some(
                          (w) =>
                            w.widget === "CatalogSearch" ||
                            (w.widget === "ProductList" &&
                              (Boolean(w.props?.editable) || Boolean(w.props?.allowRemove)))
                        ));

                    const phoneUi =
                      phoneBillReadOnly && ui
                        ? {
                            ...ui,
                            layout: (ui.layout ?? []).map((w) => {
                              if (w.widget === "ProductList") {
                                return {
                                  ...w,
                                  props: { ...w.props, editable: false, allowRemove: false },
                                };
                              }
                              // Defer generate / line edit widgets — status + download still ok
                              if (
                                w.widget === "InvoiceGenerate" ||
                                w.widget === "InvoiceLines" ||
                                w.widget === "CatalogSearch"
                              ) {
                                return { ...w, props: { ...w.props, phoneDeferred: true } };
                              }
                              return w;
                            }),
                          }
                        : ui;

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
                      <div key={act.action} className="space-y-3">
                        {phoneBillReadOnly ? (
                          <div className="rounded-xl border border-[var(--line)] bg-[var(--mist)] p-3 text-sm text-[var(--ink)]">
                            <p className="font-semibold">Bill &amp; Collect on phone</p>
                            <p className="mt-1 text-[var(--ink-soft)]">
                              View status and invoice here. Edit lines, generate PDF, and record advance on a tablet or desktop.
                            </p>
                          </div>
                        ) : null}
                      <ScreenController
                        action={act.action}
                        label={act.label}
                        ui={phoneUi}
                        variables={{ porterEnabled, porterBookUrl }}
                        order={selected as unknown as Record<string, unknown>}
                        customer={selected.customer}
                        items={items}
                        canComplete={!actionBusy && !phoneBillReadOnly}
                        fieldValues={fieldValues}
                        lookups={taskLookups}
                        documents={taskDocuments}
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
                        comments={(selected.orderNotes ?? []).map((n) => ({
                          id: n.id,
                          body: n.body,
                          author: n.authorRole ?? n.authorUserId ?? "note",
                          at: n.createdAt,
                        }))}
                        attachments={(selected.documents ?? []).map((d) => ({
                          id: d.id,
                          name: d.fileName,
                          url: d.fileUrl,
                          mimeType: d.mimeType ?? undefined,
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
                            const text = String(body ?? "").trim();
                            if (!text || !selected) return;
                            const primary =
                              myVisibleActions[0]?.action ??
                              selected.workItems?.find((w) => w.actionable)?.primaryAction ??
                              null;
                            await api(`/api/orders/${selected.id}/notes`, {
                              method: "POST",
                              body: JSON.stringify({
                                body: text,
                                sourceStep: primary,
                              }),
                            });
                            await openOrder(selected.id);
                          },
                          updateComment: async (noteId, body) => {
                            const text = String(body ?? "").trim();
                            if (!text || !selected) return;
                            await api(`/api/orders/${selected.id}/notes/${noteId}`, {
                              method: "PATCH",
                              body: JSON.stringify({ body: text }),
                            });
                            await openOrder(selected.id);
                          },
                          deleteComment: async (noteId) => {
                            if (!selected) return;
                            await api(`/api/orders/${selected.id}/notes/${noteId}`, {
                              method: "DELETE",
                            });
                            await openOrder(selected.id);
                          },
                          deleteAttachment: async (docId) => {
                            if (!selected) return;
                            const persisted = (selected.documents ?? []).some((d) => d.id === docId);
                            if (!persisted) return;
                            await api(`/api/orders/${selected.id}/documents/${docId}`, {
                              method: "DELETE",
                            });
                            await openOrder(selected.id);
                          },
                          openDocument: async (url, fileName) => {
                            await openAuthenticatedDocument(url, fileName ?? "invoice.pdf");
                          },
                          invokeDomainCommand: async (args) => {
                            if (args.command !== "accounting.generateInvoice") {
                              return { ok: false, error: `Unknown command: ${args.command}` };
                            }
                            const orderId = String(selected.id ?? "");
                            if (!orderId) return { ok: false, error: "No sales order" };
                            try {
                              // Persist desk line edits so invoice PDF uses updated qty/price
                              const linePayload = reviewLines.map((line) => ({
                                id: line.id,
                                quantity: Number(reviewQty[line.key] ?? line.quantity),
                                unitPrice: Number(reviewUnitPrice[line.key] ?? line.unitPrice),
                              })).filter((l) => l.id);
                              if (linePayload.length > 0) {
                                await api(`/api/orders/${orderId}/invoice-lines`, {
                                  method: "PUT",
                                  body: JSON.stringify({ items: linePayload }),
                                });
                              }
                              const r = await api("/api/invoices/generate", {
                                method: "POST",
                                body: JSON.stringify({
                                  salesOrderId: orderId,
                                  documentRef: args.documentRef ?? {
                                    type: "DOCUMENT",
                                    id: "tax-invoice",
                                    version: 1,
                                  },
                                  issue: true,
                                  force: Boolean(args.force),
                                  payloadBuilder: args.payloadBuilder ?? "accounting.invoice",
                                  payloadOverrides: args.payloadOverrides,
                                  formValues: stepInputs,
                                }),
                              });
                              const data = (r.data ?? r) as {
                                invoice?: { id?: string; number?: string; pdfUrl?: string; status?: string };
                                pdfUrl?: string;
                              };
                              const pdfUrl = data.pdfUrl ?? data.invoice?.pdfUrl;
                              const invoiceId = data.invoice?.id;
                              const invoiceNumber = data.invoice?.number;
                              if (invoiceId) {
                                setTaskDocuments({
                                  invoice: {
                                    id: invoiceId,
                                    number: invoiceNumber,
                                    pdfUrl: pdfUrl ?? undefined,
                                    status: data.invoice?.status,
                                  },
                                });
                              }
                              if (pdfUrl) setStepInput("invoicePdfUrl", pdfUrl);
                              if (invoiceId) setStepInput("invoiceId", invoiceId);
                              if (invoiceNumber) setStepInput("invoiceNumber", invoiceNumber);
                              await openOrder(orderId);
                              return {
                                ok: true,
                                invoiceId,
                                invoiceNumber,
                                pdfUrl,
                                data: data as Record<string, unknown>,
                              };
                            } catch (e) {
                              return {
                                ok: false,
                                error: e instanceof Error ? e.message : "Generate failed",
                              };
                            }
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
                      </div>
                    );
                  })}

                {myVisibleActions.length === 0 && (
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--mist)] p-4 text-sm text-[var(--ink-soft)] space-y-1">
                    <p>Your steps on this order are complete.</p>
                    {otherPrepTasks.some(
                      (t) => t.status !== "COMPLETED" && t.status !== "SKIPPED"
                    ) ? (
                      <p className="text-xs text-[var(--danger)]">
                        Order stays in prep until other teams finish:{" "}
                        {otherPrepTasks
                          .filter((t) => t.status !== "COMPLETED" && t.status !== "SKIPPED")
                          .map((t) => t.title)
                          .join(", ")}
                        . Then dispatch can start.
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--ink-soft)]">
                        Other teams continue the journey — track progress in the checklist below.
                      </p>
                    )}
                  </div>
                )}

                </div>

                {/* Compact team checklist */}
                {prepTasks.length > 0 && (
                  <div className="rounded-lg border border-[var(--line)] p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-2">
                      Full prep status
                    </h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {prepTasks.map((task) => {
                        const mine = myPrepTasks.some((m) => m.id === task.id);
                        return (
                          <li
                            key={task.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-[var(--mist)] px-2 py-1.5"
                          >
                            <span className={mine ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"}>
                              {friendlyTaskLabel(task.action, task.title)}
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
            </div>
          </DetailPanel>
        }
        bottomBar={
          <WorkspaceBottomBar>
            {deskTab === "sreq" && selectedSreq?.status === "OPEN" && !selectedSreq.salesOrder?.id ? (
              confirmConvert ? (
              <>
                <p className="mr-auto min-w-0 text-sm text-[var(--ink)]">
                  Convert <span className="font-semibold">{selectedSreq.requestNumber}</span>
                  {" · "}
                  {customerSummary?.name ?? selectedSreq.customer?.name ?? "customer"}
                  {" · "}
                  {selectedSreq.items?.length ?? 0} line
                  {(selectedSreq.items?.length ?? 0) === 1 ? "" : "s"}
                  {" · "}
                  {formatMoney(selectedSreq.total)}?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmConvert(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[10rem] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  loading={actionBusy === "convert"}
                  disabled={customerSummary?.isBlocked === true}
                  onClick={() => void convertSreq(selectedSreq.id)}
                >
                  Confirm convert
                </Button>
              </>
              ) : (
              <>
                <p className="mr-auto text-sm text-[var(--ink-soft)]">
                  Next: convert this request into a Sales Order
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={actionBusy === "save-sreq"}
                  onClick={() => void saveSreqChanges(selectedSreq.id)}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[var(--ink-soft)] hover:text-[var(--danger)]"
                  onClick={() => {
                    setShowRejectModal(true);
                    setRejectReason("");
                  }}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[10rem] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  disabled={customerSummary?.isBlocked === true}
                  title={
                    customerSummary?.isBlocked
                      ? "Customer is blocked — cannot convert"
                      : "Create Sales Order from this request"
                  }
                  onClick={() => setConfirmConvert(true)}
                >
                  Convert to Sales Order
                </Button>
              </>
              )
            ) : deskTab === "tasks" && selected && myVisibleActions[0] ? (
              <>
                <p className="mr-auto min-w-0 truncate text-sm text-[var(--ink-soft)]">
                  {myVisibleActions[0].label ?? "Complete your step"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  loading={Boolean(actionBusy)}
                  onClick={() =>
                    void runAction(
                      myVisibleActions[0].action,
                      myVisibleActions[0].uiPanel,
                      myVisibleActions[0].ui
                    )
                  }
                >
                  {myVisibleActions[0].ui?.confirmLabel ?? "Complete"}
                </Button>
              </>
            ) : deskTab === "inflight" && selected ? (
              <>
                <p className="mr-auto text-sm text-[var(--ink-soft)]">
                  {selected.orderNumber} · {selected.status}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDeskTab("tasks");
                    void openOrder(selected.id);
                  }}
                >
                  Open in My Work
                </Button>
              </>
            ) : (
              <p className="mr-auto text-sm text-[var(--ink-soft)]">
                {deskTab === "sreq"
                  ? "Select a request to convert"
                  : deskTab === "tasks"
                    ? "Select an order to complete your step"
                    : "Select a fulfillment order"}
              </p>
            )}
          </WorkspaceBottomBar>
        }
      />

      {showWalkIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink)]">New walk-in order</h3>
                <p className="text-xs text-[var(--ink-soft)]">
                  Creates a confirmed sales order and starts fulfilment. For pay-and-take now, use Quick Bill.
                </p>
              </div>
              <button type="button" className="text-[var(--ink-soft)]" onClick={() => setShowWalkIn(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="space-y-3 p-4">
              <label className="block text-xs text-[var(--ink-soft)]">
                Existing customer
                <input
                  className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={walkInCustomerQuery}
                  onChange={(e) => void searchWalkInCustomers(e.target.value)}
                  placeholder="Search name or phone"
                />
              </label>
              {walkInCustomerHits.length > 0 && (
                <ul className="max-h-32 overflow-y-auto rounded-lg border border-[var(--line)] text-sm">
                  {walkInCustomerHits.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-[var(--mist)]"
                        onClick={() => {
                          setWalkInCustomerId(c.id);
                          setWalkInCustomerName(c.name);
                          setWalkInCustomerQuery(c.name);
                          setWalkInCustomerHits([]);
                        }}
                      >
                        {c.name}{c.phone ? ` · ${c.phone}` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {walkInCustomerId ? (
                <p className="text-xs text-[var(--success)]">
                  Using {walkInCustomerName}.{" "}
                  <button type="button" className="underline" onClick={() => { setWalkInCustomerId(null); setWalkInCustomerName(""); setWalkInCustomerQuery(""); }}>
                    Clear
                  </button>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs text-[var(--ink-soft)]">
                    Walk-in name
                    <input
                      className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      placeholder="Required if no existing customer"
                    />
                  </label>
                  <label className="block text-xs text-[var(--ink-soft)]">
                    Phone
                    <input
                      className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <label className="block text-xs text-[var(--ink-soft)]">
                Product
                <select
                  className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={walkInProductId}
                  onChange={(e) => setWalkInProductId(e.target.value)}
                >
                  <option value="">Select product</option>
                  {walkInProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.sellPrice != null ? ` · ₹${p.sellPrice}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <input
                  className="w-24 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  type="number"
                  min={1}
                  value={walkInQty}
                  onChange={(e) => setWalkInQty(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={addWalkInLine}>
                  Add line
                </Button>
              </div>
              {walkInLines.length > 0 && (
                <ul className="divide-y rounded-lg border border-[var(--line)] text-sm">
                  {walkInLines.map((line, idx) => (
                    <li key={`${line.productId}-${idx}`} className="flex items-center justify-between px-3 py-2">
                      <span>{line.productName} × {line.quantity}</span>
                      <button type="button" className="text-xs text-[var(--danger)]" onClick={() => setWalkInLines((ls) => ls.filter((_, i) => i !== idx))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="block text-xs text-[var(--ink-soft)]">
                Notes
                <textarea
                  className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={walkInNotes}
                  onChange={(e) => setWalkInNotes(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowWalkIn(false)}>
                  Cancel
                </Button>
                <Button type="button" loading={walkInBusy} onClick={() => void submitWalkInOrder()}>
                  Create order
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {variantPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink)]">Select variant</h3>
                <p className="text-xs text-[var(--ink-soft)]">{variantPicker.product.name}</p>
              </div>
              <button
                type="button"
                className="text-[var(--ink-soft)] hover:text-[var(--ink-soft)]"
                onClick={() => setVariantPicker(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-[var(--line)]">
              {variantPicker.variants.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={variantPickerBusy}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--mist)] disabled:opacity-50"
                    onClick={() => void commitReviewLine(variantPicker.product, v)}
                  >
                    <span>
                      <span className="block text-sm font-medium text-[var(--ink)]">{v.name}</span>
                      <span className="block font-mono text-xs text-[var(--ink-soft)]">{v.sku}</span>
                      {v.attributes && (
                        <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">
                          {Object.entries(v.attributes)
                            .map(([k, val]) => `${k}=${val}`)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-[var(--brand)] shrink-0">
                      {variantPickerBusy ? "…" : "Add"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      </>
      )}
    </PageScaffold>
  );
}

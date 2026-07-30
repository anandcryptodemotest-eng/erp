"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormDefinition } from "@erp/workflow";
import type { WorkflowTimelineEvent } from "@erp/ui-runtime";
import { api } from "@/lib/api-client";
import { addToCart, clearCart } from "@/lib/cart-store";
import {
  OMS_TRACKER_STEPS,
  SREQ_TRACKER_STEPS,
  customerCanCancelRequest,
  omsLabel,
  sreqLabel,
} from "@/lib/oms-status";
import {
  CustomerScreenController,
  createCustomerHost,
} from "@/lib/ui-host/CustomerScreenController";

interface LineItem {
  id: string;
  productId: string;
  productName?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  unitPrice: number;
  total: number;
  sku?: string;
}

interface SalesRequestDetail {
  id: string;
  requestNumber: string;
  status: string;
  total: number;
  subtotal: number;
  tax?: number;
  deliveryFee: number;
  couponDiscount: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string | null;
  createdAt: string;
  deliveryAddressText?: string | null;
  rejectReason?: string | null;
  soStatus?: string | null;
  soNumber?: string | null;
  items: LineItem[];
  salesOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    total: number;
  } | null;
}

function buildTimeline(row: SalesRequestDetail): WorkflowTimelineEvent[] {
  const events: WorkflowTimelineEvent[] = [
    {
      id: "created",
      type: "CREATED",
      title: "Sales request submitted",
      at: row.createdAt,
      remarks: sreqLabel(row.status),
    },
  ];
  if (row.status === "REJECTED") {
    events.push({
      id: "rejected",
      type: "REJECTED",
      title: "Rejected",
      at: row.createdAt,
      remarks: row.rejectReason ?? undefined,
    });
  }
  if (row.status === "CANCELLED") {
    events.push({
      id: "cancelled",
      type: "CANCELLED",
      title: "Cancelled",
      at: row.createdAt,
    });
  }
  const soStatus = row.salesOrder?.status ?? row.soStatus;
  const soNumber = row.salesOrder?.orderNumber ?? row.soNumber;
  if (row.status === "CONVERTED" && soStatus) {
    events.push({
      id: "converted",
      type: "CONVERTED",
      title: `Order created${soNumber ? ` (${soNumber})` : ""}`,
      at: row.createdAt,
      remarks: omsLabel(soStatus),
    });
    const steps = OMS_TRACKER_STEPS;
    const idx = steps.findIndex((s) => s.match.includes(soStatus));
    steps.forEach((step, i) => {
      if (idx >= 0 && i <= idx) {
        events.push({
          id: `so-${step.status}`,
          type: step.status,
          title: step.label,
          at: row.createdAt,
        });
      }
    });
  } else if (row.status === "OPEN") {
    SREQ_TRACKER_STEPS.slice(0, 1).forEach((step) => {
      events.push({
        id: `sreq-${step.status}`,
        type: step.status,
        title: step.label,
        at: row.createdAt,
      });
    });
  }
  return events;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [row, setRow] = useState<SalesRequestDetail | null>(null);
  const [screen, setScreen] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const justPlaced = searchParams.get("placed") === "1";

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  function load(requestId: string) {
    setLoading(true);
    Promise.all([
      api<{ data: SalesRequestDetail }>("sales", `/api/sales-requests/${requestId}`),
      api<{ data: { definition: FormDefinition } }>(
        "sales",
        "/api/workflow-forms/published?formId=customer-tracking&audience=CUSTOMER"
      ),
    ]).then(([detail, form]) => {
      if (!detail.error && detail.data?.data) setRow(detail.data.data);
      if (form.data?.data?.definition) setScreen(form.data.data.definition);
      setLoading(false);
    });
  }

  useEffect(() => {
    if (!id) return;
    load(id);
  }, [id]);

  async function cancelRequest() {
    if (!row || !customerCanCancelRequest(row.status)) return;
    if (!confirm("Cancel this sales request?")) return;
    setBusy(true);
    setMsg("");
    const res = await api("sales", `/api/sales-requests/${row.id}?action=cancel`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    load(row.id);
  }

  function reorder() {
    if (!row?.items?.length) return;
    clearCart();
    for (const item of row.items) {
      const name = item.productName ?? item.name ?? "Item";
      const qty = item.quantity ?? item.qty ?? 1;
      try {
        addToCart({
          productId: item.productId,
          name,
          sku: item.sku ?? item.productId,
          price: Number(item.unitPrice),
          qty,
        });
      } catch {
        /* skip bad lines */
      }
    }
    router.push("/checkout");
  }

  const host = useMemo(
    () =>
      createCustomerHost({
        permissions: { canEdit: false, canComplete: false, roles: ["CUSTOMER"] },
        navigation: { push: (p) => router.push(p) },
        services: {},
      }),
    [router]
  );

  const timeline = useMemo(() => (row ? buildTimeline(row) : []), [row]);

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>;
  if (!row) return <div className="flex items-center justify-center py-16 text-gray-400">Request not found</div>;

  const soStatus = row.salesOrder?.status ?? row.soStatus;
  const soNumber = row.salesOrder?.orderNumber ?? row.soNumber;
  const canCancel = customerCanCancelRequest(row.status);
  const displayStatus = soStatus ? omsLabel(soStatus) : sreqLabel(row.status);

  return (
    <div className="pb-8">
      <div className="bg-slate-900 px-4 py-5 text-white">
        {justPlaced && (
          <div className="mb-2 w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
            Sales request submitted — awaiting convert to order
          </div>
        )}
        <div className="text-xs opacity-80">Sales request</div>
        <div className="text-xl font-bold">{row.requestNumber}</div>
        {soNumber && (
          <div className="mt-1 text-sm text-emerald-200">
            Sales order {soNumber} · {omsLabel(soStatus!)}
          </div>
        )}
        <div className="mt-0.5 text-xs opacity-70">{new Date(row.createdAt).toLocaleString("en-IN")}</div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {screen ? (
          <CustomerScreenController
            host={host}
            screen={screen}
            order={{
              id: row.id,
              status: displayStatus,
              requestNumber: row.requestNumber,
              orderNumber: soNumber ?? undefined,
              totalAmount: row.total,
            }}
            items={row.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName ?? item.name ?? "Item",
              quantity: item.quantity ?? item.qty ?? 0,
              unitPrice: item.unitPrice,
            }))}
            fieldValues={{}}
            setFieldValue={() => undefined}
            timeline={timeline}
          />
        ) : null}

        {row.deliveryAddressText && (
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Delivering to</div>
            <div className="text-sm text-gray-800">{row.deliveryAddressText}</div>
          </div>
        )}

        {row.notes && (
          <div className="rounded-xl border border-gray-100 p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</div>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{row.notes}</p>
          </div>
        )}

        <div className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>₹{Number(row.subtotal).toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
            <span>Total</span>
            <span>₹{Number(row.total).toLocaleString("en-IN")}</span>
          </div>
        </div>

        {msg && <div className="text-sm text-red-600">{msg}</div>}

        <div className="mb-6 flex gap-2 pb-2">
          <button
            type="button"
            onClick={reorder}
            className="flex-1 rounded-full border border-slate-300 bg-white py-3.5 text-sm font-semibold text-slate-800 shadow-sm"
          >
            Reorder
          </button>
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancelRequest()}
              className="flex-1 rounded-full border border-red-200 bg-white py-3.5 text-sm font-semibold text-red-600 shadow-sm disabled:opacity-60"
            >
              {busy ? "Cancelling…" : "Cancel request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

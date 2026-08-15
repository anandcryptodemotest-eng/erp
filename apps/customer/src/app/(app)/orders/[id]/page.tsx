"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormDefinition } from "@erp/workflow";
import { BillSummary, Button, Container, PriceDisplay, SectionHeader, Skeleton, StatusChip } from "@erp/ui";
import { api, openAuthenticatedDocument } from "@/lib/api-client";
import { billSummaryRows } from "@/lib/bill-summary";
import { addToCart, clearCart } from "@/lib/cart-store";
import { customerCanCancelRequest, omsLabel, sreqLabel } from "@/lib/oms-status";
import { buildBuyerTimeline } from "@/lib/order-timeline";
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
  documents?: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
  }[];
  salesOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    total: number;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    fulfillmentMode?: string | null;
    carrier?: string | null;
    documents?: {
      id: string;
      type: string;
      fileName: string;
      fileUrl: string;
      mimeType?: string | null;
    }[];
  } | null;
}

function OrderDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [row, setRow] = useState<SalesRequestDetail | null>(null);
  const [screen, setScreen] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [docErr, setDocErr] = useState("");
  const justPlaced = searchParams.get("placed") === "1";
  const attachWarn = searchParams.get("attachWarn");

  async function downloadInvoice(doc: {
    id: string;
    fileName: string;
  }) {
    setDocBusy(doc.id);
    setDocErr("");
    try {
      await openAuthenticatedDocument(
        `/api/order-documents/${doc.id}/file`,
        doc.fileName || "invoice.pdf"
      );
    } catch (e) {
      setDocErr(e instanceof Error ? e.message : "Could not open document");
    } finally {
      setDocBusy(null);
    }
  }

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

  const timeline = useMemo(() => (row ? buildBuyerTimeline(row).map((e) => ({ id: e.id, type: e.id, title: e.title, at: e.at || row.createdAt, remarks: e.current ? "Current" : undefined })) : []), [row]);

  if (loading) {
    return (
      <Container layout="wide" className="space-y-4 py-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </Container>
    );
  }
  if (!row) {
    return (
      <Container layout="wide" className="py-16 text-center text-sm text-[var(--ink-soft)]">
        Request not found
      </Container>
    );
  }

  const soStatus = row.salesOrder?.status ?? row.soStatus;
  const soNumber = row.salesOrder?.orderNumber ?? row.soNumber;
  const canCancel = customerCanCancelRequest(row.status);
  const displayStatus = soStatus ? omsLabel(soStatus) : sreqLabel(row.status);

  return (
    <Container layout="wide" className="pb-28 pt-5">
      {justPlaced ? (
        <div className="mb-4 space-y-2">
          <StatusChip tone="brand">Sales request submitted — awaiting convert to order</StatusChip>
          {attachWarn ? (
            <p className="text-xs text-[var(--danger)]">
              Request placed, but {attachWarn} attachment(s) could not be uploaded. You can message sales with the file.
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Sales request</p>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <SectionHeader title={row.requestNumber} className="mb-0" />
        <StatusChip status={soStatus ?? row.status}>{displayStatus}</StatusChip>
      </div>
      {soNumber ? (
        <p className="mb-1 text-sm font-medium text-[var(--brand)]">
          Sales order {soNumber}
        </p>
      ) : null}
      {row.salesOrder?.trackingUrl || row.salesOrder?.trackingNumber ? (
        <p className="mb-2 text-sm">
          {row.salesOrder.trackingUrl ? (
            <a
              href={row.salesOrder.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--brand)] underline"
            >
              Track shipment
            </a>
          ) : (
            <span className="font-semibold text-[var(--brand)]">Tracking</span>
          )}
          {row.salesOrder.trackingNumber ? (
            <span className="ml-2 text-xs text-[var(--ink-soft)]">{row.salesOrder.trackingNumber}</span>
          ) : null}
        </p>
      ) : null}
      {row.salesOrder?.documents && row.salesOrder.documents.length > 0 ? (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Invoices
          </p>
          {docErr ? <p className="mb-2 text-xs text-red-600">{docErr}</p> : null}
          <ul className="space-y-1">
            {row.salesOrder.documents.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--forest)] underline disabled:opacity-50"
                  disabled={docBusy === d.id}
                  onClick={() => void downloadInvoice(d)}
                >
                  {docBusy === d.id ? "Opening…" : `Download ${d.fileName}`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mb-6 text-xs text-[var(--ink-soft)]">
        {new Date(row.createdAt).toLocaleString("en-IN")}
      </p>

      <div className="space-y-4">
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

        {row.deliveryAddressText ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)]">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              Delivering to
            </div>
            <div className="text-sm text-[var(--ink)]">{row.deliveryAddressText}</div>
          </div>
        ) : null}

        {row.notes ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Notes</div>
            <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">{row.notes}</p>
          </div>
        ) : null}

        {row.documents && row.documents.length > 0 ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              Your attachments
            </div>
            <ul className="space-y-1">
              {row.documents.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="text-sm font-medium text-[var(--forest)] underline disabled:opacity-50"
                    disabled={docBusy === d.id}
                    onClick={() => void downloadInvoice(d)}
                  >
                    {docBusy === d.id ? "Opening…" : d.fileName}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <BillSummary
          title="Bill summary"
          rows={billSummaryRows({
            subtotal: row.subtotal,
            discount: row.couponDiscount,
            tax: row.tax ?? 0,
            delivery: row.deliveryFee,
            total: row.total,
          })}
          totalLabel="Total"
          totalValue={row.total}
          footer="GST applies only when configured on the product."
        />

        {msg ? <div className="text-sm text-[var(--danger)]">{msg}</div> : null}

        <div className="flex gap-2 pb-2">
          <Button variant="outline" size="block" className="flex-1" onClick={reorder}>
            Reorder
          </Button>
          {canCancel ? (
            <Button
              variant="outline"
              size="block"
              className="flex-1 border-red-200 text-[var(--danger)]"
              disabled={busy}
              loading={busy}
              onClick={() => void cancelRequest()}
            >
              Cancel request
            </Button>
          ) : null}
        </div>
      </div>
    </Container>
  );
}


export default function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[var(--ink-soft)]">Loading…</div>}>
      <OrderDetailInner {...props} />
    </Suspense>
  );
}

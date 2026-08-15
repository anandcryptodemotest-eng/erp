"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/admin-api";
import { Button, EmptyState, PageScaffold, Skeleton, StatusChip } from "@erp/ui";

type AgeingRow = {
  id: string;
  number: string;
  entityName: string | null;
  dueDate: string;
  total: number;
  paidAmount: number;
  outstanding: number;
  daysPastDue: number;
  bucket: string;
  status: string;
  pdfUrl?: string | null;
};

type AgeingData = {
  asOf: string;
  totalOutstanding: number;
  invoiceCount: number;
  buckets: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_plus: number;
  };
  customers: { entityId: string; entityName: string; outstanding: number; invoiceCount: number }[];
  invoices: AgeingRow[];
};

const BUCKET_LABELS: Record<string, string> = {
  current: "Not due",
  d1_30: "1–30",
  d31_60: "31–60",
  d61_90: "61–90",
  d90_plus: "90+",
};

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function bucketTone(bucket: string): "success" | "warning" | "danger" | "neutral" | "info" {
  if (bucket === "current") return "success";
  if (bucket === "d1_30") return "info";
  if (bucket === "d31_60") return "warning";
  if (bucket === "d61_90" || bucket === "d90_plus") return "danger";
  return "neutral";
}

export default function ArWorkbenchPage() {
  return (
    <Suspense fallback={<PageScaffold hero={{ title: "Receivables" }}><Skeleton className="h-40 w-full" /></PageScaffold>}>
      <ArWorkbenchInner />
    </Suspense>
  );
}

function ArWorkbenchInner() {
  const searchParams = useSearchParams();
  const bucketFilter = (searchParams.get("bucket") ?? "").trim();
  const [data, setData] = useState<AgeingData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api("/api/ar/ageing");
      setData(r.data as AgeingData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load AR");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function recordPayment(invoiceId: string, outstanding: number) {
    const amount = parseFloat(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount");
      return;
    }
    if (amount > outstanding) {
      setError("Amount exceeds outstanding");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/invoices/${invoiceId}?action=pay`, {
        method: "PATCH",
        body: JSON.stringify({
          amount,
          method: "CASH",
          date: new Date().toISOString(),
          reference: "AR workbench",
        }),
      });
      setMessage(`Payment of ${inr(amount)} recorded`);
      setPayId(null);
      setPayAmount("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageScaffold
      hero={{
        eyebrow: "Accounting",
        title: "Receivables",
        description:
          "Outstanding bills on the same Invoice as Order Desk / Quick Bill. Ageing and collect — not a separate ledger.",
        actions: (
          <Button disabled={busy} onClick={() => void load()}>
            {busy ? "Refreshing…" : "Refresh"}
          </Button>
        ),
      }}
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_10%,white)] px-4 py-2.5 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] px-4 py-2.5 text-sm text-[var(--success)]">
            {message}
          </div>
        ) : null}

        {busy && !data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Skeleton className="h-24 sm:col-span-2" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)] sm:col-span-2">
                <div className="text-xs text-[var(--ink-soft)]">Total outstanding</div>
                <div className="mt-1 font-display text-2xl font-semibold text-[var(--ink)]">
                  {inr(data.totalOutstanding)}
                </div>
                <div className="text-xs text-[var(--ink-soft)]">{data.invoiceCount} open bills</div>
              </div>
              {(["current", "d1_30", "d31_60", "d61_90", "d90_plus"] as const).map((k) => (
                <a
                  key={k}
                  href={`/admin/ar?bucket=${k}`}
                  className={`rounded-[var(--radius-md)] border bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)] ${
                    bucketFilter === k
                      ? "border-[var(--brand)] ring-1 ring-[var(--brand)]"
                      : "border-[var(--line)]"
                  }`}
                >
                  <div className="text-xs text-[var(--ink-soft)]">{BUCKET_LABELS[k]}</div>
                  <div className="mt-1 text-lg font-semibold">{inr(data.buckets[k])}</div>
                </a>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]">
              {data.invoices.filter((inv) => !bucketFilter || inv.bucket === bucketFilter).length === 0 ? (
                <EmptyState title="No open receivables" subtitle="Paid or unsettled bills will show here by ageing bucket." />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--surface-sunken)] text-left text-[var(--ink-soft)]">
                      <th className="px-4 py-3 font-medium">Bill</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Due</th>
                      <th className="px-4 py-3 font-medium">Age</th>
                      <th className="px-4 py-3 font-medium text-right">Outstanding</th>
                      <th className="px-4 py-3 font-medium">Collect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {data.invoices
                      .filter((inv) => !bucketFilter || inv.bucket === bucketFilter)
                      .map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-3 font-mono text-xs">
                          {inv.number}
                          {inv.pdfUrl ? (
                            <>
                              {" "}
                              <a
                                className="text-[var(--brand)] underline"
                                href={inv.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                PDF
                              </a>
                            </>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{inv.entityName ?? "—"}</td>
                        <td className="px-4 py-3 text-xs">
                          {new Date(inv.dueDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <StatusChip tone={bucketTone(inv.bucket)}>
                            {BUCKET_LABELS[inv.bucket] ?? inv.bucket}
                            {inv.daysPastDue > 0 ? ` · ${inv.daysPastDue}d` : ""}
                          </StatusChip>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{inr(inv.outstanding)}</td>
                        <td className="px-4 py-3">
                          {payId === inv.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                className="w-24 rounded-[var(--radius-sm)] border border-[var(--line)] px-2 py-1 text-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                                placeholder={String(inv.outstanding)}
                              />
                              <Button disabled={busy} onClick={() => void recordPayment(inv.id, inv.outstanding)}>
                                Save
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setPayId(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setPayId(inv.id);
                                setPayAmount(String(inv.outstanding));
                              }}
                            >
                              Record payment
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </div>
    </PageScaffold>
  );
}

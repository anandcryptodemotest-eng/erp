"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@erp/ui";
import { api } from "@/lib/admin-api";

type Plan = {
  id: string;
  code: string;
  name: string;
  billingInterval: string;
  amountPaise: number;
  includedSeats: number;
  featureCodes?: string[];
};
type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalPaise: number;
  billingPeriodKey: string;
};
type Entitlement = { licensed: boolean; reason: string; status: string; features: string[] };
type SubRow = {
  status: string;
  seatLimit: number;
  featureCodes: string[];
  currentPeriodEnd: string | null;
  plan: Plan;
  invoices: Invoice[];
};

function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function BillingCheckoutPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [mode, setMode] = useState("DEMO");
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [subscription, setSubscription] = useState<SubRow | null>(null);

  const refresh = useCallback(async () => {
    const [planRes, subRes] = await Promise.all([
      api<{ data: Plan[] }>("/api/billing/plans"),
      api<{ data: { mode: string; entitlement: Entitlement; subscription: SubRow | null } }>("/api/billing/subscription"),
    ]);
    const paid = planRes.data.filter((p) => p.code !== "free_once");
    setPlans(paid);
    setPlanId((current) => (paid.some((p) => p.id === current) ? current : paid[0]?.id || ""));
    setMode(subRes.data.mode);
    setEntitlement(subRes.data.entitlement);
    setSubscription(subRes.data.subscription);
  }, []);

  useEffect(() => {
    void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load billing"));
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!planId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api<{ data: { status: string; invoiceNumber: string } }>("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      setMessage(`Subscription ${created.data.status}. Invoice ${created.data.invoiceNumber} is OPEN until paid.`);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Subscribe failed");
    } finally {
      setBusy(false);
    }
  }, [planId, refresh]);

  const pay = useCallback(
    async (invoiceId: string) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const r = await api<{ data: { duplicate?: boolean; fullyPaid?: boolean } }>("/api/billing/demo-pay", {
          method: "POST",
          body: JSON.stringify({ invoiceId }),
        });
        setMessage(r.data.duplicate ? "Payment already applied" : "Invoice paid. Subscription active.");
        await refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Pay failed");
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const openInvoices = subscription?.invoices.filter((i) => i.status === "OPEN" || i.status === "OVERDUE") ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--ink-soft)]">
        Sankalp SaaS billing. Paying these invoices does not record a dealer customer invoice.
      </p>
      <p className="text-sm">
        Mode: <strong>{mode}</strong>
        {entitlement ? (
          <>
            {" "}
            · Entitlement: <strong>{entitlement.licensed ? "licensed" : "blocked"}</strong> ({entitlement.reason})
          </>
        ) : null}
      </p>
      <p className="text-sm">
        Subscription: <strong>{subscription?.status ?? "NONE"}</strong>
        {subscription ? ` · ${subscription.seatLimit} seats · ${subscription.featureCodes.join(", ")}` : null}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm space-y-1">
          <span className="block text-[var(--ink-soft)]">Plan</span>
          <select
            className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-2"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {rupees(p.amountPaise)} / {p.billingInterval.toLowerCase()} ({p.includedSeats} seats)
              </option>
            ))}
          </select>
        </label>
        <Button type="button" disabled={busy || !planId} onClick={() => void subscribe()}>
          {busy ? "Working…" : "Subscribe"}
        </Button>
      </div>

      {openInvoices.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Open invoices</p>
          {openInvoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {inv.invoiceNumber} · {rupees(inv.totalPaise)} · {inv.billingPeriodKey}
              </span>
              {mode === "DEMO" ? (
                <Button type="button" disabled={busy} onClick={() => void pay(inv.id)}>
                  Pay (DEMO)
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

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

type RazorpayCheckoutSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`;
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(script);
  });
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

  const payDemo = useCallback(
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

  const payLive = useCallback(
    async (invoice: Invoice) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const order = await api<{
          order_id: string;
          amount: number;
          currency: string;
          key_id: string;
          billingInvoiceId: string | null;
        }>("/api/create-order", {
          method: "POST",
          body: JSON.stringify({ billingInvoiceId: invoice.id }),
        });

        await loadRazorpayScript();
        if (!window.Razorpay) throw new Error("Razorpay Checkout unavailable");

        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay!({
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: "Sankalp",
            description: `SaaS invoice ${invoice.invoiceNumber}`,
            order_id: order.order_id,
            theme: { color: "#1f4d3a" },
            handler: (response: RazorpayCheckoutSuccess) => {
              void (async () => {
                try {
                  const r = await api<{ data: { duplicate?: boolean } }>("/api/billing/verify-payment", {
                    method: "POST",
                    body: JSON.stringify({
                      invoiceId: invoice.id,
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    }),
                  });
                  setMessage(
                    r.data.duplicate
                      ? "Payment already applied"
                      : `Paid ${rupees(invoice.totalPaise)}. Subscription active.`
                  );
                  await refresh();
                  resolve();
                } catch (e: unknown) {
                  reject(e instanceof Error ? e : new Error("Verify payment failed"));
                }
              })();
            },
            modal: {
              ondismiss: () => reject(new Error("Checkout closed before payment")),
            },
          });
          rzp.open();
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Razorpay pay failed");
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const openInvoices = subscription?.invoices.filter((i) => i.status === "OPEN" || i.status === "OVERDUE") ?? [];
  const starter = plans.find((p) => p.code === "starter_monthly");

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
      {mode === "LIVE" ? (
        <p className="rounded-lg border border-[var(--line)] bg-[var(--mist)] px-3 py-2 text-xs text-[var(--ink-soft)]">
          LIVE Checkout uses Razorpay keys from the Gateway env. With <code>rzp_test_</code> keys, use Razorpay
          test cards (no real bank debit). Starter is {starter ? rupees(starter.amountPaise) : "₹100.00"} / month.
        </p>
      ) : null}

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
                {p.code === "starter_monthly" ? " · recommended test" : ""}
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
                <Button type="button" disabled={busy} onClick={() => void payDemo(inv.id)}>
                  Pay (DEMO)
                </Button>
              ) : (
                <Button type="button" disabled={busy} onClick={() => void payLive(inv)}>
                  {busy ? "Opening…" : "Pay with Razorpay"}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

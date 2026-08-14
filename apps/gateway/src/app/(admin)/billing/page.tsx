"use client";

import { BillingCheckoutPanel } from "../administration/billing-checkout-panel";

export default function TenantBillingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Sankalp billing</h1>
      <p className="text-sm text-[var(--ink-soft)]">
        Upgrade, pay, and renew your Sankalp subscription. This is not dealer customer invoicing.
      </p>
      <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
        <BillingCheckoutPanel />
      </div>
    </div>
  );
}

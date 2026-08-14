"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/admin-api";

type Entitlement = { licensed: boolean; reason: string; features: string[] };
type Invoice = { id: string; status: string; invoiceNumber: string; totalPaise: number };
type Sub = {
  status: string;
  currentPeriodEnd: string | null;
  plan?: { name: string; code: string };
  invoices?: Invoice[];
};

export function BillingStatusBanner() {
  const [text, setText] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "warn">("info");

  const load = useCallback(async () => {
    const res = await api<{
      data: { entitlement: Entitlement; reminderDays?: number; subscription: Sub | null };
    }>("/api/billing/subscription");
    const sub = res.data.subscription;
    const features = res.data.entitlement?.features ?? [];
    const open = (sub?.invoices ?? []).filter((i) => i.status === "OPEN" || i.status === "OVERDUE");
    const isFree = !features.includes("oms");

    if (open.length) {
      const end = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "";
      setTone(sub?.status === "PAST_DUE" ? "warn" : "info");
      setText(
        sub?.status === "PAST_DUE"
          ? `Past due — pay ${open[0]!.invoiceNumber} or you will switch to Free.`
          : end
            ? `Pay ${open[0]!.invoiceNumber} to continue ${sub?.plan?.name ?? "your plan"} (ends ${end}).`
            : `Pay ${open[0]!.invoiceNumber} to activate ${sub?.plan?.name ?? "your selected plan"}.`
      );
      return;
    }
    if (isFree) {
      setTone("info");
      setText("You are on Free. Upgrade to unlock Order Desk, inventory, and more.");
      return;
    }
    setText(null);
  }, []);

  useEffect(() => {
    void load().catch(() => setText(null));
  }, [load]);

  if (!text) return null;

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
        tone === "warn" ? "bg-amber-100 text-amber-950" : "bg-sky-50 text-sky-950"
      }`}
    >
      <span>{text}</span>
      <Link href="/billing" className="font-semibold underline">
        Sankalp billing
      </Link>
    </div>
  );
}

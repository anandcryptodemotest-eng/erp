"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, PageScaffold } from "@erp/ui";
import { Shell } from "@/components/Shell";
import { api, getAccessToken } from "@/lib/api";
import { useRouter } from "next/navigation";

const INTERVALS = ["ONCE", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;
const CORE_FEATURES = ["dashboard", "organization", "users"] as const;

type Feature = { id: string; code: string; name: string; kind: string };
type Plan = {
  id: string;
  code: string;
  name: string;
  billingInterval: string;
  amountPaise: number;
  currency: string;
  includedSeats: number;
  isActive: boolean;
  featureCodes?: string[];
  features?: { feature: Feature }[];
};

type CreateForm = {
  name: string;
  code: string;
  billingInterval: (typeof INTERVALS)[number];
  amountRupees: string;
  currency: "INR";
  includedSeats: string;
  isActive: boolean;
  featureCodes: string[];
};

const emptyForm = (): CreateForm => ({
  name: "",
  code: "",
  billingInterval: "MONTHLY",
  amountRupees: "0",
  currency: "INR",
  includedSeats: "5",
  isActive: true,
  featureCodes: [...CORE_FEATURES],
});

function slugifyCode(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
}

const inputClass =
  "rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm shadow-[var(--shadow-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export default function BillingPage() {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [codeTouched, setCodeTouched] = useState(false);

  const load = useCallback(async () => {
    const [f, p] = await Promise.all([
      api<{ data: Feature[] }>("/api/billing/features"),
      api<{ data: Plan[] }>("/api/billing/plans"),
    ]);
    setFeatures(f.data);
    setPlans(
      p.data.map((row) => ({
        ...row,
        featureCodes: row.featureCodes ?? row.features?.map((x) => x.feature.code) ?? [],
      }))
    );
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [load, router]);

  async function toggleFeature(plan: Plan, code: string) {
    const current = new Set(plan.featureCodes ?? []);
    if (current.has(code)) current.delete(code);
    else current.add(code);
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api("/api/billing/plans", {
        method: "PATCH",
        body: JSON.stringify({ id: plan.id, featureCodes: [...current] }),
      });
      setOk(`Updated ${plan.code} (in-period tenant snapshots are unchanged)`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleCreateFeature(code: string) {
    if ((CORE_FEATURES as readonly string[]).includes(code)) return;
    setForm((prev) => {
      const next = new Set(prev.featureCodes);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...prev, featureCodes: [...CORE_FEATURES, ...[...next].filter((c) => !(CORE_FEATURES as readonly string[]).includes(c))] };
    });
  }

  async function createPlan(e: FormEvent) {
    e.preventDefault();
    const rupees = Number(form.amountRupees);
    const seats = Number(form.includedSeats);
    if (!Number.isFinite(rupees) || rupees < 0) {
      setError("Amount must be zero or a positive rupee value");
      return;
    }
    if (!Number.isInteger(seats) || seats < 1) {
      setError("Included seats must be a whole number of at least 1");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api("/api/billing/plans", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          billingInterval: form.billingInterval,
          amountPaise: Math.round(rupees * 100),
          currency: form.currency,
          includedSeats: seats,
          isActive: form.isActive,
          featureCodes: form.featureCodes,
        }),
      });
      setOk(`Created plan ${form.code.trim()}`);
      setForm(emptyForm());
      setCodeTouched(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <PageScaffold
        hero={{
          eyebrow: "Platform",
          title: "Sankalp billing",
          description:
            "Create catalog plans and edit the feature matrix. Changes do not alter a paying tenant until their next paid period.",
        }}
      >
        <div className="max-w-5xl space-y-6">
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {ok ? <p className="text-sm text-[var(--success)]">{ok}</p> : null}

        <form
          onSubmit={(e) => void createPlan(e)}
          className="space-y-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)]"
        >
          <h3 className="font-medium text-[var(--ink)]">Create plan</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Name</span>
              <input
                required
                minLength={2}
                maxLength={80}
                className={inputClass}
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    name,
                    code: codeTouched ? prev.code : slugifyCode(name),
                  }));
                }}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Code</span>
              <input
                required
                minLength={2}
                maxLength={40}
                pattern="[a-z][a-z0-9_]*"
                title="Lowercase letters, digits, underscores; must start with a letter"
                className={inputClass}
                value={form.code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setForm({
                    ...form,
                    code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  });
                }}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Billing interval</span>
              <select
                className={inputClass}
                value={form.billingInterval}
                onChange={(e) =>
                  setForm({ ...form, billingInterval: e.target.value as CreateForm["billingInterval"] })
                }
              >
                {INTERVALS.map((i) => (
                  <option key={i} value={i}>
                    {i === "ONCE" ? "Once (no renewal)" : i.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Price (₹)</span>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={form.amountRupees}
                onChange={(e) => setForm({ ...form, amountRupees: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Currency</span>
              <input className={inputClass} value="INR" readOnly />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Included seats</span>
              <input
                required
                type="number"
                min={1}
                max={10000}
                step={1}
                className={inputClass}
                value={form.includedSeats}
                onChange={(e) => setForm({ ...form, includedSeats: e.target.value })}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (visible to tenants for subscribe)
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm text-[var(--muted)]">Features</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => {
                const core = (CORE_FEATURES as readonly string[]).includes(f.code);
                return (
                  <label key={f.code} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.featureCodes.includes(f.code)}
                      disabled={core}
                      onChange={() => toggleCreateFeature(f.code)}
                    />
                    <span>
                      {f.name} <span className="font-mono text-xs text-[var(--muted)]">{f.code}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-[var(--muted)]">Dashboard, organization, and users are always included.</p>
          </fieldset>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Create plan"}
          </Button>
        </form>

        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-1)]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-sunken)] text-left">
                <th className="p-3">Plan</th>
                {features.map((f) => (
                  <th key={f.code} className="p-2 font-mono text-xs">
                    {f.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-[var(--line)]">
                  <td className="p-3">
                    <div className="font-medium">
                      {plan.name}
                      {!plan.isActive ? (
                        <span className="ml-2 text-xs font-normal text-[var(--ink-soft)]">inactive</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[var(--ink-soft)]">
                      {plan.code} · ₹{(plan.amountPaise / 100).toFixed(0)} / {plan.billingInterval.toLowerCase()} ·{" "}
                      {plan.includedSeats} seats
                    </div>
                  </td>
                  {features.map((f) => (
                    <td key={f.code} className="p-2 text-center">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={(plan.featureCodes ?? []).includes(f.code)}
                        onChange={() => void toggleFeature(plan, f.code)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </PageScaffold>
    </Shell>
  );
}

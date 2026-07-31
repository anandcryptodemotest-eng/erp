"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProcessStudioHub } from "@erp/process-designer";
import { Shell } from "@/components/Shell";
import {
  api,
  getAccessToken,
  getProcessTenant,
  setProcessTenant,
  type ProcessTenantRef,
} from "@/lib/api";

type TenantRow = { id: string; name: string; slug: string; isActive: boolean };

export default function ProcessHubPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selected, setSelected] = useState<ProcessTenantRef | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setSelected(getProcessTenant());
    api<{ data: TenantRow[] }>("/api/platform/tenants")
      .then((r) => setTenants((r.data ?? []).filter((t) => t.isActive)))
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [router]);

  function onPick(id: string) {
    const t = tenants.find((x) => x.id === id);
    if (!t) return;
    const ref = { id: t.id, name: t.name, slug: t.slug };
    setProcessTenant(ref);
    setSelected(ref);
  }

  return (
    <Shell>
      <div className="space-y-6 max-w-4xl">
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        <label className="block space-y-1 text-sm max-w-md">
          <span className="text-[var(--muted)]">Target tenant</span>
          <select
            className="w-full rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2"
            value={selected?.id ?? ""}
            onChange={(e) => onPick(e.target.value)}
          >
            <option value="">Select tenant…</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </label>
        {!selected ? (
          <p className="text-sm text-[var(--muted)]">
            Choose a tenant to design workflows and forms on their behalf (platform identity — no
            impersonation).
          </p>
        ) : (
          <ProcessStudioHub
            workflowsHref="/process/workflows"
            formsHref="/process/forms"
            LinkComponent={({ href, children, className }) => (
              <Link href={href} className={className}>
                {children}
              </Link>
            )}
          />
        )}
      </div>
    </Shell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { api, getAccessToken } from "@/lib/api";
import type { ServiceHealthRow } from "@erp/platform-core";

type TenantRow = { id: string; isActive: boolean; modules: string[]; users: number };
type ServicesResp = {
  data: ServiceHealthRow[];
  meta: { platformVersion: string; platformBuild: string; healthy: number; failed: number; total: number };
};

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [svc, setSvc] = useState<ServicesResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    Promise.all([
      api<{ data: TenantRow[] }>("/api/platform/tenants"),
      api<ServicesResp>("/api/platform/services"),
    ])
      .then(([t, s]) => {
        setTenants(t.data ?? []);
        setSvc(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [router]);

  const activeUsers = tenants.reduce((n, t) => n + (t.users ?? 0), 0);
  const licensedModules = new Set(tenants.flatMap((t) => t.modules ?? [])).size;

  return (
    <Shell>
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Platform Version</p>
            <p className="text-lg font-semibold">ERP Platform</p>
          </div>
          <div className="text-right font-mono text-sm">
            <p>v{svc?.meta.platformVersion ?? "—"}</p>
            <p className="text-[var(--muted)]">Build {svc?.meta.platformBuild ?? "—"}</p>
          </div>
        </div>

        {error && <p className="text-[var(--bad)] text-sm">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Tenants" value={tenants.length} />
          <Card label="Active Users" value={activeUsers || "—"} />
          <Card label="Licensed Modules" value={licensedModules || "—"} />
          <Card label="Healthy Services" value={svc?.meta.healthy ?? "—"} />
          <Card label="Failed Services" value={svc?.meta.failed ?? "—"} />
          <Card label="Platform Version" value={svc?.meta.platformVersion ?? "—"} />
        </div>
      </div>
    </Shell>
  );
}

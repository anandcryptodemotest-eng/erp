"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { api, getAccessToken } from "@/lib/api";
import type { ServiceHealthRow } from "@erp/platform-core";

function statusColor(s: string) {
  if (s === "UP") return "var(--ok)";
  if (s === "DEGRADED") return "var(--warn)";
  return "var(--bad)";
}

export default function ServicesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ServiceHealthRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await api<{ data: ServiceHealthRow[] }>("/api/platform/services");
    setRows(r.data ?? []);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    const t = setInterval(() => {
      load().catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <Shell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Services</h2>
          <button
            type="button"
            className="text-sm text-[var(--accent)]"
            onClick={() => load().catch((e) => setError(e instanceof Error ? e.message : "Refresh failed"))}
          >
            Refresh
          </button>
        </div>
        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--panel)] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 font-medium">Environment</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Build</th>
                <th className="px-3 py-2 font-medium">Latency</th>
                <th className="px-3 py-2 font-medium">Checked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-[var(--muted)] font-mono">{r.id}</div>
                  </td>
                  <td className="px-3 py-2 capitalize">{r.environment}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: statusColor(r.status) }}>
                    {r.status}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.version ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.build ?? "—"}</td>
                  <td className="px-3 py-2">{r.latencyMs != null ? `${r.latencyMs} ms` : "—"}</td>
                  <td className="px-3 py-2 text-xs text-[var(--muted)]">
                    {new Date(r.checkedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

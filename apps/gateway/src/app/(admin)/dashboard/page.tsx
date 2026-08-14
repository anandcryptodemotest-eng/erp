"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DashboardEditor,
  PageScaffold,
  registerDashboardWidgets,
  roleDefaultConfig,
  useToast,
} from "@erp/ui";
import type {
  DashboardConfig,
  DashboardAuthContext,
  DashboardPlacement,
} from "@erp/ui";
import { api, getAdminUser } from "@/lib/admin-api";

registerDashboardWidgets();

type ConfigResponse = {
  data: {
    config: DashboardConfig;
    isDefault: boolean;
    auth: { role: string; modules: string[]; capabilities: string[] };
  };
};

function prettyRole(role: string) {
  return role.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardPage() {
  const toast = useToast();
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [authCtx, setAuthCtx] = useState<DashboardAuthContext | null>(null);
  const [roleLabel, setRoleLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const applyPayload = useCallback((res: ConfigResponse) => {
    setConfig(res.data.config);
    const user = getAdminUser();
    setRoleLabel(prettyRole(res.data.auth.role || user?.role || "User"));
    setAuthCtx({
      userId: user?.id ?? "",
      role: res.data.auth.role,
      modules: res.data.auth.modules,
      capabilities: res.data.auth.capabilities,
    });
  }, []);

  const load = useCallback(async () => {
    registerDashboardWidgets();
    setLoading(true);
    setError("");
    try {
      const res = await api<ConfigResponse>("/api/dashboard/config?portal=ADMIN");
      applyPayload(res);
    } catch (err) {
      const user = getAdminUser();
      if (user) {
        setConfig(roleDefaultConfig(user.role || "USER", "ADMIN"));
        setRoleLabel(prettyRole(user.role || "User"));
        setAuthCtx({ userId: user.id ?? "", role: user.role, modules: [], capabilities: [] });
      } else {
        setError(err instanceof Error ? err.message : "Could not load dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/dashboard/config?portal=ADMIN", {
        method: "PUT",
        body: JSON.stringify({
          widgets: (config.widgets as DashboardPlacement[]).map((p) => ({
            type: p.type,
            x: p.x ?? 0,
            y: p.y ?? 0,
            w: p.w,
            h: p.h,
            config: p.config ?? {},
          })),
        }),
      });
      const res = await api<ConfigResponse>("/api/dashboard/config?portal=ADMIN");
      applyPayload(res);
      toast.success("Layout saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save layout";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError("");
    try {
      await api("/api/dashboard/config?portal=ADMIN", { method: "DELETE" });
      const res = await api<ConfigResponse>("/api/dashboard/config?portal=ADMIN");
      applyPayload(res);
      toast.success("Restored default layout");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reset dashboard";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const fetchData = useCallback(
    async <T,>(dataSource: string): Promise<T | null> => {
      try {
        return await api<T>(dataSource);
      } catch {
        return null;
      }
    },
    []
  );

  if (loading) {
    return (
      <PageScaffold>
        <p className="text-sm text-[var(--ink-soft)]">Loading dashboard…</p>
      </PageScaffold>
    );
  }

  if (!config) {
    return (
      <PageScaffold>
        <p className="text-sm text-[var(--danger)]">{error || "Could not load dashboard"}</p>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      hero={{
        eyebrow: "Workspace",
        title: "Dashboard",
        description: "What needs your attention right now. Process work on Order Desk.",
        badge: roleLabel ? <span className="ws-chip">{roleLabel}</span> : null,
        actions: (
          <Link href="/sales-desk" className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-1)] transition-[background,transform] duration-[var(--motion-fast)] hover:bg-[var(--brand-dark)] active:scale-[var(--press-scale)]">
            Open Order Desk →
          </Link>
        ),
      }}
    >
      {error ? (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--warning)_35%,var(--line))] bg-[color-mix(in_srgb,var(--warning)_10%,white)] px-4 py-2 text-sm text-[var(--warning)]">
          {error}
        </div>
      ) : null}

      {authCtx ? (
        <DashboardEditor
          config={config}
          auth={authCtx}
          portal="ADMIN"
          fetchData={fetchData}
          onChange={setConfig}
          onSave={() => void save()}
          onReset={() => void reset()}
          saving={saving}
        />
      ) : null}
    </PageScaffold>
  );
}

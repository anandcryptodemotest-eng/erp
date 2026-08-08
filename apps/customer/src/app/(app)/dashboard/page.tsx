"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DashboardEditor,
  registerDashboardWidgets,
  roleDefaultConfig,
} from "@erp/ui";
import type {
  DashboardConfig,
  DashboardAuthContext,
  DashboardPlacement,
} from "@erp/ui";
import { api, isAuthenticated } from "@/lib/api-client";
import { ensureCustomerProfile } from "@/lib/ensure-customer-profile";

registerDashboardWidgets();

type ConfigResponse = {
  data: {
    config: DashboardConfig;
    isDefault: boolean;
    auth: { role: string; modules: string[]; capabilities: string[] };
  };
};

/** Customer API returns { data } — unwrap for widgets. */
async function fetchBody<T>(path: string): Promise<T | null> {
  const res = await api<T>("gateway", path);
  if (res.error) return null;
  return res.data as T;
}

export default function CustomerDashboardPage() {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [authCtx, setAuthCtx] = useState<DashboardAuthContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    registerDashboardWidgets();
    setLoading(true);
    setError("");
    try {
      const res = await api<ConfigResponse>("gateway", "/api/dashboard/config?portal=CUSTOMER");
      if (res.error || !res.data) throw new Error(res.error || "Could not load dashboard");
      const payload = (res.data as ConfigResponse).data;
      setConfig(payload.config);
      setAuthCtx({
        userId: "",
        role: payload.auth.role,
        modules: payload.auth.modules,
        capabilities: payload.auth.capabilities,
      });
    } catch (err) {
      setConfig(roleDefaultConfig("CUSTOMER", "CUSTOMER"));
      setAuthCtx({ userId: "", role: "CUSTOMER", modules: ["sales"], capabilities: [] });
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return;
    void ensureCustomerProfile().then(() => void load());
  }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await api("gateway", "/api/dashboard/config?portal=CUSTOMER", {
        method: "PUT",
        body: JSON.stringify({
          widgets: (config.widgets as DashboardPlacement[]).map((p) => ({
            type: p.type, x: p.x ?? 0, y: p.y ?? 0, w: p.w, h: p.h, config: p.config ?? {},
          })),
        }),
      });
      if (res.error) throw new Error(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save layout");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      const res = await api("gateway", "/api/dashboard/config?portal=CUSTOMER", { method: "DELETE" });
      if (res.error) throw new Error(res.error);
      setConfig(roleDefaultConfig("CUSTOMER", "CUSTOMER"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset dashboard");
    } finally {
      setSaving(false);
    }
  }

  const fetchData = useCallback(async <T,>(dataSource: string): Promise<T | null> => {
    return fetchBody<T>(dataSource);
  }, []);

  if (loading) {
    return <div className="p-8 text-sm text-[var(--ink-soft,#666)]">Loading dashboard…</div>;
  }

  if (!config) {
    return <div className="p-8 text-sm text-red-600">{error || "Could not load dashboard"}</div>;
  }

  return (
    <div className="p-4 pb-28 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--ink,#1a1a1a)]">My dashboard</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft,#666)]/70">Track your orders and spending.</p>
      </div>
      {error ? (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</div>
      ) : null}
      {authCtx ? (
        <DashboardEditor
          config={config}
          auth={authCtx}
          portal="CUSTOMER"
          fetchData={fetchData}
          onChange={setConfig}
          onSave={() => void save()}
          onReset={() => void reset()}
          saving={saving}
        />
      ) : null}
    </div>
  );
}
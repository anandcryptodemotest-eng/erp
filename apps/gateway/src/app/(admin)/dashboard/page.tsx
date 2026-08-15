"use client";

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
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function timeGreeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(user: { name?: string | null; email?: string } | null): string {
  const raw = user?.name?.trim();
  if (raw) return raw.split(/\s+/)[0] ?? raw;
  const email = user?.email?.trim();
  if (email) return email.split("@")[0] || "there";
  return "there";
}

export default function DashboardPage() {
  const toast = useToast();
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [authCtx, setAuthCtx] = useState<DashboardAuthContext | null>(null);
  const [roleLabel, setRoleLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [phoneOps, setPhoneOps] = useState(false);
  const [displayName, setDisplayName] = useState("there");

  useEffect(() => {
    const apply = () => {
      const mode = document.querySelector(".admin-shell")?.getAttribute("data-admin-mode");
      setPhoneOps(mode === "operational" && window.matchMedia("(max-width: 767px)").matches);
    };
    apply();
    window.addEventListener("resize", apply);
    const shell = document.querySelector(".admin-shell");
    const mo = shell ? new MutationObserver(apply) : null;
    if (shell && mo) mo.observe(shell, { attributes: true, attributeFilter: ["data-admin-mode"] });
    return () => {
      window.removeEventListener("resize", apply);
      mo?.disconnect();
    };
  }, []);

  const applyPayload = useCallback((res: ConfigResponse) => {
    setConfig(res.data.config);
    const user = getAdminUser();
    setRoleLabel(prettyRole(res.data.auth.role || user?.role || "User"));
    setDisplayName(firstNameOf(user));
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
        setDisplayName(firstNameOf(user));
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

  useEffect(() => {
    void api<{ data?: { kpis?: { myTasks?: number; openTasks?: number }; tasks?: unknown[] } }>(
      "/api/dashboard/ops-summary"
    )
      .then((res) => {
        const k = res?.data?.kpis;
        const fromList = Array.isArray(res?.data?.tasks) ? res.data.tasks.length : null;
        setTaskCount(fromList ?? k?.myTasks ?? k?.openTasks ?? 0);
      })
      .catch(() => setTaskCount(null));
  }, []);

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

  const greeting = useMemo(() => timeGreeting(), []);

  if (loading) {
    return (
      <PageScaffold wide>
        <p className="text-sm text-[var(--ink-soft)]">Loading dashboard…</p>
      </PageScaffold>
    );
  }

  if (!config) {
    return (
      <PageScaffold wide>
        <p className="text-sm text-[var(--danger)]">{error || "Could not load dashboard"}</p>
      </PageScaffold>
    );
  }

  const n = taskCount ?? 0;
  const attention =
    taskCount == null
      ? "What needs your attention right now."
      : n === 0
        ? "You're all caught up."
        : n === 1
          ? "1 task needs your attention."
          : `${n} tasks need your attention.`;

  const deskCtaLink = (
    <Link
      href="/sales-desk"
      className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--ink-inverse)] shadow-[var(--shadow-1)] transition-[background,transform] duration-[var(--motion-fast)] hover:bg-[var(--brand-dark)] active:scale-[var(--press-scale)]"
    >
      Open Order Desk →
    </Link>
  );

  const heroTitle = roleLabel || "Dashboard";
  const heroDescription = phoneOps ? (
    attention
  ) : (
    <>
      <span className="block">
        {greeting}, {displayName}
      </span>
      <span className="mt-0.5 block">{attention}</span>
    </>
  );

  return (
    <PageScaffold
      wide
      hero={{
        title: heroTitle,
        description: heroDescription,
        actions: deskCtaLink,
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

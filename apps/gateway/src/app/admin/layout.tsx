"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, clearAuth } from "@/lib/api-client";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  keywords: string[];
};

const GROUPS: Array<{ title: string; key: string; items: NavItem[] }> = [
  {
    key: "overview",
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "DB", keywords: ["home", "overview"] }],
  },
  {
    key: "commerce",
    title: "Commerce",
    items: [
      { href: "/admin/sales", label: "Sales and CRM", icon: "SC", keywords: ["leads", "orders", "quotes"] },
      { href: "/admin/inventory", label: "Inventory", icon: "IN", keywords: ["stock", "products"] },
      { href: "/admin/pos", label: "POS", icon: "PS", keywords: ["checkout", "counter"] },
      { href: "/admin/delivery", label: "Delivery", icon: "DL", keywords: ["dispatch", "last mile"] },
    ],
  },
  {
    key: "insights",
    title: "Insights",
    items: [
      { href: "/admin/promotions", label: "Promotions", icon: "PM", keywords: ["offers", "campaign"] },
      { href: "/admin/reports", label: "Reports", icon: "RP", keywords: ["analytics", "kpi"] },
      { href: "/admin/settings", label: "Settings", icon: "ST", keywords: ["config", "preferences"] },
    ],
  },
];

function startsWithPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    commerce: true,
    insights: true,
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/admin/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  const pathname = typeof window !== "undefined" ? window.location.pathname : "/admin";

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;

    return GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => `${item.label} ${item.href} ${item.keywords.join(" ")}`.toLowerCase().includes(q)),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className={`${collapsed ? "w-20" : "w-72"} flex flex-col bg-slate-950 text-white border-r border-slate-800 transition-all duration-200`}>
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2">
            {!collapsed && <div className="text-lg font-semibold tracking-tight">ERP Admin</div>}
            <button
              type="button"
              className="h-8 w-8 rounded-md border border-slate-700 hover:bg-slate-800 text-sm"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Toggle sidebar"
            >
              {collapsed ? ">" : "<"}
            </button>
          </div>
          {!collapsed && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-900/60 text-emerald-300 px-2 py-0.5">LIVE</span>
              <span className="rounded-full bg-sky-900/60 text-sky-300 px-2 py-0.5">ADMIN</span>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 py-3 border-b border-slate-800">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm placeholder:text-slate-500 outline-none focus:border-cyan-500"
            />
          </div>
        )}

        <nav className="flex-1 space-y-2 p-3 overflow-y-auto">
          {filteredGroups.map((group) => {
            const expanded = openGroups[group.key] ?? true;
            return (
              <section key={group.key} className="rounded-lg border border-slate-800 bg-slate-900/40">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 hover:text-slate-200"
                  >
                    <span>{group.title}</span>
                    <span>{expanded ? "-" : "+"}</span>
                  </button>
                )}
                {(collapsed || expanded) && (
                  <div className="pb-2">
                    {group.items.map((item) => {
                      const active = startsWithPath(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`group relative mx-1 mt-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${active ? "bg-cyan-600/15 text-cyan-200" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
                          title={collapsed ? item.label : undefined}
                        >
                          {active && <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r bg-cyan-400" />}
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold border ${active ? "border-cyan-400/60 bg-cyan-500/15" : "border-slate-700 bg-slate-900"}`}>
                            {item.icon}
                          </span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <button
          onClick={() => { clearAuth(); router.replace("/admin/login"); }}
          className="m-3 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white text-left"
        >
          {collapsed ? "SO" : "Sign out"}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

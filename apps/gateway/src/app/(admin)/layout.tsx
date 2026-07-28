"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getToken, clearAuth, getAdminUser } from "@/lib/admin-api";
import {
  canAccessModule,
  defaultHomePath,
  pathToModuleKey,
  resolveNavModules,
  type NavModuleKey,
} from "@/lib/nav-access";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  keywords: string[];
  module: NavModuleKey;
};

type NavGroup = {
  key: string;
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "core",
    title: "Catalog",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "DB", keywords: ["home", "kpi", "summary"], module: "dashboard" },
      { href: "/products", label: "Products", icon: "PR", keywords: ["catalog", "inventory", "attributes", "custom fields", "size"], module: "products" },
      { href: "/customers", label: "Customers", icon: "CU", keywords: ["accounts", "buyers", "mobile"], module: "customers" },
    ],
  },
  {
    key: "orderDesk",
    title: "Order desk",
    items: [
      {
        href: "/oms",
        label: "OMS Workflow",
        icon: "OM",
        keywords: ["order lifecycle", "review", "pricing", "dispatch", "trading"],
        module: "oms",
      },
      {
        href: "/orders",
        label: "Orders",
        icon: "SO",
        keywords: ["sales order", "edit lines", "fulfillment"],
        module: "orders",
      },
    ],
  },
  {
    key: "supply",
    title: "Procurement",
    items: [
      { href: "/vendors", label: "Vendors", icon: "VN", keywords: ["supplier", "partner", "whatsapp"], module: "vendors" },
      { href: "/purchase-orders", label: "Purchase Orders", icon: "PO", keywords: ["procurement", "buy", "rfq"], module: "purchase_orders" },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    items: [
      { href: "/invoices", label: "Invoices", icon: "IV", keywords: ["billing", "ar"], module: "invoices" },
      { href: "/returns", label: "Returns", icon: "RT", keywords: ["sales return", "credit note"], module: "returns" },
    ],
  },
  {
    key: "crm",
    title: "CRM (optional)",
    items: [
      { href: "/leads", label: "Leads", icon: "LD", keywords: ["prospects", "pipeline"], module: "leads" },
      { href: "/opportunities", label: "Deals", icon: "DL", keywords: ["opportunity", "deal", "stage"], module: "opportunities" },
      { href: "/quotes", label: "Quotes", icon: "QT", keywords: ["proposal", "pricing"], module: "quotes" },
    ],
  },
  {
    key: "hr",
    title: "People",
    items: [
      { href: "/employees", label: "Employees", icon: "EM", keywords: ["staff", "people"], module: "employees" },
      { href: "/payroll", label: "Payroll", icon: "PY", keywords: ["salary", "compensation"], module: "payroll" },
    ],
  },
];

const QUICK_ACTIONS: NavItem[] = [
  { href: "/oms", label: "OMS Queue", icon: "OM", keywords: ["oms", "review"], module: "oms" },
  { href: "/orders", label: "Orders", icon: "NO", keywords: ["order"], module: "orders" },
  { href: "/products", label: "Products", icon: "PR", keywords: ["catalog"], module: "products" },
  { href: "/purchase-orders", label: "New PO", icon: "PO", keywords: ["procurement"], module: "purchase_orders" },
  { href: "/invoices", label: "Invoices", icon: "NI", keywords: ["invoice"], module: "invoices" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [sessionUser, setSessionUser] = useState<ReturnType<typeof getAdminUser>>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    core: true,
    orderDesk: true,
    supply: true,
    finance: true,
    crm: false,
    hr: false,
  });

  const allowed = useMemo(
    () => resolveNavModules(sessionUser?.role, sessionUser?.navModules),
    [sessionUser?.role, sessionUser?.navModules]
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const user = getAdminUser();
    setSessionUser(user);
    const mods = resolveNavModules(user?.role, user?.navModules);
    if (mods.size === 0) {
      clearAuth();
      router.replace("/login");
      return;
    }
    const mod = pathToModuleKey(pathname);
    if (mod && !canAccessModule(mods, mod)) {
      router.replace(defaultHomePath(mods));
      return;
    }
    setReady(true);
  }, [router, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canAccessModule(allowed, item.module)) return false;
        if (!normalizedQuery) return true;
        const hay = `${item.label} ${item.href} ${item.keywords.join(" ")}`.toLowerCase();
        return hay.includes(normalizedQuery);
      }),
    })).filter((group) => group.items.length > 0);
  }, [normalizedQuery, allowed]);

  const visibleQuickActions = useMemo(
    () => QUICK_ACTIONS.filter((a) => canAccessModule(allowed, a.module)),
    [allowed]
  );

  const flatNavItems = NAV_GROUPS.flatMap((group) => group.items);

  if (!ready) return null;

  const activeTitle = flatNavItems.find((item) => isActivePath(pathname, item.href))?.label ?? "Admin";
  const displayName = sessionUser?.name || sessionUser?.email || "User";
  const displayRole = sessionUser?.role || "USER";

  const Sidebar = (
    <aside
      className={`
        ${collapsed ? "w-20" : "w-80"}
        admin-sidebar h-full flex flex-col shrink-0 transition-all duration-200
      `}
    >
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber-soft)]">
              Admin
            </div>
            {!collapsed && (
              <div className="font-display text-xl font-semibold leading-tight truncate mt-1">
                Trust Wood
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden md:inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/15 hover:bg-white/10 text-white/70"
            aria-label="Toggle sidebar"
          >
            {collapsed ? ">" : "<"}
          </button>
        </div>
        {!collapsed && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-[var(--amber)]/20 text-[var(--amber-soft)] px-2 py-0.5 font-semibold">
              ERP
            </span>
            <span className="rounded-full bg-white/10 text-white/70 px-2 py-0.5 truncate max-w-[12rem]">
              {displayRole}
            </span>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/10">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm placeholder:text-white/35 outline-none focus:border-[var(--amber)]/50"
          />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {filteredGroups.map((group) => {
          const expanded = openGroups[group.key] ?? true;
          return (
            <section key={group.key} className="rounded-xl border border-white/10 bg-white/[0.03]">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wide text-white/45 hover:text-white/80"
                >
                  <span>{group.title}</span>
                  <span>{expanded ? "-" : "+"}</span>
                </button>
              )}
              {(collapsed || expanded) && (
                <div className="pb-2">
                  {group.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <div key={`${group.key}-${item.href}`}>
                        <Link
                          href={item.href}
                          className={`
                            group relative mx-1 mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition
                            ${active ? "admin-nav-active" : "text-white/70 hover:bg-white/8 hover:text-white"}
                          `}
                          title={collapsed ? item.label : undefined}
                        >
                          {active && (
                            <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r bg-[var(--amber)]" />
                          )}
                          <span
                            className={`
                              inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold border
                              ${active ? "border-[var(--amber)]/50 bg-[var(--amber)]/15" : "border-white/15 bg-white/5"}
                            `}
                          >
                            {item.icon}
                          </span>
                          {!collapsed && (
                            <>
                              <span className="truncate">{item.label}</span>
                              {item.badge && (
                                <span className="ml-auto rounded-full bg-white/10 text-white/50 text-[10px] px-2 py-0.5">
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </nav>

      {!collapsed && visibleQuickActions.length > 0 && (
        <div className="px-4 py-3 border-t border-white/10">
          <div className="text-[11px] uppercase tracking-wide text-white/45 mb-2">Quick Actions</div>
          <div className="grid grid-cols-2 gap-2">
            {visibleQuickActions.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-2 text-xs text-white/85"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-4 border-t border-white/10">
        {!collapsed && (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-[var(--amber)]/20 border border-[var(--amber)]/30 flex items-center justify-center text-xs font-semibold text-[var(--amber-soft)]">
              {initials(displayName)}
            </div>
            <div className="min-w-0">
              <div className="text-sm leading-tight truncate">{displayName}</div>
              <div className="text-[11px] text-white/45 truncate">{displayRole}</div>
            </div>
          </div>
        )}
        <button
          onClick={() => {
            clearAuth();
            router.push("/login");
          }}
          className={`w-full rounded-xl border border-white/15 hover:bg-white/10 px-3 py-2 text-sm text-left ${collapsed ? "text-center" : "text-white/75"}`}
        >
          {collapsed ? "SO" : "Sign Out"}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="admin-shell">
      <div className="hidden md:flex">{Sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-[#121a16]/70"
            aria-label="Close sidebar"
          />
          <div className="absolute left-0 top-0 h-full">{Sidebar}</div>
        </div>
      )}

      <main className="admin-main min-w-0">
        <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--paper)_92%,white)]/90 backdrop-blur border-b border-[var(--line)] px-4 md:px-8 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-xl border border-[var(--line)] bg-white text-[var(--ink-soft)]"
            aria-label="Open sidebar"
          >
            ≡
          </button>
          <div className="text-sm text-[var(--ink-soft)]/60">Trust Wood</div>
          <div className="text-sm text-[var(--line)]">/</div>
          <div className="text-sm font-semibold text-[var(--ink)] truncate">{activeTitle}</div>
        </header>
        {children}
      </main>
    </div>
  );
}

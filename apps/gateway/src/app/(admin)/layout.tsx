"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AdminShell, type AdminNavGroup, type AdminNavItem } from "@erp/ui";
import { api, getToken, clearAuth, getAdminUser, getTenantId } from "@/lib/admin-api";
import {
  canAccessModule,
  defaultHomePath,
  pathToModuleKey,
  resolveNavModules,
  type NavModuleKey,
} from "@/lib/nav-access";

type NavItem = AdminNavItem & {
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
      { href: "/products", label: "Products", icon: "PR", keywords: ["catalog", "inventory", "sku", "catalog manager"], module: "products" },
      { href: "/categories", label: "Categories", icon: "CA", keywords: ["category", "taxonomy"], module: "products" },
      { href: "/brands", label: "Brands", icon: "BR", keywords: ["brand", "manufacturer"], module: "products" },
      { href: "/attributes", label: "Attributes", icon: "AT", keywords: ["custom fields", "identity", "attributes"], module: "products" },
      { href: "/price-lists", label: "Price Lists", icon: "PL", keywords: ["pricing", "list price"], module: "products" },
      { href: "/customers", label: "Customers", icon: "CU", keywords: ["accounts", "buyers", "mobile"], module: "customers" },
    ],
  },
  {
    key: "orderDesk",
    title: "Order desk",
    items: [
      {
        href: "/sales-desk",
        label: "Sales Desk",
        icon: "OM",
        keywords: ["oms", "sales desk", "sreq", "convert", "order lifecycle", "review", "pricing", "dispatch", "trading"],
        module: "oms",
      },
      {
        href: "/orders",
        label: "Orders (counter)",
        icon: "SO",
        keywords: ["sales order", "quick sale", "barcode", "grocery", "fulfillment"],
        module: "orders",
      },
    ],
  },
  {
    key: "processStudio",
    title: "Process Studio",
    items: [
      {
        href: "/configuration",
        label: "Process Studio",
        icon: "PS",
        keywords: ["forms", "metadata", "studio", "rules", "numbering", "templates", "process owner"],
        module: "configuration",
      },
      {
        href: "/workflows",
        label: "Workflows",
        icon: "WF",
        keywords: ["workflow", "designer", "template", "bpm", "canvas", "publish", "process owner"],
        module: "workflows",
      },
    ],
  },
  {
    key: "administration",
    title: "Administration",
    items: [
      {
        href: "/administration",
        label: "Organization",
        icon: "TN",
        keywords: ["tenant", "settings", "modules", "branding", "portal", "branches", "security"],
        module: "administration",
      },
      {
        href: "/users",
        label: "Users",
        icon: "US",
        keywords: ["team", "invite", "role", "process owner", "catalog manager", "sales executive"],
        module: "users",
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
  { href: "/sales-desk", label: "Sales Desk", icon: "OM", keywords: ["oms", "review", "sales desk"], module: "oms" },
  { href: "/orders", label: "Orders", icon: "NO", keywords: ["order"], module: "orders" },
  { href: "/products", label: "Products", icon: "PR", keywords: ["catalog"], module: "products" },
  { href: "/purchase-orders", label: "New PO", icon: "PO", keywords: ["procurement"], module: "purchase_orders" },
  { href: "/invoices", label: "Invoices", icon: "NI", keywords: ["invoice"], module: "invoices" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [sessionUser, setSessionUser] = useState<ReturnType<typeof getAdminUser>>(null);
  const [tenantDisplayName, setTenantDisplayName] = useState("TrustWood");

  const allowed = useMemo(
    () => resolveNavModules(sessionUser?.role, sessionUser?.navModules, sessionUser?.capabilities),
    [sessionUser?.role, sessionUser?.navModules, sessionUser?.capabilities]
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const user = getAdminUser();
    setSessionUser(user);
    const mods = resolveNavModules(user?.role, user?.navModules, user?.capabilities);
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
    const tenantId = getTenantId();
    if (!tenantId || !getToken()) return;
    void api(`/api/tenants/${tenantId}`)
      .then((r) => {
        const settings = (r.data?.settings ?? {}) as Record<string, string>;
        const name =
          settings["brand.displayName"]?.trim() ||
          (r.data?.name as string | undefined)?.trim() ||
          "TrustWood";
        setTenantDisplayName(name);
        if (typeof document !== "undefined") {
          document.title = `${name} Admin`;
        }
      })
      .catch(() => setTenantDisplayName("TrustWood"));
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups: AdminNavGroup[] = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      key: group.key,
      title: group.title,
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

  if (!ready) return null;

  const displayName = sessionUser?.name || sessionUser?.email || "User";
  const displayRole = sessionUser?.role || "USER";

  return (
    <AdminShell
      brandEyebrow="TrustWood"
      brandTitle={tenantDisplayName}
      brandContext={displayRole}
      groups={filteredGroups}
      pathname={pathname}
      LinkComponent={({ href, children: c, className, title }) => (
        <Link href={href} className={className} title={title}>
          {c}
        </Link>
      )}
      search={{ value: query, onChange: setQuery, placeholder: "Search modules" }}
      quickActions={visibleQuickActions}
      user={{
        name: displayName,
        subtitle: displayRole,
        onSignOut: () => {
          clearAuth();
          router.push("/login");
        },
      }}
      defaultOpenGroups={{
        core: true,
        orderDesk: true,
        processStudio: true,
        administration: true,
        supply: true,
        finance: true,
        crm: false,
        hr: false,
      }}
    >
      {children}
    </AdminShell>
  );
}

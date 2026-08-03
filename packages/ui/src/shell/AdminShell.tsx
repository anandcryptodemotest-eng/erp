"use client";

import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ChevronLeft, ChevronRight, LogOut, Menu } from "../icons";
import { cn } from "../utils";

export type AdminNavItem = {
  href: string;
  label: string;
  /** Lucide node preferred; short string falls back to monogram */
  icon?: ReactNode;
  badge?: string;
  soon?: boolean;
};

export type AdminNavGroup = {
  key: string;
  title: string;
  items: AdminNavItem[];
};

export type AdminShellLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

export type AdminShellProps = {
  brandEyebrow: string;
  brandTitle: string;
  /** Optional context line under title (e.g. role or org). */
  brandContext?: string;
  groups: AdminNavGroup[];
  pathname: string;
  LinkComponent: (props: AdminShellLinkProps) => ReactNode;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  quickActions?: AdminNavItem[];
  user: { name: string; subtitle?: string; onSignOut: () => void };
  headerLeft?: ReactNode;
  headerTitle?: string;
  issueSlot?: ReactNode;
  children: ReactNode;
  defaultOpenGroups?: Record<string, boolean>;
  /** @deprecated */
  brandChip?: string;
  /** @deprecated */
  roleChip?: string;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/" || href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string): string {
  const emailLocal = name.includes("@") ? name.split("@")[0]! : name;
  return emailLocal
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NavIcon({ icon, active }: { icon?: ReactNode; active: boolean }) {
  if (icon == null) return null;
  const isString = typeof icon === "string";
  return (
    <span className={cn("admin-nav-icon", active && "is-active")} aria-hidden>
      {isString ? <span style={{ fontSize: 10, fontWeight: 600 }}>{icon}</span> : icon}
    </span>
  );
}

type SidebarBodyProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  brandEyebrow: string;
  brandTitle: string;
  brandContext?: string;
  groups: AdminNavGroup[];
  multiGroup: boolean;
  openGroups: Record<string, boolean>;
  setOpenGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  pathname: string;
  LinkComponent: AdminShellProps["LinkComponent"];
  search?: AdminShellProps["search"];
  quickActions?: AdminNavItem[];
  user: AdminShellProps["user"];
  issueSlot?: ReactNode;
};

function SidebarBody({
  collapsed,
  onToggleCollapsed,
  brandEyebrow,
  brandTitle,
  brandContext,
  groups,
  multiGroup,
  openGroups,
  setOpenGroups,
  pathname,
  LinkComponent,
  search,
  quickActions,
  user,
  issueSlot,
}: SidebarBodyProps) {
  return (
    <aside className={cn("admin-sidebar", collapsed && "is-collapsed")}>
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__mark" aria-hidden>
          T
        </div>
        {!collapsed && (
          <div className="admin-sidebar__brand-text">
            <p className="admin-sidebar__eyebrow">{brandEyebrow}</p>
            <p className="admin-sidebar__title">{brandTitle}</p>
            {brandContext ? <p className="admin-sidebar__context">{brandContext}</p> : null}
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="admin-shell__collapse-btn"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && search ? (
        <div className="admin-sidebar__search">
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Search modules"}
          />
        </div>
      ) : null}

      <nav className="admin-sidebar__nav">
        {groups.map((group) => {
          const expanded = openGroups[group.key] ?? true;
          return (
            <div key={group.key} className="admin-sidebar__group">
              {multiGroup && !collapsed ? (
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !expanded }))}
                  className="admin-sidebar__group-title"
                >
                  <span>{group.title}</span>
                  <span>{expanded ? "–" : "+"}</span>
                </button>
              ) : null}
              {(collapsed || expanded || !multiGroup) && (
                <ul className="admin-sidebar__list">
                  {group.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <li key={`${group.key}-${item.href}`}>
                        <LinkComponent
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          className={cn("admin-nav-link", active && "admin-nav-active")}
                        >
                          {active ? <span className="admin-nav-rail" aria-hidden /> : null}
                          <NavIcon icon={item.icon} active={active} />
                          {!collapsed && (
                            <>
                              <span className="admin-nav-label">{item.label}</span>
                              {item.soon ? <span className="admin-nav-soon">Soon</span> : null}
                              {item.badge ? <span className="admin-nav-soon">{item.badge}</span> : null}
                            </>
                          )}
                        </LinkComponent>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {!collapsed && quickActions && quickActions.length > 0 ? (
        <div className="admin-sidebar__quick">
          <p className="admin-sidebar__quick-title">Quick</p>
          <div className="admin-sidebar__quick-grid">
            {quickActions.map((item) => (
              <LinkComponent key={item.label} href={item.href}>
                {item.label}
              </LinkComponent>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin-sidebar__footer">
        {issueSlot && !collapsed ? <div style={{ marginBottom: 8 }}>{issueSlot}</div> : null}
        <div className="admin-sidebar__user">
          <div className="admin-sidebar__avatar">{initials(user.name)}</div>
          {!collapsed && (
            <div className="admin-sidebar__user-meta">
              <p className="admin-sidebar__user-name">{user.name}</p>
              {user.subtitle ? <p className="admin-sidebar__user-sub">{user.subtitle}</p> : null}
            </div>
          )}
          <button
            type="button"
            onClick={user.onSignOut}
            className="admin-sidebar__signout"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AdminShell({
  brandEyebrow,
  brandTitle,
  brandContext,
  groups,
  pathname,
  LinkComponent,
  search,
  quickActions,
  user,
  headerLeft,
  headerTitle,
  issueSlot,
  children,
  defaultOpenGroups,
}: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of groups) init[g.key] = defaultOpenGroups?.[g.key] ?? true;
    return init;
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const activeTitle =
    headerTitle ??
    groups.flatMap((g) => g.items).find((item) => isActivePath(pathname, item.href))?.label ??
    "Admin";

  const multiGroup = groups.length > 1;

  const sidebarProps: SidebarBodyProps = {
    collapsed,
    onToggleCollapsed: () => setCollapsed((v) => !v),
    brandEyebrow,
    brandTitle,
    brandContext,
    groups,
    multiGroup,
    openGroups,
    setOpenGroups,
    pathname,
    LinkComponent,
    search,
    quickActions,
    user,
    issueSlot,
  };

  return (
    <div className="admin-shell">
      <div className="admin-shell__rail">
        <SidebarBody {...sidebarProps} />
      </div>

      <div className={cn("admin-shell__drawer", mobileOpen && "is-open")}>
        <button
          type="button"
          className="admin-shell__drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        />
        <div className="admin-shell__drawer-panel">
          <SidebarBody {...sidebarProps} />
        </div>
      </div>

      <main className="admin-main">
        <header className="admin-main__header">
          <button
            type="button"
            className="admin-shell__menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          {headerLeft ?? <span className="admin-main__crumb">{brandTitle}</span>}
          <span className="admin-main__sep" aria-hidden>
            /
          </span>
          <span className="admin-main__title">{activeTitle}</span>
        </header>
        {children}
      </main>
    </div>
  );
}

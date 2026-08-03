"use client";

import type { ElementType, ReactNode } from "react";
import { cn } from "../utils";

export type BottomNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
};

/** @maturity beta */
export function BottomNav({
  items,
  pathname,
  className,
  linkComponent: LinkComp,
}: {
  items: BottomNavItem[];
  pathname: string;
  className?: string;
  linkComponent?: ElementType;
}) {
  const Link = LinkComp ?? "a";
  return (
    <nav
      className={cn(
        "sticky bottom-0 z-[var(--z-nav)] border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_88%,white)] backdrop-blur-md",
        className
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <div className="flex px-1">
        {items.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[var(--touch-min)] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors duration-[var(--motion-fast)]",
                active ? "text-[var(--forest)]" : "text-[var(--ink-soft)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--forest)]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                {item.icon}
                {item.badge != null && item.badge > 0 ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--amber)] px-1 text-[9px] font-bold text-[var(--ink)]">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** @maturity beta */
export function Container({
  layout = "wide",
  className,
  children,
}: {
  layout?: "compact" | "medium" | "wide" | "full";
  className?: string;
  children: ReactNode;
}) {
  const max =
    layout === "compact"
      ? "max-w-[var(--layout-compact)]"
      : layout === "medium"
        ? "max-w-[var(--layout-medium)]"
        : layout === "full"
          ? "max-w-[var(--layout-full)]"
          : "max-w-[var(--layout-wide)]";
  return <div className={cn("mx-auto w-full px-4 md:px-6", max, className)}>{children}</div>;
}

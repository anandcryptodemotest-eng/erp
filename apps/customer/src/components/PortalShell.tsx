"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@erp/ui";
import { isAuthenticated } from "@/lib/api-client";
import { cartCount, subscribeCart } from "@/lib/cart-store";
import { isAppChrome, usePresentationMode } from "@/lib/platform";
import { IconCart, IconHome, IconMessages, IconOrders, IconShop } from "@/components/nav-icons";
import { ProfileMenu } from "@/components/profile/ProfileMenu";
import { useTenantDisplayName } from "@/components/TenantBrandingProvider";

function requiresAuth(pathname: string): boolean {
  return (
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/profile")
    || pathname.startsWith("/inbox")
  );
}

function SearchField({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
    else router.push("/search");
  }

  return (
    <form onSubmit={onSubmit} className={`portal-search ${className ?? ""}`} role="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search plywood, timber, SKU…"
        aria-label="Search products"
      />
    </form>
  );
}

function MainBottomNav({
  pathname,
  count,
}: {
  pathname: string;
  count: number;
}) {
  const items = [
    { href: "/", label: "Home", icon: <IconHome className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" /> },
    { href: "/shop", label: "Shop", icon: <IconShop className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" /> },
    {
      href: "/cart",
      label: "Cart",
      icon: <IconCart className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" />,
      badge: count,
    },
    {
      href: "/orders",
      label: "Orders",
      icon: <IconOrders className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" />,
    },
    {
      href: "/inbox",
      label: "Messages",
      icon: <IconMessages className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" />,
    },
  ] as const;

  return (
    <nav
      className="sticky bottom-0 z-[var(--z-nav)] border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_88%,white)] backdrop-blur-md"
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
              className={`relative flex min-h-[var(--touch-min)] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                active ? "text-[var(--forest)]" : "text-[var(--ink-soft)]"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                {item.icon}
                {"badge" in item && item.badge != null && item.badge > 0 ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--amber)] px-1 text-[9px] font-bold text-[var(--ink)]">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
        <ProfileMenu variant="nav" />
      </div>
    </nav>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mode = usePresentationMode();
  const appChrome = isAppChrome(mode);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [count, setCount] = useState(0);
  const orgName = useTenantDisplayName();

  useEffect(() => {
    const ok = isAuthenticated();
    setAuthed(ok);
    setCount(cartCount());
    setReady(true);
    if (requiresAuth(pathname) && !ok) {
      const ret = encodeURIComponent(
        pathname + (typeof window !== "undefined" ? window.location.search : "")
      );
      router.replace(`/login?returnTo=${ret}`);
    }
  }, [pathname, router]);

  useEffect(() => subscribeCart(() => setCount(cartCount())), []);

  if (!ready && requiresAuth(pathname)) {
    return (
      <div className="portal-shell flex min-h-dvh items-center justify-center text-sm text-[var(--ink-soft)]">
        Loading…
      </div>
    );
  }

  const hideBottomOnDesktopWeb = mode === "web" && !appChrome;
  const isPdp =
    pathname.startsWith("/shop/g/") || pathname.startsWith("/shop/p/");
  const showMobileTop = !isPdp;

  return (
    <div className="portal-shell" data-presentation={mode}>
      <div className="portal-frame relative flex flex-col">
        {mode === "web" && !appChrome ? (
          <header className="sticky top-0 z-30 hidden border-b border-[#e8e8e8] bg-white px-4 py-2.5 md:flex md:items-center md:gap-4">
            <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-[var(--forest)]">
              {orgName}
            </Link>
            <SearchField className="max-w-xl" />
            <nav className="ml-auto flex items-center gap-1 text-sm font-semibold text-[var(--ink-soft)]">
              <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-[#f5f5f5] hover:text-[var(--ink)]">
                Dashboard
              </Link>
              <Link href="/shop" className="rounded-md px-3 py-2 hover:bg-[#f5f5f5] hover:text-[var(--ink)]">
                Shop
              </Link>
              <Link href="/orders" className="rounded-md px-3 py-2 hover:bg-[#f5f5f5] hover:text-[var(--ink)]">
                Orders
              </Link>
              <Link href="/inbox" className="rounded-md px-3 py-2 hover:bg-[#f5f5f5] hover:text-[var(--ink)]">
                Messages
              </Link>
              <Link href="/cart" className="relative ml-1">
                <Button variant="primary" size="sm" className="!rounded-md">
                  Cart{count ? ` (${count})` : ""}
                </Button>
              </Link>
              {authed ? (
                <ProfileMenu variant="header" />
              ) : (
                <Link href="/login" className="rounded-md px-3 py-2 hover:bg-[#f5f5f5] hover:text-[var(--ink)]">
                  Sign in
                </Link>
              )}
            </nav>
          </header>
        ) : null}

        {showMobileTop ? (
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[#e8e8e8] bg-white px-3 py-2 md:hidden">
            <Link href="/" className="shrink-0 max-w-[9rem] truncate text-sm font-bold text-[var(--forest)]">
              {orgName}
            </Link>
            <SearchField />
            <Link
              href="/cart"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#f1f3f2] text-[var(--ink)]"
              aria-label={`Cart${count ? `, ${count} items` : ""}`}
            >
              <IconCart className="h-5 w-5" />
              {count > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--amber)] px-1 text-[10px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
          </header>
        ) : null}

        <main
          className={`flex-1 overflow-y-auto ${!isPdp && hideBottomOnDesktopWeb ? "md:pb-4" : "pb-2"}`}
        >
          {children}
        </main>

        {!isPdp ? (
          <div className={hideBottomOnDesktopWeb ? "md:hidden" : undefined}>
            <MainBottomNav pathname={pathname} count={count} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

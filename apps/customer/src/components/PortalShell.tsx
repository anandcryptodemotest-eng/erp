"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BottomNav,
  Button,
  Home,
  Inbox,
  Package,
  ScrollText,
  Search,
  ShoppingCart,
} from "@erp/ui";
import { isAuthenticated } from "@/lib/api-client";
import { cartCount, subscribeCart } from "@/lib/cart-store";
import { isAppChrome, usePresentationMode } from "@/lib/platform";
import { ProfileMenu } from "@/components/profile/ProfileMenu";
import { useTenantDisplayName } from "@/components/TenantBrandingProvider";

function requiresAuth(pathname: string): boolean {
  return (
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/inbox")
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
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search plywood, timber, SKU…"
        aria-label="Search products"
      />
    </form>
  );
}

function MainBottomNav({ pathname, count }: { pathname: string; count: number }) {
  const items = useMemo(
    () => [
      { href: "/", label: "Home", icon: <Home className="h-[var(--icon-md)] w-[var(--icon-md)]" /> },
      { href: "/shop", label: "Shop", icon: <Package className="h-[var(--icon-md)] w-[var(--icon-md)]" /> },
      {
        href: "/cart",
        label: "Cart",
        icon: <ShoppingCart className="h-[var(--icon-md)] w-[var(--icon-md)]" />,
        badge: count,
      },
      {
        href: "/orders",
        label: "Orders",
        icon: <ScrollText className="h-[var(--icon-md)] w-[var(--icon-md)]" />,
      },
      {
        href: "/inbox",
        label: "Messages",
        icon: <Inbox className="h-[var(--icon-md)] w-[var(--icon-md)]" />,
      },
    ],
    [count]
  );

  return (
    <div
      className="sticky bottom-0 z-[var(--z-nav)] flex border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-raised)_92%,transparent)] backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <BottomNav
        className="!static flex-1 !border-0 !bg-transparent !pb-0"
        items={items}
        pathname={pathname}
        linkComponent={Link}
      />
      <ProfileMenu variant="nav" />
    </div>
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
  const isPdp = pathname.startsWith("/shop/g/") || pathname.startsWith("/shop/p/");
  const showMobileTop = !isPdp;

  return (
    <div className="portal-shell" data-presentation={mode}>
      <div className="portal-frame relative flex flex-col">
        {mode === "web" && !appChrome ? (
          <header className="sticky top-0 z-30 hidden border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2.5 shadow-[var(--shadow-1)] md:flex md:items-center md:gap-4">
            <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-[var(--brand)]">
              {orgName}
            </Link>
            <SearchField className="max-w-xl" />
            <nav className="ml-auto flex items-center gap-1 text-sm font-semibold text-[var(--ink-soft)]">
              <Link href="/dashboard" className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[var(--mist)] hover:text-[var(--ink)]">
                Dashboard
              </Link>
              <Link href="/shop" className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[var(--mist)] hover:text-[var(--ink)]">
                Shop
              </Link>
              <Link href="/orders" className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[var(--mist)] hover:text-[var(--ink)]">
                Orders
              </Link>
              <Link href="/inbox" className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[var(--mist)] hover:text-[var(--ink)]">
                Messages
              </Link>
              <Link href="/cart" className="relative ml-1">
                <Button variant="primary" size="sm">
                  Cart{count ? ` (${count})` : ""}
                </Button>
              </Link>
              {authed ? (
                <ProfileMenu variant="header" />
              ) : (
                <Link href="/login" className="rounded-[var(--radius-sm)] px-3 py-2 hover:bg-[var(--mist)] hover:text-[var(--ink)]">
                  Sign in
                </Link>
              )}
            </nav>
          </header>
        ) : null}

        {showMobileTop ? (
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 shadow-[var(--shadow-1)] md:hidden">
            <Link href="/" className="max-w-[9rem] shrink-0 truncate text-sm font-bold text-[var(--brand)]">
              {orgName}
            </Link>
            <SearchField />
            <Link
              href="/cart"
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--mist)] text-[var(--ink)]"
              aria-label={`Cart${count ? `, ${count} items` : ""}`}
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-[var(--ink)]">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
          </header>
        ) : null}

        <main className={`flex-1 overflow-y-auto ${!isPdp && hideBottomOnDesktopWeb ? "md:pb-4" : "pb-2"}`}>
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

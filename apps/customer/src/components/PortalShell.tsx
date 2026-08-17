"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BottomNav,
  Button,
  CircleHelp,
  Home,
  Inbox,
  MapPin,
  Menu,
  Package,
  ScrollText,
  Search,
  ShoppingCart,
  User,
  X,
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
        placeholder="Search products…"
        aria-label="Search products"
      />
    </form>
  );
}

function MoreSheet({
  open,
  onClose,
  authed,
}: {
  open: boolean;
  onClose: () => void;
  authed: boolean;
}) {
  if (!open) return null;
  const links = [
    { href: "/inbox", label: "Messages", icon: Inbox },
    { href: "/account", label: "Account", icon: User },
    { href: "/account/support", label: "Help", icon: CircleHelp },
    { href: "/account/addresses", label: "Addresses", icon: MapPin },
  ];
  return (
    <div className="fixed inset-0 z-[var(--z-modal,60)] md:hidden" role="dialog" aria-label="More">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-[var(--surface-raised)] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <p className="text-sm font-bold text-[var(--ink)]">More</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--mist)]"
            aria-label="Close more menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="py-1">
          {links.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-[var(--ink)] active:bg-[var(--mist)]"
              >
                <Icon className="h-5 w-5 text-[var(--ink-soft)]" />
                {label}
              </Link>
            </li>
          ))}
          {!authed ? (
            <li>
              <Link
                href="/login"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-[var(--forest)] active:bg-[var(--mist)]"
              >
                <User className="h-5 w-5" />
                Sign in
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function MainBottomNav({
  pathname,
  count,
  onMore,
}: {
  pathname: string;
  count: number;
  onMore: () => void;
}) {
  const items = useMemo(
    () => [
      { href: "/home", label: "Home", icon: <Home className="h-[var(--icon-md)] w-[var(--icon-md)]" /> },
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
    ],
    [count]
  );

  const moreActive =
    pathname.startsWith("/inbox") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/profile");

  return (
    <div
      data-bottom-nav
      className="sticky bottom-0 z-[var(--z-nav)] flex border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-raised)_92%,transparent)] backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <BottomNav
        className="!static flex-1 !border-0 !bg-transparent !pb-0"
        items={items}
        pathname={pathname}
        linkComponent={Link}
      />
      <button
        type="button"
        onClick={onMore}
        className={`flex min-w-[3.5rem] flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-semibold ${
          moreActive ? "text-[var(--forest)]" : "text-[var(--ink-soft)]"
        }`}
        aria-label="More"
      >
        <Menu className="h-[var(--icon-md)] w-[var(--icon-md)]" />
        More
      </button>
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
  const [moreOpen, setMoreOpen] = useState(false);
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
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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
          <header className="sticky top-0 z-30 hidden border-b border-white/10 bg-[color-mix(in_srgb,var(--nav-bg)_78%,transparent)] px-4 py-2.5 backdrop-blur-md md:flex md:items-center md:gap-4">
            <Link href="/home" className="font-display shrink-0 text-lg font-semibold tracking-tight text-[var(--brand)]">
              {orgName}
            </Link>
            <SearchField className="max-w-xl" />
            <nav className="ml-auto flex items-center gap-1 text-sm font-semibold text-[var(--ink-soft)]">
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
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-[color-mix(in_srgb,var(--nav-bg)_78%,transparent)] px-3 py-2 backdrop-blur-md md:hidden">
            <Link href="/home" className="font-display max-w-[9rem] shrink-0 truncate text-sm font-semibold text-[var(--brand)]">
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
            <MainBottomNav pathname={pathname} count={count} onMore={() => setMoreOpen(true)} />
          </div>
        ) : null}

        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} authed={authed} />
      </div>
    </div>
  );
}

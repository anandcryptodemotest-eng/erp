"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/api-client";
import { cartCount } from "@/lib/cart-store";
import { IconCart, IconHome, IconOrders, IconProfile, IconShop } from "@/components/nav-icons";

const NAV = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/products", label: "Shop", Icon: IconShop },
  { href: "/cart", label: "Cart", Icon: IconCart },
  { href: "/orders", label: "Orders", Icon: IconOrders },
  { href: "/profile", label: "Profile", Icon: IconProfile },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setReady(true);
      setCount(cartCount());
    }
  }, [router]);

  useEffect(() => {
    setCount(cartCount());
  }, [pathname]);

  if (!ready) {
    return (
      <div className="portal-shell flex min-h-dvh items-center justify-center text-sm text-[var(--ink-soft)]">
        Loading portal…
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <div className="portal-frame relative flex flex-col">
        <main className="flex-1 overflow-y-auto pb-4">{children}</main>

        <nav
          className="bottom-nav sticky bottom-0 z-50 mt-auto"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex px-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                    active ? "text-[var(--forest-mid)]" : "text-[var(--ink-soft)]/55 hover:text-[var(--ink)]"
                  }`}
                >
                  {active && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[var(--amber)]" />
                  )}
                  <span className="relative">
                    <Icon />
                    {item.label === "Cart" && count > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--amber)] px-1 text-[9px] font-bold text-[var(--ink)]">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

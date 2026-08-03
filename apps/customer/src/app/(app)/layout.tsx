"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { BottomNav } from "@erp/ui";
import { isAuthenticated } from "@/lib/api-client";
import { cartCount, subscribeCart } from "@/lib/cart-store";
import { IconCart, IconHome, IconOrders, IconProfile, IconShop } from "@/components/nav-icons";

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

  useEffect(() => {
    return subscribeCart(() => setCount(cartCount()));
  }, []);

  if (!ready) {
    return (
      <div className="portal-shell flex min-h-dvh items-center justify-center text-sm text-[var(--ink-soft)]">
        Loading portal…
      </div>
    );
  }

  const navItems = [
    { href: "/", label: "Home", icon: <IconHome className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" /> },
    { href: "/products", label: "Shop", icon: <IconShop className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" /> },
    {
      href: "/cart",
      label: "Cart",
      icon: <IconCart className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" />,
      badge: count,
    },
    { href: "/orders", label: "Orders", icon: <IconOrders className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" /> },
    { href: "/profile", label: "Profile", icon: <IconProfile className="nav-icon h-[var(--icon-md)] w-[var(--icon-md)]" /> },
  ];

  return (
    <div className="portal-shell">
      <div className="portal-frame relative flex flex-col">
        <main className="flex-1 overflow-y-auto pb-2">{children}</main>
        <BottomNav items={navItems} pathname={pathname} linkComponent={Link} />
      </div>
    </div>
  );
}

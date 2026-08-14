"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { BottomNav, Button, LogOut, Package, Truck } from "@erp/ui";
import { isAuthenticated, clearAuth } from "@/lib/api-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router]);

  function signOut() {
    clearAuth();
    router.replace("/login");
  }

  const items = useMemo(
    () => [
      {
        href: "/home",
        label: "Deliveries",
        icon: <Truck className="h-[var(--icon-md)] w-[var(--icon-md)]" />,
      },
      {
        href: "/earnings",
        label: "Earnings",
        icon: <Package className="h-[var(--icon-md)] w-[var(--icon-md)]" />,
      },
    ],
    []
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[var(--canvas)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 shadow-[var(--shadow-1)]">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-[var(--accent)]" aria-hidden />
          <span className="font-display text-sm font-bold text-[var(--brand)]">Delivery</span>
        </div>
        <Button variant="outline" size="sm" onClick={signOut} className="gap-1.5">
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2">
        <BottomNav items={items} pathname={pathname} linkComponent={Link} />
      </div>
    </div>
  );
}

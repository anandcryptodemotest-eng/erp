"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, clearAuth } from "@/lib/api-client";

const NAV = [
  { href: "/home", label: "📦 Deliveries" },
  { href: "/earnings", label: "💰 Earnings" },
];

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

  return (
    <div className="flex min-h-screen flex-col bg-orange-50 max-w-md mx-auto">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛵</span>
          <span className="text-sm font-bold text-orange-600">SF Delivery</span>
        </div>
        <button onClick={signOut} className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-100">
          Sign Out
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-orange-100 bg-white">
        <div className="flex">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/home" && pathname.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href}
                className={`flex flex-1 flex-col items-center py-3 text-xs font-medium transition-colors
                  ${active ? "text-orange-600" : "text-stone-400 hover:text-stone-600"}`}>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

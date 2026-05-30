"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated } from "@/lib/api-client";
import { cartCount } from "@/lib/cart-store";

const NAV = [
  { href: "/",          label: "Home",    icon: "🏠" },
  { href: "/products",  label: "Shop",    icon: "🛍️" },
  { href: "/cart",      label: "Cart",    icon: "🛒" },
  { href: "/orders",    label: "Orders",  icon: "📦" },
  { href: "/profile",   label: "Profile", icon: "👤" },
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

  // Refresh cart count on navigation
  useEffect(() => {
    setCount(cartCount());
  }, [pathname]);

  if (!ready) return null;

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-white shadow-sm">
      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-1 flex-col items-center py-2 text-xs font-medium transition-colors relative ${active ? "text-green-600" : "text-gray-500 hover:text-gray-700"}`}>
                <span className="text-xl leading-none relative">
                  {item.icon}
                  {item.label === "Cart" && count > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </span>
                <span className="mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

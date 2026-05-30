"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getToken, clearAuth } from "@/lib/admin-api";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",   icon: "📊" },
  { href: "/products",   label: "Products",     icon: "📦" },
  { href: "/customers",  label: "Customers",    icon: "👥" },
  { href: "/orders",     label: "Orders",       icon: "🧾" },
  { href: "/invoices",   label: "Invoices",     icon: "💰" },
  { href: "/vendors",    label: "Vendors",      icon: "🏭" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: "📋" },
  { href: "/employees",  label: "Employees",    icon: "👤" },
  { href: "/payroll",    label: "Payroll",      icon: "💳" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <div className="text-lg font-bold">🛒 Simhapuri Fresh</div>
          <div className="text-xs text-gray-400 mt-0.5">Admin Portal</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${pathname === item.href ? "bg-green-700 text-white" : "text-gray-300 hover:bg-gray-800"}`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button onClick={() => { clearAuth(); router.push("/login"); }}
            className="w-full text-sm text-gray-400 hover:text-white transition text-left">
            ← Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

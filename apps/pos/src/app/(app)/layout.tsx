"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, clearAuth, getUserId } from "@/lib/api-client";
import { api } from "@/lib/api-client";

interface Shift { id: string; status: string; cashierId: string }

const NAV = [
  { href: "/",        label: "Shift",    icon: "⏱️" },
  { href: "/billing", label: "Billing",  icon: "🧾" },
  { href: "/holds",   label: "Holds",    icon: "⏸️" },
  { href: "/returns", label: "Returns",  icon: "↩️" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setReady(true);
    // Load open shift for this cashier
    const userId = getUserId();
    if (userId) {
      api<{ data: Shift[] }>("accounting", `/api/shifts?status=OPEN&cashierId=${userId}&limit=1`).then((r) => {
        if (!r.error && r.data.data.length > 0) setShift(r.data.data[0]);
      });
    }
  }, [router]);

  function signOut() {
    clearAuth();
    router.replace("/login");
  }

  if (!ready) return null;

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-emerald-400">🖥️ POS</span>
          {shift ? (
            <span className="rounded-full bg-emerald-900 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              Shift OPEN
            </span>
          ) : (
            <span className="rounded-full bg-yellow-900 px-2.5 py-0.5 text-xs font-medium text-yellow-300">
              No active shift
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button onClick={signOut}
            className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-400 hover:text-white">
            Sign out
          </button>
        </div>
      </header>

      {/* Side nav + content */}
      <div className="flex flex-1 overflow-hidden">
        <nav className="flex w-20 flex-col items-center gap-1 border-r border-slate-700 bg-slate-800 py-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 w-16 text-center transition-colors
                  ${active ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`}>
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main area */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

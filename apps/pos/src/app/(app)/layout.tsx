"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Package, ScrollText, StatusChip, Trash2 } from "@erp/ui";
import { isAuthenticated, clearAuth, getUserId, api } from "@/lib/api-client";

interface Shift {
  id: string;
  status: string;
  cashierId: string;
}

const NAV = [
  { href: "/", label: "Shift", icon: LayoutDashboard },
  { href: "/billing", label: "Billing", icon: Package },
  { href: "/holds", label: "Holds", icon: ScrollText },
  { href: "/returns", label: "Returns", icon: Trash2 },
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
    const userId = getUserId();
    if (userId) {
      api<{ data: Shift[] }>("accounting", `/api/shifts?status=OPEN&cashierId=${userId}&limit=1`).then(
        (r) => {
          if (!r.error && r.data && r.data.data.length > 0) setShift(r.data.data[0]);
        }
      );
    }
  }, [router]);

  function signOut() {
    clearAuth();
    router.replace("/login");
  }

  if (!ready) return null;

  return (
    <div className="flex h-screen flex-col bg-[var(--canvas)] text-[var(--ink)]">
      <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="font-display text-base font-bold text-[var(--brand-light)]">POS</span>
          {shift ? (
            <StatusChip tone="success">Shift open</StatusChip>
          ) : (
            <StatusChip tone="warning">No active shift</StatusChip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--ink-soft)]">
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="flex w-20 flex-col items-center gap-1 border-r border-[var(--line)] bg-[var(--surface)] py-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex w-16 flex-col items-center gap-1 rounded-[var(--radius-md)] px-2 py-3 text-center transition-colors ${
                  active
                    ? "bg-[var(--brand)] text-[var(--ink-inverse)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

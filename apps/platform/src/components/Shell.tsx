"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearPlatformAuth, getOperator } from "@/lib/api";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/tenants", label: "Tenants" },
  { href: "/process", label: "Process Studio" },
  { href: "/services", label: "Services" },
  { href: "/infrastructure", label: "Infrastructure", soon: true },
  { href: "/audit", label: "Audit Logs" },
  { href: "/settings", label: "Settings", soon: true },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const op = typeof window !== "undefined" ? getOperator() : null;

  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: "220px 1fr" }}>
      <aside className="border-r border-[var(--line)] bg-[var(--panel)] p-4 flex flex-col gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--muted)]">ERP</p>
          <h1 className="text-lg font-semibold">Platform Admin</h1>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm ${
                  active ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
                {item.soon ? <span className="ml-2 text-[10px] opacity-70">Soon</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto text-xs text-[var(--muted)] space-y-2">
          <p>{op?.email ?? "—"}</p>
          <p className="font-mono text-[10px]">{op?.role ?? ""}</p>
          <button
            type="button"
            className="text-[var(--accent)]"
            onClick={() => {
              clearPlatformAuth();
              router.push("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="p-6 md:p-8 overflow-auto">{children}</main>
    </div>
  );
}

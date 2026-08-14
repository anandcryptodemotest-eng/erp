"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function ProfileHeader({
  name,
  phone,
  email,
}: {
  name: string;
  phone?: string | null;
  email?: string | null;
}) {
  const initial = (name?.trim()?.[0] || "C").toUpperCase();
  const contact = [phone, email].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-xl font-bold text-white">
        {initial}
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-[var(--ink)]">{name}</h1>
        {contact ? (
          <p className="truncate text-sm text-[var(--ink-soft)]">{contact}</p>
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">Complete your details</p>
        )}
      </div>
    </div>
  );
}

export function RecentOrders({
  orders,
}: {
  orders: { id: string; requestNumber: string; statusLabel: string; href: string }[];
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="flex items-center justify-between border-b border-[#f0f0f0] px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
          Recent orders
        </h2>
        <Link href="/orders" className="text-xs font-semibold text-[var(--forest)]">
          View all
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[var(--ink-soft)]">
          No requests yet.{" "}
          <Link href="/shop" className="font-semibold text-[var(--forest)] underline">
            Start shopping
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-[#f0f0f0]">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={o.href}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-[var(--mist)]"
              >
                <span className="font-semibold text-[var(--ink)]">{o.requestNumber}</span>
                <span className="text-[var(--ink-soft)]">{o.statusLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MenuList({
  items,
}: {
  items: { href: string; label: string; meta?: string }[];
}) {
  return (
    <nav className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]">
      <ul className="divide-y divide-[#f0f0f0]">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--mist)]"
            >
              <span>{item.label}</span>
              <span className="flex items-center gap-2 text-[var(--ink-soft)]">
                {item.meta ? <span className="text-xs font-normal">{item.meta}</span> : null}
                <span aria-hidden>›</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function HelpCard({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--mist)] px-4 py-3 text-sm text-[var(--ink-soft)]">
      {children ?? (
        <>
          Need help with an order?{" "}
          <Link href="/profile/support" className="font-semibold text-[var(--forest)] underline">
            Contact support
          </Link>
        </>
      )}
    </div>
  );
}

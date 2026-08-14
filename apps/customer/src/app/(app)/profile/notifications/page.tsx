"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container, SectionHeader, Skeleton } from "@erp/ui";
import { api } from "@/lib/api-client";

interface Notification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export default function ProfileNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Notification[] }>("gateway", "/api/notifications?limit=40").then((r) => {
      if (!r.error) setItems(r.data?.data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <Link href="/profile" className="text-sm font-semibold text-[var(--forest)]">
        ← Profile
      </Link>
      <SectionHeader title="Notifications" className="mt-2" />
      {loading ? <Skeleton className="mt-4 h-24 w-full" /> : null}
      {!loading && items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-soft)]">No notifications yet.</p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border border-[var(--line)] px-4 py-3 text-sm ${
              n.isRead ? "bg-[var(--surface-raised)]" : "bg-[var(--accent-soft)]/30"
            }`}
          >
            <p className="font-semibold text-[var(--ink)]">{n.title}</p>
            <p className="text-[var(--ink-soft)]">{n.body}</p>
            <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </Container>
  );
}

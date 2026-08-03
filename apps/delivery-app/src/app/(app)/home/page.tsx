"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button, Chip, ChipGroup, Container, EmptyState, RouteCard, DeliveryStatus, SectionHeader, Skeleton } from "@erp/ui";
import { api, getUserId } from "@/lib/api-client";

interface Assignment {
  id: string;
  orderNumber: string;
  status: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
  assignedAt: string;
  notes?: string;
}

function statusTone(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "DELIVERED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "ASSIGNED") return "info";
  if (status === "ACCEPTED" || status === "PICKED_UP") return "warning";
  return "default";
}

export default function HomePage() {
  const [active, setActive] = useState<Assignment[]>([]);
  const [completed, setCompleted] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "done">("active");

  const load = useCallback(async () => {
    setLoading(true);
    const userId = getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    const [activeRes, doneRes] = await Promise.all([
      api<{ data: Assignment[] }>("delivery", `/api/assignments?executiveId=${userId}&limit=50`),
      api<{ data: Assignment[] }>("delivery", `/api/assignments?executiveId=${userId}&status=DELIVERED&limit=20`),
    ]);

    if (!activeRes.error && activeRes.data) {
      const all = activeRes.data.data ?? [];
      setActive(all.filter((a) => !["DELIVERED", "FAILED", "CANCELLED"].includes(a.status)));
    }
    if (!doneRes.error && doneRes.data) setCompleted(doneRes.data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const list = tab === "active" ? active : completed;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <Container layout="compact" className="py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <SectionHeader title="Today's deliveries" className="mb-0" />
          <p className="text-xs text-[var(--ink-soft)]">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "Pending", value: active.filter((a) => a.status === "ASSIGNED").length },
          {
            label: "In progress",
            value: active.filter((a) => ["ACCEPTED", "PICKED_UP"].includes(a.status)).length,
          },
          { label: "Done", value: completed.length },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-3 text-center shadow-[var(--shadow-sm)]"
          >
            <div className="text-2xl font-bold text-[var(--accent)]">{s.value}</div>
            <div className="text-xs text-[var(--ink-soft)]">{s.label}</div>
          </div>
        ))}
      </div>

      <ChipGroup className="mb-4">
        <Chip active={tab === "active"} onClick={() => setTab("active")} className="flex-1 justify-center">
          Active
        </Chip>
        <Chip active={tab === "done"} onClick={() => setTab("done")} className="flex-1 justify-center">
          Completed
        </Chip>
      </ChipGroup>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {!loading && list.length === 0 ? (
        <EmptyState
          title={tab === "active" ? "All clear" : "No completed deliveries"}
          subtitle={tab === "active" ? "No active deliveries right now." : "Completed runs will show here."}
        />
      ) : null}

      <div className="space-y-3">
        {list.map((a) => (
          <RouteCard
            key={a.id}
            href={`/assignments/${a.id}`}
            title={`#${a.orderNumber}`}
            subtitle={
              a.customerName
                ? `${a.customerName}${a.customerPhone ? ` · ${a.customerPhone}` : ""}`
                : a.deliveryAddress
            }
            status={<DeliveryStatus label={a.status.replace(/_/g, " ")} tone={statusTone(a.status)} />}
          >
            <p className="mt-2 truncate text-xs text-[var(--ink-soft)]">{a.deliveryAddress}</p>
          </RouteCard>
        ))}
      </div>
    </Container>
  );
}

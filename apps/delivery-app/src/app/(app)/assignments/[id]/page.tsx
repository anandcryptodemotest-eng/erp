"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Button, StatusChip, User } from "@erp/ui";
import { api } from "@/lib/api-client";

interface TrackingEntry {
  id: string;
  status: string;
  capturedAt: string;
  notes?: string;
}
interface Assignment {
  id: string;
  orderNumber: string;
  status: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
  assignedAt: string;
  notes?: string;
  tracking: TrackingEntry[];
}

const NEXT_ACTION: Record<string, { label: string; nextStatus: string } | null> = {
  ASSIGNED: { label: "Accept delivery", nextStatus: "ACCEPTED" },
  ACCEPTED: { label: "Mark picked up", nextStatus: "PICKED_UP" },
  PICKED_UP: { label: "Mark delivered", nextStatus: "DELIVERED" },
  DELIVERED: null,
  FAILED: null,
  CANCELLED: null,
};

const STATUS_STEPS = ["ASSIGNED", "ACCEPTED", "PICKED_UP", "DELIVERED"];

export default function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [failing, setFailing] = useState(false);
  const [failReason, setFailReason] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api<{ data: Assignment }>("delivery", `/api/assignments/${id}`);
    if (!res.error && res.data) setAssignment(res.data.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(nextStatus: string, extra?: Record<string, string>) {
    setActing(true);
    setError("");
    const res = await api("delivery", `/api/assignments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, ...extra }),
    });
    setActing(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    void load();
  }

  async function handleFail() {
    if (!failReason.trim()) {
      setError("Please enter a failure reason");
      return;
    }
    await updateStatus("FAILED", { failureReason: failReason });
    setFailing(false);
  }

  if (loading) return <div className="p-6 text-[var(--ink-soft)]">Loading…</div>;
  if (!assignment) return <div className="p-6 text-[var(--danger)]">Assignment not found</div>;

  const action = NEXT_ACTION[assignment.status];
  const currentStep = STATUS_STEPS.indexOf(assignment.status);
  const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(assignment.deliveryAddress)}`;

  return (
    <div className="space-y-4 p-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-bold text-[var(--ink)]">#{assignment.orderNumber}</h1>
            <div className="text-xs text-[var(--ink-soft)]">
              {new Date(assignment.assignedAt).toLocaleString("en-IN")}
            </div>
          </div>
          <StatusChip status={assignment.status} />
        </div>

        <div className="mb-1 flex items-center gap-1">
          {STATUS_STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div
                className={`h-2 flex-1 rounded-full ${
                  i <= currentStep ? "bg-[var(--accent)]" : "bg-[var(--mist)]"
                }`}
              />
              {i < STATUS_STEPS.length - 1 ? <div className="w-1" /> : null}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-[var(--ink-soft)]">
          <span>Assigned</span>
          <span>Accepted</span>
          <span>Picked up</span>
          <span>Delivered</span>
        </div>
      </div>

      <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)]">
        {assignment.customerName ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--mist)] text-[var(--accent)]">
              <User className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--ink)]">{assignment.customerName}</div>
              {assignment.customerPhone ? (
                <a
                  href={`tel:${assignment.customerPhone}`}
                  className="text-xs font-medium text-[var(--accent)]"
                >
                  {assignment.customerPhone}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mist)] text-sm font-bold text-[var(--accent)]">
            →
          </div>
          <div className="flex-1">
            <div className="text-sm text-[var(--ink)]">{assignment.deliveryAddress}</div>
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Open in Maps
            </a>
          </div>
        </div>
        {assignment.notes ? (
          <div className="rounded-[var(--radius-sm)] border border-[var(--accent-soft)]/40 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2 text-xs text-[var(--ink)]">
            {assignment.notes}
          </div>
        ) : null}
      </div>

      {assignment.tracking.length > 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-1)]">
          <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Activity</h2>
          <div className="space-y-2">
            {assignment.tracking.map((t) => (
              <div key={t.id} className="flex gap-3 text-xs">
                <div className="w-24 shrink-0 text-[var(--ink-soft)]">
                  {new Date(t.capturedAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div>
                  <span className="font-medium text-[var(--ink)]">{t.status}</span>
                  {t.notes ? <span className="text-[var(--ink-soft)]"> — {t.notes}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {action ? (
        <Button
          variant="primary"
          className="w-full"
          disabled={acting}
          onClick={() => void updateStatus(action.nextStatus)}
        >
          {acting ? "Updating…" : action.label}
        </Button>
      ) : null}

      {assignment.status === "PICKED_UP" && !failing ? (
        <Button variant="outline" className="w-full text-[var(--danger)]" onClick={() => setFailing(true)}>
          Report failed delivery
        </Button>
      ) : null}

      {failing ? (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--danger)]/40 bg-[var(--surface-raised)] p-4">
          <h3 className="text-sm font-semibold text-[var(--danger)]">Report failure</h3>
          <textarea
            value={failReason}
            onChange={(e) => setFailReason(e.target.value)}
            rows={3}
            placeholder="Customer not available, wrong address…"
            className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--line)] px-4 py-3 text-sm outline-none focus:border-[var(--danger)]"
          />
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" disabled={acting} onClick={() => void handleFail()}>
              {acting ? "…" : "Submit"}
            </Button>
            <Button variant="outline" onClick={() => setFailing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

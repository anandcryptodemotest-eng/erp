"use client";
import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

interface TrackingEntry { id: string; status: string; capturedAt: string; notes?: string }
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

const NEXT_ACTION: Record<string, { label: string; nextStatus: string; color: string } | null> = {
  ASSIGNED: { label: "Accept Delivery", nextStatus: "ACCEPTED", color: "bg-blue-500 hover:bg-blue-600" },
  ACCEPTED: { label: "Mark Picked Up", nextStatus: "PICKED_UP", color: "bg-orange-500 hover:bg-orange-600" },
  PICKED_UP: { label: "Mark Delivered", nextStatus: "DELIVERED", color: "bg-green-500 hover:bg-green-600" },
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
    if (!res.error) setAssignment(res.data.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(nextStatus: string, extra?: Record<string, string>) {
    setActing(true); setError("");
    const res = await api("delivery", `/api/assignments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, ...extra }),
    });
    setActing(false);
    if (res.error) { setError(res.error); return; }
    load();
  }

  async function handleFail() {
    if (!failReason.trim()) { setError("Please enter a failure reason"); return; }
    await updateStatus("FAILED", { failureReason: failReason });
    setFailing(false);
  }

  if (loading) return <div className="p-6 text-stone-400">Loading…</div>;
  if (!assignment) return <div className="p-6 text-red-500">Assignment not found</div>;

  const action = NEXT_ACTION[assignment.status];
  const currentStep = STATUS_STEPS.indexOf(assignment.status);
  const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(assignment.deliveryAddress)}`;

  return (
    <div className="p-4 space-y-4">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700">
        ‹ Back
      </button>

      {/* Header */}
      <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-stone-800">#{assignment.orderNumber}</h1>
            <div className="text-xs text-stone-400">{new Date(assignment.assignedAt).toLocaleString("en-IN")}</div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold
            ${assignment.status === "DELIVERED" ? "bg-green-100 text-green-700" :
              assignment.status === "FAILED" ? "bg-red-100 text-red-600" :
              assignment.status === "PICKED_UP" ? "bg-orange-100 text-orange-700" :
              assignment.status === "ACCEPTED" ? "bg-yellow-100 text-yellow-700" :
              "bg-blue-100 text-blue-700"}`}>
            {assignment.status}
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-1">
          {STATUS_STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div className={`h-2 flex-1 rounded-full ${i <= currentStep ? "bg-orange-400" : "bg-stone-200"}`} />
              {i < STATUS_STEPS.length - 1 && <div className="w-1" />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-stone-400">
          <span>Assigned</span><span>Accepted</span><span>Picked Up</span><span>Delivered</span>
        </div>
      </div>

      {/* Customer & Address */}
      <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm space-y-3">
        {assignment.customerName && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-lg">👤</div>
            <div>
              <div className="text-sm font-semibold text-stone-800">{assignment.customerName}</div>
              {assignment.customerPhone && (
                <a href={`tel:${assignment.customerPhone}`}
                  className="text-xs text-orange-500 font-medium">{assignment.customerPhone}</a>
              )}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg">📍</div>
          <div className="flex-1">
            <div className="text-sm text-stone-700">{assignment.deliveryAddress}</div>
            <a href={mapsLink} target="_blank" rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-orange-500 font-medium hover:underline">
              Open in Maps ↗
            </a>
          </div>
        </div>
        {assignment.notes && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
            📝 {assignment.notes}
          </div>
        )}
      </div>

      {/* Tracking timeline */}
      {assignment.tracking.length > 0 && (
        <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-stone-700">Activity</h2>
          <div className="space-y-2">
            {assignment.tracking.map((t) => (
              <div key={t.id} className="flex gap-3 text-xs">
                <div className="text-stone-400 w-24 flex-shrink-0">{new Date(t.capturedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                <div>
                  <span className="font-medium text-stone-700">{t.status}</span>
                  {t.notes && <span className="text-stone-400"> — {t.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Actions */}
      {action && (
        <button onClick={() => updateStatus(action.nextStatus)} disabled={acting}
          className={`w-full rounded-2xl py-4 text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50 ${action.color}`}>
          {acting ? "Updating…" : action.label}
        </button>
      )}

      {/* Fail delivery */}
      {assignment.status === "PICKED_UP" && !failing && (
        <button onClick={() => setFailing(true)}
          className="w-full rounded-2xl border border-red-200 py-3 text-sm font-medium text-red-500 hover:bg-red-50">
          Report Failed Delivery
        </button>
      )}

      {failing && (
        <div className="rounded-2xl bg-white border border-red-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-red-600">Report Failure</h3>
          <textarea value={failReason} onChange={(e) => setFailReason(e.target.value)} rows={3}
            placeholder="Customer not available, wrong address…"
            className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-red-400 resize-none" />
          <div className="flex gap-2">
            <button onClick={handleFail} disabled={acting}
              className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
              {acting ? "…" : "Submit"}
            </button>
            <button onClick={() => setFailing(false)}
              className="rounded-xl border border-stone-200 px-5 py-2.5 text-sm text-stone-500 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

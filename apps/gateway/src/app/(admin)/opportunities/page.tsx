"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/admin-api";
import LeadToCashGuide from "@/components/LeadToCashGuide";
import LeadToCashUnderstanding from "@/components/LeadToCashUnderstanding";

type OpportunityStage = "PROSPECTING" | "QUALIFICATION" | "PROPOSAL" | "NEGOTIATION" | "CLOSED";
type OpportunityStatus = "OPEN" | "WON" | "LOST";

interface Opportunity {
  id: string;
  title: string;
  value: number;
  stage: OpportunityStage;
  status: OpportunityStatus;
  probability: number;
  notes: string | null;
  createdAt: string;
  lead: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
}

const STAGE_ORDER: OpportunityStage[] = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED"];

const STAGE_COLORS: Record<OpportunityStage, string> = {
  PROSPECTING: "bg-slate-100 text-slate-700",
  QUALIFICATION: "bg-blue-100 text-blue-700",
  PROPOSAL: "bg-indigo-100 text-indigo-700",
  NEGOTIATION: "bg-amber-100 text-amber-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
};

const STATUS_COLORS: Record<OpportunityStatus, string> = {
  OPEN: "bg-sky-100 text-sky-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-rose-100 text-rose-700",
};

function nextStage(stage: OpportunityStage): OpportunityStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export default function OpportunitiesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [stageFilter, setStageFilter] = useState<"" | OpportunityStage>("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  function notify(text: string, type: "ok" | "err" = "ok") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (stageFilter) params.set("stage", stageFilter);
      const res = await api(`/api/opportunities?${params}`);
      setItems(res.data ?? []);
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to load opportunities", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [stageFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchOpportunity(opportunity: Opportunity, payload: Partial<Opportunity>) {
    try {
      await api(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      notify("Opportunity updated");
      if (selected?.id === opportunity.id) {
        setSelected({ ...selected, ...payload });
      }
      load();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : "Failed to update opportunity", "err");
    }
  }

  const stageCounts = STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = items.filter((i) => i.stage === stage).length;
    return acc;
  }, {} as Record<OpportunityStage, number>);

  return (
    <div className="p-6">
      <LeadToCashGuide current="opportunities" />
      <LeadToCashUnderstanding current="opportunities" />

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-sm text-gray-500">Manage stage progression and close deals with clear lifecycle actions.</p>
        </div>
        <Link href="/leads" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          + Convert from Leads
        </Link>
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${msgType === "ok" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-5">
        {STAGE_ORDER.map((stage) => {
          const active = stageFilter === stage;
          return (
            <button
              key={stage}
              onClick={() => setStageFilter(active ? "" : stage)}
              className={`rounded-lg border p-3 text-left transition ${active ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{stage}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STAGE_COLORS[stage]}`}>{stageCounts[stage]}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{stage === "CLOSED" ? "Terminal stage" : `Move next: ${nextStage(stage)}`}</p>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No opportunities found. Convert a QUALIFIED lead from the Leads page.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((op) => {
                const next = nextStage(op.stage);
                const canCreateQuote = op.status === "OPEN" && (op.stage === "PROPOSAL" || op.stage === "NEGOTIATION" || op.stage === "CLOSED") && !!op.customer;
                return (
                  <tr key={op.id} className="hover:bg-gray-50" onClick={() => setSelected(op)}>
                    <td className="px-4 py-3 font-medium text-gray-900">{op.title}</td>
                    <td className="px-4 py-3 text-gray-600">{op.lead?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{op.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{Number(op.value).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${STAGE_COLORS[op.stage]}`}>{op.stage}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[op.status]}`}>{op.status}</span></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1.5">
                        {next && op.status === "OPEN" && (
                          <button
                            onClick={() => patchOpportunity(op, { stage: next })}
                            className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                          >
                            Move to {next}
                          </button>
                        )}
                        {op.status === "OPEN" && (
                          <>
                            <button
                              onClick={() => patchOpportunity(op, { status: "WON" })}
                              className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100"
                            >
                              Mark WON
                            </button>
                            <button
                              onClick={() => patchOpportunity(op, { status: "LOST" })}
                              className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                            >
                              Mark LOST
                            </button>
                          </>
                        )}
                        {canCreateQuote && (
                          <Link href="/quotes" className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100">
                            Create Quote
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <div className="h-full w-[420px] overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{selected.title}</h2>
              <button className="text-xl text-gray-400 hover:text-gray-700" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Lead</span><span>{selected.lead?.name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span>{selected.customer?.name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Value</span><span>₹{Number(selected.value).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Probability</span><span>{selected.probability}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Stage</span><span className={`rounded-full px-2 py-0.5 text-xs ${STAGE_COLORS[selected.stage]}`}>{selected.stage}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[selected.status]}`}>{selected.status}</span></div>
              {selected.notes && <p className="mt-3 rounded border bg-gray-50 p-2 text-xs text-gray-600">{selected.notes}</p>}
            </div>

            <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800">
              Lifecycle rule: only forward stage transitions are allowed, and status can move from OPEN to WON/LOST once.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

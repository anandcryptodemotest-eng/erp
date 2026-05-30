"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, DataTable } from "@erp/ui";
import { api } from "@/lib/api-client";

interface Assignment { id: string; orderNumber: string; executiveId: string; status: string; assignedAt: string; deliveredAt: string | null }

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-indigo-100 text-indigo-700",
  PICKED_UP: "bg-yellow-100 text-yellow-700",
  DELIVERED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

export default function DeliveryPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [asgRes, repRes] = await Promise.all([
        api<{ data: Assignment[] }>("delivery", "/api/assignments?limit=50"),
        api<{ data: Record<string, unknown> }>("delivery", "/api/reports"),
      ]);
      if (!asgRes.error) setAssignments(asgRes.data.data);
      if (!repRes.error) setReport(repRes.data.data);
      setLoading(false);
    }
    load();
  }, []);

  const summary = report?.summary as Record<string, number> | undefined;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Delivery</h1>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}

      {!loading && summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Assignments", value: summary.totalAssignments, color: "blue" },
            { label: "Delivered", value: summary.deliveredCount, color: "green" },
            { label: "Failed", value: summary.failedCount, color: "red" },
            { label: "Success Rate", value: `${summary.successRate}%`, color: "purple" },
          ].map((kpi) => (
            <div key={kpi.label} className={`rounded-xl p-4 bg-${kpi.color}-50 text-${kpi.color}-700`}>
              <div className="text-xs font-medium opacity-70">{kpi.label}</div>
              <div className="mt-1 text-2xl font-bold">{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <Card>
          <CardHeader><CardTitle>Assignments ({assignments.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable keyField="id" data={assignments} columns={[
              { key: "orderNumber", header: "Order" },
              { key: "executiveId", header: "Executive ID" },
              { key: "status", header: "Status", render: (r) => (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700"}`}>{r.status}</span>
              )},
              { key: "assignedAt", header: "Assigned", render: (r) => new Date(r.assignedAt).toLocaleString("en-IN") },
              { key: "deliveredAt", header: "Delivered", render: (r) => r.deliveredAt ? new Date(r.deliveredAt).toLocaleString("en-IN") : "—" },
            ]} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

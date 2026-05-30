"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, DataTable } from "@erp/ui";
import { api } from "@/lib/api-client";

type Tab = "shifts" | "bills";
interface Shift { id: string; cashierId: string; status: string; openingBalance: number; closingBalance: number | null; openedAt: string; closedAt: string | null; _count: { bills: number } }
interface Bill { id: string; billNumber: string; status: string; paymentMethod: string; total: number; createdAt: string; billedBy: string }

export default function POSPage() {
  const [tab, setTab] = useState<Tab>("shifts");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    if (t === "shifts") {
      const res = await api<{ data: Shift[] }>("accounting", "/api/shifts?limit=20");
      if (!res.error) setShifts(res.data.data);
    } else {
      const res = await api<{ data: Bill[] }>("accounting", "/api/bills?limit=50");
      if (!res.error) setBills(res.data.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">POS Management</h1>
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["shifts", "bills"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}

      {!loading && tab === "shifts" && (
        <Card>
          <CardHeader><CardTitle>Cash Shifts ({shifts.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable keyField="id" data={shifts} columns={[
              { key: "cashierId", header: "Cashier ID" },
              { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "OPEN" ? "default" : "outline"}>{r.status}</Badge> },
              { key: "openedAt", header: "Opened", render: (r) => new Date(r.openedAt).toLocaleString("en-IN") },
              { key: "closedAt", header: "Closed", render: (r) => r.closedAt ? new Date(r.closedAt).toLocaleString("en-IN") : "—" },
              { key: "openingBalance", header: "Opening", render: (r) => `₹${Number(r.openingBalance).toLocaleString("en-IN")}` },
              { key: "closingBalance", header: "Closing", render: (r) => r.closingBalance != null ? `₹${Number(r.closingBalance).toLocaleString("en-IN")}` : "—" },
              { key: "_count", header: "Bills", render: (r) => String(r._count.bills) },
            ]} />
          </CardContent>
        </Card>
      )}

      {!loading && tab === "bills" && (
        <Card>
          <CardHeader><CardTitle>Bills ({bills.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable keyField="id" data={bills} columns={[
              { key: "billNumber", header: "Bill #" },
              { key: "createdAt", header: "Date", render: (r) => new Date(r.createdAt).toLocaleString("en-IN") },
              { key: "status", header: "Status", render: (r) => <Badge variant={r.status === "COMPLETED" ? "default" : "outline"}>{r.status}</Badge> },
              { key: "paymentMethod", header: "Payment" },
              { key: "total", header: "Total", render: (r) => `₹${Number(r.total).toLocaleString("en-IN")}` },
            ]} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

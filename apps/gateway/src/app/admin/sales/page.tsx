"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, DataTable } from "@erp/ui";
import { api } from "@/lib/api-client";

type Tab = "orders" | "customers";

interface Order { id: string; orderNumber: string; status: string; total: number; date: string; paymentMethod: string; isOnlineOrder: boolean }
interface Customer { id: string; name: string; phone: string; email: string; wallet: number; isBlocked: boolean; creditLimit: number }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  AWAITING_PICKUP: "bg-yellow-100 text-yellow-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-green-100 text-green-700",
  INVOICED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function SalesPage() {
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    if (t === "orders") {
      const q = new URLSearchParams({ limit: "50", ...(statusFilter && { status: statusFilter }) });
      const res = await api<{ data: Order[] }>("sales", `/api/orders?${q}`);
      if (!res.error) setOrders(res.data.data);
    } else {
      const q = new URLSearchParams({ limit: "50", ...(search && { search }) });
      const res = await api<{ data: Customer[] }>("sales", `/api/customers?${q}`);
      if (!res.error) setCustomers(res.data.data);
    }
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { load(tab); }, [tab, load]);

  const ORDER_STATUSES = ["", "DRAFT", "CONFIRMED", "AWAITING_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "INVOICED", "CANCELLED"];

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Sales & CRM</h1>

      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["orders", "customers"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}

      {!loading && tab === "orders" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Orders ({orders.length})</CardTitle>
            <div className="flex gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable keyField="id" data={orders} columns={[
              { key: "orderNumber", header: "Order #" },
              { key: "date", header: "Date", render: (r) => new Date(r.date).toLocaleDateString("en-IN") },
              { key: "status", header: "Status", render: (r) => (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700"}`}>{r.status}</span>
              )},
              { key: "paymentMethod", header: "Payment" },
              { key: "isOnlineOrder", header: "Channel", render: (r) => <Badge variant="outline">{r.isOnlineOrder ? "Online" : "In-store"}</Badge> },
              { key: "total", header: "Total", render: (r) => `₹${Number(r.total).toLocaleString("en-IN")}` },
            ]} />
          </CardContent>
        </Card>
      )}

      {!loading && tab === "customers" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Customers ({customers.length})</CardTitle>
            <div className="flex gap-2">
              <input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load("customers")}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable keyField="id" data={customers} columns={[
              { key: "name", header: "Name" },
              { key: "phone", header: "Phone" },
              { key: "email", header: "Email" },
              { key: "wallet", header: "Wallet", render: (r) => `₹${Number(r.wallet ?? 0).toLocaleString("en-IN")}` },
              { key: "creditLimit", header: "Credit Limit", render: (r) => `₹${Number(r.creditLimit).toLocaleString("en-IN")}` },
              { key: "isBlocked", header: "Status", render: (r) => (
                <Badge variant={r.isBlocked ? "destructive" : "default"}>{r.isBlocked ? "Blocked" : "Active"}</Badge>
              )},
            ]} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

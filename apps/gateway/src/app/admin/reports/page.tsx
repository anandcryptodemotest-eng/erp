"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@erp/ui";
import { api } from "@/lib/api-client";

type Tab = "sales" | "stock" | "shifts" | "delivery";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("sales");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const endpoints: Record<Tab, { service: Parameters<typeof api>[0]; path: string }> = {
      sales: { service: "sales", path: "/api/reports/sales" },
      stock: { service: "inventory", path: "/api/reports/stock" },
      shifts: { service: "accounting", path: "/api/reports/shifts" },
      delivery: { service: "delivery", path: "/api/reports" },
    };
    const { service, path } = endpoints[tab];
    api<{ data: Record<string, unknown> }>(service, path).then((r) => {
      if (!r.error) setData(r.data.data);
      setLoading(false);
    });
  }, [tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "sales", label: "Sales" },
    { key: "stock", label: "Inventory" },
    { key: "shifts", label: "POS Shifts" },
    { key: "delivery", label: "Delivery" },
  ];

  const summary = data?.summary as Record<string, unknown> | undefined;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Reports</h1>
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}

      {!loading && summary && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(summary).map(([key, val]) => (
              <div key={key} className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
                <div className="text-xs font-medium text-gray-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {typeof val === "number"
                    ? key.toLowerCase().includes("rate") || key.toLowerCase().includes("minutes")
                      ? String(val)
                      : key.toLowerCase().includes("value") || key.toLowerCase().includes("revenue") || key.toLowerCase().includes("earnings")
                        ? `₹${val.toLocaleString("en-IN")}`
                        : val.toLocaleString("en-IN")
                    : String(val)}
                </div>
              </div>
            ))}
          </div>

          {/* Raw period info */}
          {data?.period && (
            <p className="text-xs text-gray-400">
              Period: {new Date((data.period as Record<string, string>).from).toLocaleDateString("en-IN")} — {new Date((data.period as Record<string, string>).to).toLocaleDateString("en-IN")}
            </p>
          )}
        </>
      )}

      {/* Sales: daily table */}
      {!loading && tab === "sales" && data?.daily && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Daily Revenue (last 30 days)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Orders</th>
                    <th className="pb-2">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.daily as Array<{ date: string; orders: number; revenue: number }>).map((row) => (
                    <tr key={row.date}>
                      <td className="py-2 pr-4 text-gray-700">{row.date}</td>
                      <td className="py-2 pr-4">{row.orders}</td>
                      <td className="py-2">₹{row.revenue.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock: low stock items */}
      {!loading && tab === "stock" && data?.lowStockItems && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Low Stock Items</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 pr-4">Product</th>
                    <th className="pb-2 pr-4">SKU</th>
                    <th className="pb-2 pr-4">Warehouse</th>
                    <th className="pb-2">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.lowStockItems as Array<{ productName: string; sku: string; warehouse: string; availableQty: number }>).map((row, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-gray-700">{row.productName}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{row.sku}</td>
                      <td className="py-2 pr-4">{row.warehouse}</td>
                      <td className="py-2 font-bold text-red-600">{row.availableQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

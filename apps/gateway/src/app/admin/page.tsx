"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@erp/ui";
import { api } from "@/lib/api-client";

interface KPI { label: string; value: string | number; sub?: string; color: string }

export default function AdminDashboard() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [recentOrders, setRecentOrders] = useState<Record<string, unknown>[]>([]);
  const [lowStock, setLowStock] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [salesRes, stockRes] = await Promise.all([
        api<{ data: { summary: { totalOrders: number; revenue: number; averageOrderValue: number }; ordersByStatus: { status: string; _count: { id: number } }[] } }>("sales", "/api/reports/sales"),
        api<{ data: { summary: { totalProducts: number; totalStockValue: number; lowStockCount: number } } }>("inventory", "/api/reports/stock?lowStockThreshold=10"),
      ]);

      const orders = await api<{ data: Record<string, unknown>[] }>("sales", "/api/orders?limit=5");
      const lowStockItems = await api<{ data: { lowStockItems: Record<string, unknown>[] } }>("inventory", "/api/reports/stock?lowStockThreshold=5");

      if (!salesRes.error && !stockRes.error) {
        const s = salesRes.data.data.summary;
        const st = stockRes.data.data.summary;
        setKpis([
          { label: "Orders (30d)", value: s.totalOrders, color: "blue" },
          { label: "Revenue (30d)", value: `₹${(s.revenue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, color: "green" },
          { label: "Avg Order Value", value: `₹${Math.round(s.averageOrderValue ?? 0).toLocaleString("en-IN")}`, color: "purple" },
          { label: "Total Products", value: st.totalProducts, color: "orange" },
          { label: "Stock Value", value: `₹${(st.totalStockValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, color: "teal" },
          { label: "Low Stock Items", value: st.lowStockCount, sub: "threshold: 10", color: "red" },
        ]);
      }

      if (!orders.error) setRecentOrders(orders.data.data);
      if (!lowStockItems.error) setLowStock(lowStockItems.data.data.lowStockItems.slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700", green: "bg-green-50 text-green-700",
    purple: "bg-purple-50 text-purple-700", orange: "bg-orange-50 text-orange-700",
    teal: "bg-teal-50 text-teal-700", red: "bg-red-50 text-red-700",
  };

  if (loading) return <div className="p-8 text-gray-500">Loading dashboard…</div>;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl p-4 ${colorMap[kpi.color]}`}>
            <div className="text-xs font-medium opacity-70">{kpi.label}</div>
            <div className="mt-1 text-2xl font-bold">{kpi.value}</div>
            {kpi.sub && <div className="mt-1 text-xs opacity-60">{kpi.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent orders */}
        <Card>
          <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {recentOrders.length === 0 && <p className="py-4 text-sm text-gray-400">No orders yet</p>}
              {recentOrders.map((o) => (
                <div key={String(o.id)} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{String(o.orderNumber)}</div>
                    <div className="text-xs text-gray-500">{new Date(String(o.date)).toLocaleDateString("en-IN")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{String(o.status)}</Badge>
                    <span className="text-sm font-medium">₹{Number(o.total).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low stock alerts */}
        <Card>
          <CardHeader><CardTitle>Low Stock Alerts</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {lowStock.length === 0 && <p className="py-4 text-sm text-gray-400">All stock levels healthy</p>}
              {lowStock.map((item) => (
                <div key={String(item.productId)} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{String(item.productName)}</div>
                    <div className="text-xs text-gray-500">{String(item.warehouse)} · SKU: {String(item.sku ?? "—")}</div>
                  </div>
                  <Badge variant="outline" className="text-red-600">
                    {Number(item.availableQty)} units
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

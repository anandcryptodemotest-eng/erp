"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/admin-api";

interface Stats { products: number; customers: number; orders: number; invoices: number; }

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ products: 0, customers: 0, orders: 0, invoices: 0 });

  useEffect(() => {
    Promise.all([
      api("/api/products?limit=1"),
      api("/api/customers?limit=1"),
      api("/api/orders?limit=1"),
      api("/api/invoices?limit=1"),
    ]).then(([p, c, o, i]) => setStats({
      products:  p.meta?.total ?? 0,
      customers: c.meta?.total ?? 0,
      orders:    o.meta?.total ?? 0,
      invoices:  i.meta?.total ?? 0,
    })).catch(() => {});
  }, []);

  const cards = [
    { label: "Products",  value: stats.products,  icon: "📦", color: "bg-blue-50  border-blue-200",  href: "/products"  },
    { label: "Customers", value: stats.customers, icon: "👥", color: "bg-green-50 border-green-200", href: "/customers" },
    { label: "Orders",    value: stats.orders,    icon: "🧾", color: "bg-yellow-50 border-yellow-200", href: "/orders"  },
    { label: "Invoices",  value: stats.invoices,  icon: "💰", color: "bg-purple-50 border-purple-200", href: "/invoices" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Welcome to Simhapuri Fresh ERP</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map(c => (
          <a key={c.label} href={c.href} className={`border rounded-xl p-5 ${c.color} hover:shadow transition`}>
            <div className="text-3xl mb-2">{c.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="text-sm text-gray-500">{c.label}</div>
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-800 mb-4">B2B Lead-to-Cash Flow</h2>
          <ol className="space-y-2 text-sm text-gray-600">
            {[
              ["📦 Products", "Add products & stock", "/products"],
              ["👥 Customers", "Create a customer", "/customers"],
              ["🎯 Leads", "Create lead → Mark Qualified", "/leads"],
              ["📄 Quotes", "Create quote → Send → Accept", "/quotes"],
              ["🧾 Orders", "Convert to order → Confirm → Ship", "/orders"],
              ["💰 Invoices", "View auto-created invoice → Mark Paid", "/invoices"],
              ["↩️ Returns", "If needed: create sales return", "/returns"],
            ].map(([icon, desc, href]) => (
              <li key={desc} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">→</span>
                <a href={href} className="hover:text-green-700 hover:underline font-medium">{icon}</a>
                <span className="text-gray-400">— {desc}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Retail / POS Flow</h2>
          <ol className="space-y-2 text-sm text-gray-600">
            {[
              ["📦 Products", "Add products with barcode & stock", "/products"],
              ["🏧 POS Billing", "Open shift → Scan & bill → Close shift", "http://localhost:3008"],
              ["🛒 Online Orders", "Customer app → Checkout → Deliver", "http://localhost:3007"],
              ["🚚 Delivery", "Assign rider → Track delivery", "http://localhost:3010/delivery-executives"],
              ["📋 Procurement", "Restock from vendor → Receive stock", "/purchase-orders"],
            ].map(([icon, desc, href]) => (
              <li key={desc} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">→</span>
                <a href={href} className="hover:text-blue-700 hover:underline font-medium">{icon}</a>
                <span className="text-gray-400">— {desc}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

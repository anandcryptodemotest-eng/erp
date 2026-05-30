"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Badge, DataTable } from "@erp/ui";
import { api } from "@/lib/api-client";

type Tab = "banners" | "coupons";
interface Banner { id: string; title: string; type: string; position: number; isActive: boolean; startsAt: string | null; endsAt: string | null }
interface Coupon { id: string; code: string; type: string; value: number; usageCount: number; usageLimit: number | null; isActive: boolean; endsAt: string | null }

export default function PromotionsPage() {
  const [tab, setTab] = useState<Tab>("banners");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (tab === "banners") {
      api<{ data: Banner[] }>("gateway", "/api/banners?limit=50").then((r) => {
        if (!r.error) setBanners(r.data.data);
        setLoading(false);
      });
    } else {
      api<{ data: Coupon[] }>("gateway", "/api/coupons?limit=50").then((r) => {
        if (!r.error) setCoupons(r.data.data);
        setLoading(false);
      });
    }
  }, [tab]);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Promotions</h1>
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["banners", "coupons"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}

      {!loading && tab === "banners" && (
        <Card>
          <CardHeader><CardTitle>Banners ({banners.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable keyField="id" data={banners} columns={[
              { key: "title", header: "Title" },
              { key: "type", header: "Type", render: (r) => <Badge variant="outline">{r.type}</Badge> },
              { key: "position", header: "Position" },
              { key: "startsAt", header: "Starts", render: (r) => r.startsAt ? new Date(r.startsAt).toLocaleDateString("en-IN") : "—" },
              { key: "endsAt", header: "Ends", render: (r) => r.endsAt ? new Date(r.endsAt).toLocaleDateString("en-IN") : "—" },
              { key: "isActive", header: "Status", render: (r) => <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
            ]} />
          </CardContent>
        </Card>
      )}

      {!loading && tab === "coupons" && (
        <Card>
          <CardHeader><CardTitle>Coupons ({coupons.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable keyField="id" data={coupons} columns={[
              { key: "code", header: "Code", render: (r) => <span className="font-mono font-bold">{r.code}</span> },
              { key: "type", header: "Type", render: (r) => <Badge variant="outline">{r.type}</Badge> },
              { key: "value", header: "Value", render: (r) => r.type === "PERCENTAGE" ? `${r.value}%` : `₹${r.value}` },
              { key: "usageCount", header: "Used", render: (r) => `${r.usageCount}/${r.usageLimit ?? "∞"}` },
              { key: "endsAt", header: "Expires", render: (r) => r.endsAt ? new Date(r.endsAt).toLocaleDateString("en-IN") : "Never" },
              { key: "isActive", header: "Status", render: (r) => <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
            ]} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

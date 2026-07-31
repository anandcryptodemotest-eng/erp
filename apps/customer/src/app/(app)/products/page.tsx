"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { productImageUrl } from "@/lib/media";

interface CatalogGroup {
  groupCode: string;
  groupName: string;
  brandName: string | null;
  categoryName: string | null;
  productCount: number;
  imageUrls: string[];
  startingSellPrice: number | null;
  pricingBasis: string | null;
  baseRate: number | null;
  pricingUom: string | null;
}

interface Category {
  id: string;
  name: string;
}

function ShopContent() {
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<CatalogGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ limit: "50" });
    if (search) q.set("search", search);
    if (categoryId) q.set("categoryId", categoryId);
    const res = await api<{ data: CatalogGroup[] }>("inventory", `/api/catalog/groups?${q}`);
    if (!res.error) setGroups(res.data.data ?? []);
    setLoading(false);
  }, [search, categoryId]);

  useEffect(() => {
    api<{ data: Category[] }>("inventory", "/api/products/categories?limit=30").then((r) => {
      if (!r.error) setCategories(r.data.data ?? []);
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function priceLabel(g: CatalogGroup): string {
    if (g.pricingBasis && g.pricingBasis !== "PER_EACH" && g.baseRate != null) {
      return `From ₹${g.baseRate}/${g.pricingUom || "unit"}`;
    }
    if (g.startingSellPrice != null) return `From ₹${g.startingSellPrice}`;
    return "Configure for price";
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link href="/products/all" className="text-sm text-gray-500 underline shrink-0">
          Browse all SKUs
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryId("")}
            className={`px-3 py-1.5 rounded-full text-sm ${!categoryId ? "bg-gray-900 text-white" : "bg-gray-100"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm ${
                categoryId === c.id ? "bg-gray-900 text-white" : "bg-gray-100"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No product groups yet.</p>
          <p className="text-sm mt-2">
            Admin: create Multiple Products with a Group code, or browse{" "}
            <Link href="/products/all" className="underline">
              all SKUs
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {groups.map((g) => {
            const img = productImageUrl({
              name: g.groupName,
              imageUrls: g.imageUrls.length ? g.imageUrls : undefined,
            });
            return (
              <Link
                key={g.groupCode}
                href={`/catalog/${encodeURIComponent(g.groupCode)}`}
                className="border rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="font-medium text-gray-900 text-sm line-clamp-2">{g.groupName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {[g.brandName, g.categoryName].filter(Boolean).join(" · ")}
                  </div>
                  <div className="text-sm font-semibold text-gray-800 mt-2">{priceLabel(g)}</div>
                  <div className="text-xs text-gray-400 mt-1">{g.productCount} options</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}>
      <ShopContent />
    </Suspense>
  );
}

"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";

interface Product { id: string; name: string; sku: string; sellingPrice: number; imageUrl?: string; unit?: string; isActive: boolean }
interface Category { id: string; name: string }

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ limit: "40", isActive: "true" });
    if (search) q.set("search", search);
    if (categoryId) q.set("categoryId", categoryId);
    const res = await api<{ data: Product[] }>("inventory", `/api/products?${q}`);
    if (!res.error) setProducts(res.data.data);
    setLoading(false);
  }, [search, categoryId]);

  useEffect(() => {
    api<{ data: Category[] }>("inventory", "/api/products/categories?limit=30").then((r) => {
      if (!r.error) setCategories(r.data.data);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Search bar */}
      <div className="sticky top-0 z-10 bg-white px-3 py-3 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search products…"
          className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-green-500"
        />
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 py-2 scrollbar-hide">
          <button
            onClick={() => setCategoryId("")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${categoryId === "" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>
            All
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategoryId(c.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${categoryId === c.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>}

      {!loading && products.length === 0 && (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <div className="text-4xl">🔍</div>
          <div className="mt-2 text-sm">No products found</div>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3 px-3 py-3">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`}
              className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm active:scale-95 transition-transform">
              <div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 text-4xl mb-2">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain rounded-lg" /> : "🥬"}
              </div>
              <div className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight">{p.name}</div>
              {p.unit && <div className="text-xs text-gray-400 mt-0.5">{p.unit}</div>}
              <div className="mt-1 font-bold text-green-700">₹{Number(p.sellingPrice).toLocaleString("en-IN")}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

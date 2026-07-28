"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { productImageUrl } from "@/lib/media";

interface Product {
  id: string;
  name: string;
  sku: string;
  sellPrice: number;
  imageUrl?: string;
  imageUrls?: string[];
  unit?: string;
  isActive: boolean;
}
interface Category {
  id: string;
  name: string;
}
interface AttrDef {
  id: string;
  key: string;
  label: string;
  dataType: string;
  options: unknown;
  isFilterable: boolean;
}

function optionList(options: unknown): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "object" && options !== null && Array.isArray((options as { values?: unknown }).values)) {
    return ((options as { values: unknown[] }).values).map(String);
  }
  return [];
}

function ShopContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [attrFilters, setAttrFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ limit: "40", isActive: "true" });
    if (search) q.set("search", search);
    if (categoryId) q.set("categoryId", categoryId);
    for (const [k, v] of Object.entries(attrFilters)) {
      if (v) q.set(`attr[${k}]`, v);
    }
    const res = await api<{ data: Product[] }>("inventory", `/api/products?${q}`);
    if (!res.error) setProducts(res.data.data ?? []);
    setLoading(false);
  }, [search, categoryId, attrFilters]);

  useEffect(() => {
    api<{ data: Category[] }>("inventory", "/api/products/categories?limit=30").then((r) => {
      if (!r.error) setCategories(r.data.data ?? []);
    });
  }, []);

  useEffect(() => {
    const q = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    api<{ data: AttrDef[] }>("inventory", `/api/attribute-definitions${q}`).then((r) => {
      if (!r.error) {
        setAttrDefs((r.data.data ?? []).filter((d) => d.isFilterable));
        setAttrFilters({});
      }
    });
  }, [categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterableSelects = attrDefs.filter((d) => optionList(d.options).length > 0);

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">Catalog</p>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink)] md:text-3xl">Shop materials</h1>
        </div>
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search plywood, size, SKU…"
            className="w-full rounded-2xl border border-[var(--line)] bg-white py-3 pl-4 pr-24 text-sm outline-none ring-[var(--amber)]/30 placeholder:text-[var(--ink-soft)]/45 focus:ring-2"
          />
          <button
            type="button"
            onClick={() => load()}
            className="absolute right-1.5 top-1.5 rounded-xl bg-[#121a16] px-4 py-2 text-xs font-bold text-white"
          >
            Search
          </button>
        </div>

        {filterableSelects.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filterableSelects.map((def) => (
              <select
                key={def.key}
                value={attrFilters[def.key] ?? ""}
                onChange={(e) => setAttrFilters((prev) => ({ ...prev, [def.key]: e.target.value }))}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)]"
              >
                <option value="">{def.label}: Any</option>
                {optionList(def.options).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ))}
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide md:px-8">
          <button
            type="button"
            onClick={() => setCategoryId("")}
            className={`chip ${categoryId === "" ? "chip-active" : ""}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`chip whitespace-nowrap ${categoryId === c.id ? "chip-active" : ""}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-sm text-[var(--ink-soft)]/60">
          Loading products…
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl border border-dashed border-[var(--line)] bg-white/80 px-6 py-16 text-center md:mx-8">
          <p className="font-display text-xl text-[var(--ink)]">No matches</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Try another category or clear filters.</p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 md:grid-cols-3 md:px-8 lg:grid-cols-4">
          {products.map((p, i) => (
            <Link key={p.id} href={`/products/${p.id}`} className="product-tile anim-rise">
              <div className="relative aspect-[4/3] overflow-hidden bg-[var(--mist)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productImageUrl(p, i)} alt={p.name} className="h-full w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[var(--ink-soft)] backdrop-blur">
                  {p.sku}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-3">
                <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--ink)]">{p.name}</div>
                {p.unit && <div className="mt-0.5 text-xs text-[var(--ink-soft)]/70">Per {p.unit}</div>}
                <div className="mt-auto pt-2 font-display text-lg font-semibold text-[var(--forest)]">
                  ₹{Number(p.sellPrice).toLocaleString("en-IN")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[var(--ink-soft)]">Loading shop…</div>}>
      <ShopContent />
    </Suspense>
  );
}

"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Chip,
  Container,
  EmptyState,
  ProductCard,
  SearchBar,
  SectionHeader,
  Skeleton,
} from "@erp/ui";
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
    <Container layout="wide" className="py-6 md:py-8">
      <div className="mb-4">
        <p className="cx-eyebrow">
          <Link href="/products" className="hover:underline">
            Catalog
          </Link>
          {" · "}All SKUs
        </p>
        <SectionHeader title="Browse all SKUs" className="mb-0 mt-1" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search plywood, size, SKU…"
          className="flex-1"
        />
        <Button variant="primary" size="md" onClick={() => void load()} className="shrink-0">
          Search
        </Button>
      </div>

      {filterableSelects.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {filterableSelects.map((def) => (
            <select
              key={def.key}
              value={attrFilters[def.key] ?? ""}
              onChange={(e) => setAttrFilters((prev) => ({ ...prev, [def.key]: e.target.value }))}
              className="rounded-[var(--radius-full)] border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)]"
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

      {categories.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Chip active={categoryId === ""} onClick={() => setCategoryId("")}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
              className="whitespace-nowrap"
            >
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-[var(--radius)]" />
          ))}
        </div>
      )}

      {!loading && products.length === 0 && (
        <EmptyState
          className="cx-empty"
          title="No matches"
          subtitle="Try another category or clear filters."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setCategoryId("");
                setSearch("");
                setAttrFilters({});
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}

      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              href={`/products/${p.id}`}
              title={p.name}
              subtitle={p.unit ? `Per ${p.unit}` : undefined}
              imageUrl={productImageUrl(p, i)}
              priceLabel={`₹${Number(p.sellPrice).toLocaleString("en-IN")}`}
              meta={p.sku}
              className="anim-rise"
            />
          ))}
        </div>
      )}
    </Container>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-8">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="h-11 w-full rounded-[var(--radius-full)]" />
        </Container>
      }
    >
      <ShopContent />
    </Suspense>
  );
}

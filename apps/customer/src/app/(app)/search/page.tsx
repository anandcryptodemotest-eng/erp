"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Container, ProductCard, SearchBar, SectionHeader, Skeleton } from "@erp/ui";
import { api } from "@/lib/api-client";
import { productImageUrl } from "@/lib/media";

type Suggestion = { type: string; id: string; label: string; href: string };
type Group = {
  groupCode: string;
  groupName: string;
  imageUrls?: string[];
  startingSellPrice?: number | null;
  productCount?: number;
};
type Product = {
  id: string;
  name: string;
  sku?: string;
  sellPrice?: number;
  imageUrls?: string[];
};

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const initial = sp.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    setQ(initial);
  }, [initial]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setGroups([]);
      setProducts([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      void api<{
        data: { suggestions: Suggestion[]; groups: Group[]; products: Product[] };
      }>("portal", `/api/portal/search?q=${encodeURIComponent(term)}&limit=24`).then((res) => {
        if (!res.error && res.data?.data) {
          setSuggestions(res.data.data.suggestions ?? []);
          setGroups(res.data.data.groups ?? []);
          setProducts(res.data.data.products ?? []);
        }
        setLoading(false);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Container layout="wide" className="py-4 md:py-6">
      <SectionHeader title="Search" />
      <form
        className="mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <SearchBar value={q} onChange={setQ} placeholder="Product, SKU, brand, category…" />
      </form>

      {q.trim().length >= 2 && suggestions.length > 0 ? (
        <div className="mb-4 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-raised)]">
          {suggestions.map((s) => (
            <Link
              key={`${s.type}-${s.id}`}
              href={s.href}
              className="flex items-center justify-between border-b border-[#f0f0f0] px-3 py-2.5 text-sm last:border-0 hover:bg-[#f8f8f8]"
            >
              <span className="font-medium text-[var(--ink)]">{s.label}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                {s.type}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
          ))}
        </div>
      ) : null}

      {!loading && groups.length > 0 ? (
        <section className="mb-6">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Catalog groups
          </h3>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
            {groups.map((g) => (
              <ProductCard
                key={g.groupCode}
                href={`/shop/g/${encodeURIComponent(g.groupCode)}`}
                title={g.groupName}
                imageUrl={productImageUrl({ name: g.groupName, imageUrls: g.imageUrls })}
                priceLabel={
                  g.startingSellPrice != null
                    ? `From ₹${Number(g.startingSellPrice).toLocaleString("en-IN")}`
                    : "Configure"
                }
                meta={g.productCount != null ? `${g.productCount} options` : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && products.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Products
          </h3>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                href={`/shop/p/${p.id}`}
                title={p.name}
                subtitle={p.sku}
                imageUrl={productImageUrl(p)}
                priceLabel={
                  p.sellPrice != null
                    ? `₹${Number(p.sellPrice).toLocaleString("en-IN")}`
                    : "Configure"
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && q.trim().length >= 2 && groups.length === 0 && products.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--ink-soft)]">
          No matches for “{q.trim()}”.
        </p>
      ) : null}
    </Container>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-8">
          <Skeleton className="mb-4 h-8 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </Container>
      }
    >
      <SearchInner />
    </Suspense>
  );
}

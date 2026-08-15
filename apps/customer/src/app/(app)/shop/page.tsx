"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Chip, ProductCard, SearchBar, SectionHeader, Skeleton, Container } from "@erp/ui";
import { api } from "@/lib/api-client";
import { productImageUrl } from "@/lib/media";
import { formatPortalPrice } from "@/lib/pricing-display";

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
    const res = await api<{ data: CatalogGroup[] }>("inventory", `/api/portal/catalog/groups?${q}`);
    if (!res.error) setGroups(res.data?.data ?? []);
    setLoading(false);
  }, [search, categoryId]);

  useEffect(() => {
    api<{ data: Category[] }>("inventory", "/api/portal/categories?limit=30").then((r) => {
      if (!r.error) setCategories(r.data?.data ?? []);
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Container layout="wide" className="py-4 md:py-6">
      <SectionHeader
        title="Shop"
        action={
          <Link href="/search" className="text-sm font-semibold text-[var(--forest)]">
            All SKUs
          </Link>
        }
      />

      <div className="mb-4 space-y-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (search.trim()) window.location.href = `/search?q=${encodeURIComponent(search.trim())}`;
          }}
          className="hidden md:block"
        >
          <SearchBar value={search} onChange={setSearch} placeholder="Search products…" />
        </form>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <Chip active={!categoryId} onClick={() => setCategoryId("")}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 md:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--mist)] px-4 py-14 text-center text-[var(--ink-soft)]">
          <p className="font-bold text-[var(--ink)]">No products yet</p>
          <p className="mt-1 text-sm">
            Check back soon, or browse{" "}
            <Link href="/search" className="font-semibold text-[var(--forest)] underline">
              all SKUs
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 md:gap-3">
          {groups.map((g) => {
            const price = formatPortalPrice({
              startingSellPrice: g.startingSellPrice,
              baseRate: g.baseRate,
              pricingBasis: g.pricingBasis,
              pricingUom: g.pricingUom,
            });
            const specs = [g.brandName, g.categoryName].filter(Boolean) as string[];
            return (
              <ProductCard
                key={g.groupCode}
                href={`/shop/g/${encodeURIComponent(g.groupCode)}`}
                title={g.groupName}
                specs={specs.length ? [specs.join(" · ")] : undefined}
                imageUrl={productImageUrl({
                  name: g.groupName,
                  imageUrls: g.imageUrls.length ? g.imageUrls : undefined,
                  categoryName: g.categoryName,
                })}
                priceLabel={price.label}
                purchaseMode="configure"
                meta={`${g.productCount} option${g.productCount === 1 ? "" : "s"}`}
              />
            );
          })}
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
          <Skeleton className="mb-4 h-8 w-40" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </Container>
      }
    >
      <ShopContent />
    </Suspense>
  );
}

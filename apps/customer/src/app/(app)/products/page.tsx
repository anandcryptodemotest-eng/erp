"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Chip, ProductCard, SearchBar, SectionHeader, Skeleton, Container } from "@erp/ui";
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
    if (g.startingSellPrice != null) return `From ₹${Number(g.startingSellPrice).toLocaleString("en-IN")}`;
    return "Configure for price";
  }

  return (
    <Container layout="wide" className="py-6 md:py-8">
      <SectionHeader
        title="Shop"
        action={
          <Link href="/products/all" className="text-sm font-semibold text-[var(--forest-mid)] underline-offset-2 hover:underline">
            All SKUs
          </Link>
        }
      />

      <div className="mb-6 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products…" />
        <div className="flex flex-wrap gap-2">
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-[var(--radius)]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-white/60 px-4 py-16 text-center text-[var(--ink-soft)]">
          <p className="font-semibold text-[var(--ink)]">No products yet</p>
          <p className="mt-2 text-sm">
            Check back soon, or browse{" "}
            <Link href="/products/all" className="underline">
              all SKUs
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {groups.map((g) => (
            <ProductCard
              key={g.groupCode}
              href={`/catalog/${encodeURIComponent(g.groupCode)}`}
              title={g.groupName}
              subtitle={[g.brandName, g.categoryName].filter(Boolean).join(" · ")}
              imageUrl={productImageUrl({
                name: g.groupName,
                imageUrls: g.imageUrls.length ? g.imageUrls : undefined,
              })}
              priceLabel={priceLabel(g)}
              meta={`${g.productCount} option${g.productCount === 1 ? "" : "s"}`}
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
          <Skeleton className="mb-4 h-8 w-40" />
          <Skeleton className="h-11 w-full rounded-[var(--radius-full)]" />
        </Container>
      }
    >
      <ShopContent />
    </Suspense>
  );
}

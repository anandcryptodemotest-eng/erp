"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Container,
  EmptyState,
  ProductCard,
  SectionHeader,
  Skeleton,
} from "@erp/ui";
import { api } from "@/lib/api-client";
import { categoryImageUrl, heroImageUrl, productImageUrl } from "@/lib/media";
import { useTenantDisplayName } from "@/components/TenantBrandingProvider";

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
}
interface Product {
  id: string;
  name: string;
  sellPrice: number;
  imageUrl?: string;
  imageUrls?: string[];
  unit?: string;
  isFeatured?: boolean;
}
interface Category {
  id: string;
  name: string;
  imageUrl?: string;
}

const RECENT_KEY = "customer_recent_viewed";

function readRecent(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Product[];
  } catch {
    return [];
  }
}

export default function HomePage() {
  const orgName = useTenantDisplayName();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    setRecent(readRecent());
    void api<{
      data: { banners: Banner[]; featured: Product[]; categories: Category[] };
    }>("portal", "/api/portal/home").then((res) => {
      if (!res.error && res.data?.data) {
        setBanners(res.data.data.banners ?? []);
        setFeatured(res.data.data.featured ?? []);
        setCategories(res.data.data.categories ?? []);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4200);
    return () => clearInterval(t);
  }, [banners.length]);

  return (
    <div className="pb-4">
      {/* Compact promo strip */}
      <section className="relative overflow-hidden bg-[var(--forest)] text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${heroImageUrl()})` }}
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-3 px-4 py-4 md:px-6 md:py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--amber-soft)]">
              {orgName}
            </p>
            <h1 className="mt-0.5 text-lg font-bold leading-tight md:text-xl">
              Plywood & timber, ready to order
            </h1>
            <p className="mt-0.5 text-xs text-white/75">
              Configure · Request · Track
            </p>
          </div>
          <Link href="/shop" className="shrink-0">
            <Button variant="secondary" size="sm" className="!rounded-md !bg-white !text-[var(--forest)]">
              Shop now
            </Button>
          </Link>
        </div>
      </section>

      <Container layout="wide" className="space-y-5 py-4 md:py-6">
        {banners.length > 0 ? (
          <section className="overflow-hidden rounded-lg">
            {banners[bannerIdx]?.linkUrl ? (
              <Link href={banners[bannerIdx].linkUrl!}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banners[bannerIdx].imageUrl}
                  alt={banners[bannerIdx].title}
                  className="h-32 w-full object-cover md:h-44"
                />
              </Link>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={banners[bannerIdx].imageUrl}
                alt={banners[bannerIdx].title}
                className="h-32 w-full object-cover md:h-44"
              />
            )}
          </section>
        ) : null}

        <section>
          <SectionHeader
            title="Categories"
            action={
              <Link href="/shop" className="text-sm font-semibold text-[var(--forest)]">
                See all
              </Link>
            }
          />
          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-16 shrink-0 rounded-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState title="No categories yet" subtitle="Products will appear here once catalogued." />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/shop/c/${encodeURIComponent(c.id)}`}
                  className="cat-rail-item"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={categoryImageUrl(c.name, c.imageUrl)} alt="" />
                  <span>{c.name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader
            title="Featured"
            action={
              <Link href="/shop" className="text-sm font-semibold text-[var(--forest)]">
                Shop all
              </Link>
            }
          />
          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
              {featured.map((p) => (
                <ProductCard
                  key={p.id}
                  href={`/shop/p/${p.id}`}
                  title={p.name}
                  imageUrl={productImageUrl(p)}
                  priceLabel={`₹${Number(p.sellPrice ?? 0).toLocaleString("en-IN")}`}
                />
              ))}
            </div>
          )}
        </section>

        {recent.length > 0 ? (
          <section>
            <SectionHeader title="Recently viewed" />
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
              {recent.slice(0, 4).map((p) => (
                <ProductCard
                  key={p.id}
                  href={`/shop/p/${p.id}`}
                  title={p.name}
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
      </Container>
    </div>
  );
}

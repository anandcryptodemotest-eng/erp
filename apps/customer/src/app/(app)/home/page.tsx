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
import { addToCart } from "@/lib/cart-store";
import { categoryImageUrl, productImageUrl } from "@/lib/media";
import { formatPortalPrice } from "@/lib/pricing-display";
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
  sku?: string;
  sellPrice?: number | null;
  baseRate?: number | null;
  pricingBasis?: string | null;
  pricingUom?: string | null;
  unit?: string;
  imageUrl?: string;
  imageUrls?: string[];
  category?: { name?: string } | null;
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function cardPrice(p: Product) {
  return formatPortalPrice({
    sellPrice: p.sellPrice,
    baseRate: p.baseRate,
    pricingBasis: p.pricingBasis,
    pricingUom: p.pricingUom,
    unit: p.unit,
  });
}

function quickAddFixed(p: Product) {
  const price = cardPrice(p);
  if (!price.quickAdd || price.amount == null) return;
  addToCart({
    productId: p.id,
    name: p.name,
    sku: p.sku ?? "",
    price: price.amount,
    qty: 1,
    imageUrl: productImageUrl(p),
  });
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
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="erp-login-wash absolute inset-0 opacity-90" aria-hidden />
        <div className="relative flex items-center justify-between gap-3 px-4 py-5 md:px-6 md:py-7">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--brand)]">
              {orgName}
            </p>
            <h1 className="font-display mt-1 text-xl font-semibold leading-tight tracking-tight md:text-2xl">
              {greeting()}
            </h1>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              Browse · Configure · Track orders
            </p>
          </div>
          <Link href="/shop" className="shrink-0">
            <Button variant="secondary" size="sm" className="!rounded-full !bg-[var(--brand)] !text-[var(--ink-inverse)]">
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
            title="Featured products"
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
              {featured.map((p) => {
                const price = cardPrice(p);
                return (
                  <ProductCard
                    key={p.id}
                    href={`/shop/p/${p.id}`}
                    title={p.name}
                    imageUrl={productImageUrl({
                      ...p,
                      categoryName: p.category?.name,
                    })}
                    priceLabel={price.label}
                    purchaseMode={price.quickAdd ? "fixed" : "configure"}
                    onQuickAdd={price.quickAdd ? () => quickAddFixed(p) : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>

        {recent.length > 0 ? (
          <section>
            <SectionHeader title="Recently viewed" />
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
              {recent.slice(0, 4).map((p) => {
                const price = cardPrice(p);
                return (
                  <ProductCard
                    key={p.id}
                    href={`/shop/p/${p.id}`}
                    title={p.name}
                    imageUrl={productImageUrl(p)}
                    priceLabel={price.label}
                    purchaseMode={price.quickAdd ? "fixed" : "configure"}
                    onQuickAdd={price.quickAdd ? () => quickAddFixed(p) : undefined}
                  />
                );
              })}
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}

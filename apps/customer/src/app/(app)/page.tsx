"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { categoryImageUrl, heroImageUrl, productImageUrl } from "@/lib/media";
import { resolveTenantDisplayName } from "@/lib/tenant";

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
}
interface Product {
  id: string;
  name: string;
  sellPrice: number;
  imageUrl?: string;
  imageUrls?: string[];
  unit?: string;
  isFeatured: boolean;
}
interface Category {
  id: string;
  name: string;
  imageUrl?: string;
}

export default function HomePage() {
  const orgName = resolveTenantDisplayName();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    async function load() {
      const [bannersRes, productsRes, catRes] = await Promise.all([
        api<{ data: Banner[] }>("gateway", "/api/banners?isActive=true&limit=5"),
        api<{ data: Product[] }>("inventory", "/api/products?isFeatured=true&limit=12"),
        api<{ data: Category[] }>("inventory", "/api/products/categories?limit=10"),
      ]);
      if (!bannersRes.error) setBanners(bannersRes.data.data ?? []);
      // Featured may be empty — fall back to any active products
      let products = !productsRes.error ? productsRes.data.data ?? [] : [];
      if (products.length === 0) {
        const all = await api<{ data: Product[] }>("inventory", "/api/products?isActive=true&limit=12");
        if (!all.error) products = all.data.data ?? [];
      }
      setFeatured(products);
      if (!catRes.error) setCategories(catRes.data.data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4200);
    return () => clearInterval(t);
  }, [banners.length]);

  return (
    <div className="pb-6">
      <header className="relative overflow-hidden bg-[#121a16] text-white">
        {/* Background image + dark scrub so text/buttons always contrast */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImageUrl()})` }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(12,18,14,0.94) 0%, rgba(12,18,14,0.82) 42%, rgba(12,18,14,0.55) 100%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 px-5 pb-8 pt-6 md:px-10 md:pb-12 md:pt-8">
          <div className="anim-rise max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#e8c56a]">
              Trade portal
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold leading-tight text-white md:text-5xl">
              {orgName}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/85 md:text-base">
              Plywood, timber & site materials — order in minutes, track through dispatch.
            </p>
          </div>

          <div className="anim-rise anim-rise-delay-1 mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="btn-primary"
            >
              Shop now
            </Link>
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-full border-2 border-white bg-transparent px-6 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-[#121a16]"
            >
              My orders
            </Link>
          </div>
        </div>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-20 text-sm text-[var(--ink-soft)]/60">
          Loading catalog…
        </div>
      )}

      {!loading && (
        <div className="relative z-10 -mt-5 space-y-8 px-4 md:-mt-8 md:px-8">
          {banners.length > 0 && (
            <section className="anim-rise anim-rise-delay-1 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)]">
              <div className="relative h-40 md:h-52">
                {banners.map((b, i) => (
                  <div
                    key={b.id}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      i === bannerIdx ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={b.imageUrl || heroImageUrl()}
                      alt={b.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/70 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h2 className="font-display text-xl font-semibold text-white md:text-2xl">{b.title}</h2>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {categories.length > 0 && (
            <section className="anim-rise anim-rise-delay-2">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">
                    Categories
                  </p>
                  <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Shop by type</h2>
                </div>
                <Link href="/products" className="text-sm font-semibold text-[var(--forest-mid)]">
                  See all
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?categoryId=${cat.id}`}
                    className="group min-w-[8.5rem] overflow-hidden rounded-2xl border border-[var(--line)] bg-white md:min-w-0"
                  >
                    <div className="relative h-24 overflow-hidden md:h-28">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={categoryImageUrl(cat.name, cat.imageUrl)}
                        alt={cat.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink)]/55 to-transparent" />
                      <span className="absolute bottom-2 left-3 font-display text-sm font-semibold text-white">
                        {cat.name}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="anim-rise anim-rise-delay-3">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">
                  Catalog
                </p>
                <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">
                  {featured.some((p) => p.isFeatured) ? "Featured stock" : "Popular materials"}
                </h2>
              </div>
              <Link href="/products" className="text-sm font-semibold text-[var(--forest-mid)]">
                View all
              </Link>
            </div>

            {featured.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-12 text-center text-sm text-[var(--ink-soft)]">
                No products yet — ask your supplier to publish the catalog.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {featured.map((p, i) => (
                  <Link key={p.id} href={`/products/${p.id}`} className="product-tile">
                    <div className="relative aspect-[4/3] overflow-hidden bg-[var(--mist)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={productImageUrl(p, i)}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--ink)]">
                        {p.name}
                      </div>
                      {p.unit && <div className="mt-0.5 text-xs text-[var(--ink-soft)]/70">{p.unit}</div>}
                      <div className="mt-auto pt-2 font-display text-lg font-semibold text-[var(--forest)]">
                        ₹{Number(p.sellPrice).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

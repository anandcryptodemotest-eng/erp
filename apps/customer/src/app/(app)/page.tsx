"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

interface Banner { id: string; title: string; imageUrl: string; type: string; linkUrl?: string }
interface Product { id: string; name: string; sellingPrice: number; imageUrl?: string; unit?: string; isFeatured: boolean }
interface Category { id: string; name: string; imageUrl?: string }

export default function HomePage() {
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
        api<{ data: Category[] }>("inventory", "/api/products/categories?isFeatured=true&limit=10"),
      ]);
      if (!bannersRes.error) setBanners(bannersRes.data.data);
      if (!productsRes.error) setFeatured(productsRes.data.data);
      if (!catRes.error) setCategories(catRes.data.data);
      setLoading(false);
    }
    load();
  }, []);

  // Auto-advance banner
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 3500);
    return () => clearInterval(t);
  }, [banners.length]);

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-green-600 px-4 py-3 text-white">
        <div>
          <div className="text-xs opacity-80">Delivering to</div>
          <div className="font-semibold text-sm">Your location</div>
        </div>
        <div className="text-lg font-bold tracking-tight">🌿 Simhapuri Fresh</div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>
      )}

      {!loading && (
        <>
          {/* Banner carousel */}
          {banners.length > 0 && (
            <div className="relative mx-3 mt-3 overflow-hidden rounded-xl bg-green-50 h-36">
              {banners.map((b, i) => (
                <div key={b.id}
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${i === bannerIdx ? "opacity-100" : "opacity-0"}`}>
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover rounded-xl" />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <div className="text-2xl font-bold text-green-700">{b.title}</div>
                    </div>
                  )}
                </div>
              ))}
              {/* Dots */}
              {banners.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => setBannerIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? "w-4 bg-green-600" : "w-1.5 bg-gray-300"}`} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <section className="mt-4 px-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Shop by Category</h2>
                <Link href="/products" className="text-xs text-green-600 font-medium">See all</Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map((cat) => (
                  <Link key={cat.id} href={`/products?categoryId=${cat.id}`}
                    className="flex flex-col items-center min-w-[64px]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">
                      {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.name} className="h-full w-full rounded-full object-cover" /> : "🛒"}
                    </div>
                    <span className="mt-1 text-center text-xs text-gray-600 leading-tight w-16 truncate">{cat.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Featured products */}
          {featured.length > 0 && (
            <section className="mt-5 px-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Featured Products</h2>
                <Link href="/products" className="text-xs text-green-600 font-medium">View all</Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {featured.map((p) => (
                  <Link key={p.id} href={`/products/${p.id}`}
                    className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm active:scale-95 transition-transform">
                    <div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 text-4xl mb-2">
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain rounded-lg" /> : "🥬"}
                    </div>
                    <div className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight">{p.name}</div>
                    {p.unit && <div className="mt-0.5 text-xs text-gray-400">{p.unit}</div>}
                    <div className="mt-1 font-bold text-green-700">₹{Number(p.sellingPrice).toLocaleString("en-IN")}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

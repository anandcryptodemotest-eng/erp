"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { addToCart } from "@/lib/cart-store";

interface Product {
  id: string; name: string; sku: string; sellingPrice: number; costPrice: number;
  imageUrl?: string; unit?: string; description?: string; isActive: boolean;
  brand?: { name: string };
  category?: { name: string };
  stock?: { availableQty: number }[];
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [id, setId] = useState("");

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    api<{ data: Product }>("inventory", `/api/products/${id}`).then((r) => {
      if (!r.error) setProduct(r.data.data);
      setLoading(false);
    });
  }, [id]);

  function handleAddToCart() {
    if (!product) return;
    addToCart({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: product.sellingPrice,
      qty,
      imageUrl: product.imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>;
  if (!product) return <div className="flex items-center justify-center py-16 text-gray-400">Product not found</div>;

  const available = product.stock?.reduce((s, w) => s + w.availableQty, 0) ?? 99;

  return (
    <div className="pb-28">
      {/* Back button */}
      <button onClick={() => router.back()}
        className="flex items-center gap-1 px-4 py-3 text-sm text-gray-600">
        ← Back
      </button>

      {/* Product image */}
      <div className="mx-3 flex h-52 items-center justify-center rounded-2xl bg-gray-50 text-6xl">
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain rounded-2xl" />
          : "🥬"}
      </div>

      {/* Details */}
      <div className="px-4 mt-4">
        {product.brand && <div className="text-xs font-medium text-green-600 uppercase tracking-wide">{product.brand.name}</div>}
        <h1 className="mt-1 text-xl font-bold text-gray-900">{product.name}</h1>
        {product.unit && <div className="text-sm text-gray-500 mt-0.5">{product.unit}</div>}
        {product.category && <div className="text-xs text-gray-400 mt-0.5">{product.category.name}</div>}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-green-700">₹{Number(product.sellingPrice).toLocaleString("en-IN")}</span>
          {product.unit && <span className="text-sm text-gray-500">/ {product.unit}</span>}
        </div>

        {available <= 5 && available > 0 && (
          <div className="mt-1 text-xs font-medium text-orange-500">Only {available} left in stock</div>
        )}
        {available === 0 && (
          <div className="mt-1 text-xs font-medium text-red-500">Out of stock</div>
        )}

        {product.description && (
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">{product.description}</p>
        )}

        {/* Qty selector */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center rounded-full border border-gray-200">
            <button onClick={() => setQty(Math.max(1, qty - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-gray-600 hover:bg-gray-100 active:bg-gray-200">
              −
            </button>
            <span className="w-10 text-center text-base font-semibold">{qty}</span>
            <button onClick={() => setQty(Math.min(available || 99, qty + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-gray-600 hover:bg-gray-100 active:bg-gray-200">
              +
            </button>
          </div>
          <span className="text-sm text-gray-500">= ₹{(product.sellingPrice * qty).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-2 bg-white border-t border-gray-100">
        <button
          onClick={handleAddToCart}
          disabled={available === 0}
          className={`mt-2 w-full rounded-full py-3.5 text-base font-semibold transition-colors ${added ? "bg-green-700 text-white" : available === 0 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-green-600 text-white active:bg-green-700"}`}>
          {added ? "✓ Added to cart" : available === 0 ? "Out of stock" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { addToCart } from "@/lib/cart-store";

interface AttrDef {
  id: string;
  key: string;
  label: string;
  dataType: string;
  unit: string | null;
  options: unknown;
  isRequired: boolean;
  isVariantAxis: boolean;
  showOnLabel: boolean;
}

interface Variant {
  id: string;
  name: string;
  sku: string;
  sellPrice?: number | null;
  attributes?: Record<string, unknown> | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sellPrice: number;
  imageUrls?: string[] | null;
  unit?: string;
  description?: string | null;
  isActive: boolean;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  stocks?: { quantity: number }[];
  variants?: Variant[];
  attributeDefinitions?: AttrDef[];
  customAttributes?: Record<string, unknown> | null;
}

function optionList(options: unknown): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "object" && options !== null && Array.isArray((options as { values?: unknown }).values)) {
    return ((options as { values: unknown[] }).values).map(String);
  }
  return [];
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [id, setId] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    api<{ data: Product }>("inventory", `/api/products/${id}`).then((r) => {
      if (!r.error) {
        const p = r.data.data;
        setProduct(p);
        const init: Record<string, string> = {};
        for (const def of p.attributeDefinitions ?? []) {
          const opts = optionList(def.options);
          const fromProduct = p.customAttributes?.[def.key];
          if (fromProduct != null && fromProduct !== "") {
            init[def.key] = String(fromProduct);
          } else if (opts.length === 1) {
            init[def.key] = opts[0];
          }
        }
        setSelected(init);
      }
      setLoading(false);
    });
  }, [id]);

  const matchedVariant = useMemo(() => {
    if (!product?.variants?.length) return null;
    return (
      product.variants.find((v) => {
        const attrs = v.attributes ?? {};
        return Object.entries(selected).every(([k, val]) => String(attrs[k] ?? "") === val);
      }) ?? null
    );
  }, [product, selected]);

  const unitPrice = matchedVariant?.sellPrice ?? product?.sellPrice ?? 0;
  const available =
    product?.stocks?.reduce((s, w) => s + (w.quantity ?? 0), 0) ?? 99;

  const selectableDefs = (product?.attributeDefinitions ?? []).filter(
    (d) => optionList(d.options).length > 0 || d.isVariantAxis
  );

  function handleAddToCart() {
    if (!product) return;
    setError("");
    for (const def of selectableDefs) {
      if (def.isRequired && !selected[def.key]) {
        setError(`Please select ${def.label}`);
        return;
      }
    }
    const attrLabel = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    try {
      addToCart({
        productId: product.id,
        variantId: matchedVariant?.id,
        name: attrLabel ? `${product.name} (${attrLabel})` : product.name,
        sku: matchedVariant?.sku ?? product.sku,
        price: Number(unitPrice),
        qty,
        imageUrl: product.imageUrls?.[0],
        selectedAttributes: { ...selected },
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to cart");
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-gray-400">Loading…</div>;
  if (!product) return <div className="flex items-center justify-center py-16 text-gray-400">Product not found</div>;

  const img = product.imageUrls?.[0];

  return (
    <div className="pb-28">
      <button type="button" onClick={() => router.back()} className="flex items-center gap-1 px-4 py-3 text-sm text-gray-600">
        ← Back
      </button>

      <div className="mx-3 flex h-52 items-center justify-center rounded-2xl bg-gray-50 text-6xl overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.name} className="h-full w-full object-contain" />
        ) : (
          "📦"
        )}
      </div>

      <div className="px-4 mt-4">
        {product.brand && (
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{product.brand.name}</div>
        )}
        <h1 className="mt-1 text-xl font-bold text-gray-900">{product.name}</h1>
        {product.unit && <div className="text-sm text-gray-500 mt-0.5">{product.unit}</div>}
        {product.category && <div className="text-xs text-gray-400 mt-0.5">{product.category.name}</div>}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">₹{Number(unitPrice).toLocaleString("en-IN")}</span>
          {product.unit && <span className="text-sm text-gray-500">/ {product.unit}</span>}
        </div>

        {available <= 5 && available > 0 && (
          <div className="mt-1 text-xs font-medium text-orange-500">Only {available} left in stock</div>
        )}
        {available === 0 && <div className="mt-1 text-xs font-medium text-red-500">Out of stock</div>}

        {product.description && (
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">{product.description}</p>
        )}

        {selectableDefs.length > 0 && (
          <div className="mt-5 space-y-3">
            {selectableDefs.map((def) => {
              const opts = optionList(def.options);
              return (
                <div key={def.key}>
                  <div className="mb-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {def.label}
                    {def.unit ? ` (${def.unit})` : ""}
                    {def.isRequired ? " *" : ""}
                  </div>
                  {opts.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {opts.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelected((s) => ({ ...s, [def.key]: opt }))}
                          className={`rounded-full border px-3 py-1.5 text-sm ${
                            selected[def.key] === opt
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-gray-200 bg-white text-gray-700"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      value={selected[def.key] ?? ""}
                      onChange={(e) => setSelected((s) => ({ ...s, [def.key]: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                      placeholder={def.label}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center rounded-full border border-gray-200">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-gray-600"
            >
              −
            </button>
            <span className="w-10 text-center text-base font-semibold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(Math.min(available || 99, qty + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-gray-600"
            >
              +
            </button>
          </div>
          <span className="text-sm text-gray-500">= ₹{(Number(unitPrice) * qty).toLocaleString("en-IN")}</span>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      <div className="sticky bottom-0 border-t border-[var(--line)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={available === 0}
          className={`btn-primary-block ${
            added
              ? "btn-dark"
              : available === 0
                ? "rounded-full bg-gray-200 py-3.5 text-base font-semibold text-gray-400"
                : "btn-primary"
          }`}
        >
          {added ? "✓ Added to cart" : available === 0 ? "Out of stock" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

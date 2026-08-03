"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Chip,
  ChipGroup,
  Container,
  PriceDisplay,
  ProductGallery,
  QuantityStepper,
  Skeleton,
  StockBadge,
} from "@erp/ui";
import { api } from "@/lib/api-client";
import { addToCart } from "@/lib/cart-store";
import { productImageUrl } from "@/lib/media";

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

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const urls = (product.imageUrls ?? []).filter((u): u is string => typeof u === "string" && !!u.trim());
    if (urls.length) return urls;
    return [productImageUrl(product)];
  }, [product]);

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
        imageUrl: productImageUrl(product),
        selectedAttributes: { ...selected },
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to cart");
    }
  }

  if (loading) {
    return (
      <Container layout="wide" className="space-y-4 py-8">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="aspect-square w-full rounded-[var(--radius)]" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
      </Container>
    );
  }

  if (!product) {
    return (
      <Container layout="wide" className="py-16 text-center text-sm text-[var(--ink-soft)]">
        Product not found
      </Container>
    );
  }

  return (
    <div className="pb-28">
      <Container layout="wide" className="py-4 md:py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          ← Back
        </button>

        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          <ProductGallery images={galleryImages} alt={product.name} />

          <div className="flex flex-col">
            {product.brand && (
              <p className="cx-eyebrow">{product.brand.name}</p>
            )}
            <h1 className="font-display mt-2 text-2xl font-semibold text-[var(--ink)] md:text-3xl">
              {product.name}
            </h1>
            {product.unit && (
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{product.unit}</p>
            )}
            {product.category && (
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]/70">{product.category.name}</p>
            )}

            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <PriceDisplay amount={Number(unitPrice)} size="lg" />
              {product.unit && (
                <span className="text-sm text-[var(--ink-soft)]">/ {product.unit}</span>
              )}
            </div>

            <div className="mt-2">
              <StockBadge available={available} />
            </div>

            {product.description && (
              <p className="mt-4 text-sm leading-relaxed text-[var(--ink-soft)]">{product.description}</p>
            )}

            {selectableDefs.length > 0 && (
              <div className="mt-6 space-y-5">
                {selectableDefs.map((def) => {
                  const opts = optionList(def.options);
                  const label = `${def.label}${def.unit ? ` (${def.unit})` : ""}${def.isRequired ? " *" : ""}`;
                  return opts.length > 0 ? (
                    <ChipGroup key={def.key} label={label}>
                      {opts.map((opt) => (
                        <Chip
                          key={opt}
                          active={selected[def.key] === opt}
                          onClick={() => setSelected((s) => ({ ...s, [def.key]: opt }))}
                        >
                          {opt}
                        </Chip>
                      ))}
                    </ChipGroup>
                  ) : (
                    <div key={def.key} className="space-y-2">
                      <div className="text-sm font-semibold text-[var(--ink)]">{label}</div>
                      <input
                        value={selected[def.key] ?? ""}
                        onChange={(e) => setSelected((s) => ({ ...s, [def.key]: e.target.value }))}
                        className="min-h-[var(--touch-min)] w-full rounded-[var(--radius)] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
                        placeholder={def.label}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <QuantityStepper
                value={qty}
                onChange={setQty}
                max={available || 99}
              />
              <span className="text-sm text-[var(--ink-soft)]">
                = <PriceDisplay amount={Number(unitPrice) * qty} size="sm" />
              </span>
            </div>
            {error && <div className="mt-3 text-sm text-[var(--danger)]">{error}</div>}
          </div>
        </div>
      </Container>

      <div className="sticky bottom-0 z-10 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_92%,white)] px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto w-full max-w-[var(--layout-wide)]">
          <Button
            variant={added ? "secondary" : "primary"}
            size="block"
            onClick={handleAddToCart}
            disabled={available === 0}
          >
            {added ? "✓ Added to cart" : available === 0 ? "Out of stock" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </div>
  );
}

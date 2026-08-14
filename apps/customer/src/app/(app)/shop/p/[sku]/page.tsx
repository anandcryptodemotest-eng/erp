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
import { productGalleryUrls, productImageUrl } from "@/lib/media";
import { PdpCartButton } from "@/components/PdpCartButton";

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

export default function ProductDetailPage({ params }: { params: Promise<{ sku: string }> }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [id, setId] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setId(p.sku));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    api<{ data: Product }>("inventory", `/api/portal/products/${id}`).then((r) => {
      if (!r.error) {
        const p = r.data?.data; if (!p) { setLoading(false); return; }
        setProduct(p);
        try {
          const key = "customer_recent_viewed";
          const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{id:string;name:string;sellPrice?:number;imageUrls?:string[]}>;
          const next = [{ id: p.id, name: p.name, sellPrice: p.sellPrice, imageUrls: p.imageUrls ?? undefined }, ...prev.filter((x) => x.id !== p.id)].slice(0, 8);
          localStorage.setItem(key, JSON.stringify(next));
        } catch { /* ignore */ }
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
    return productGalleryUrls(product);
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
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
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

  const lineTotal = Number(unitPrice) * qty;

  return (
    <div className="pb-24 md:pb-28">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--mist)] text-lg font-bold text-[var(--ink)]"
          aria-label="Back"
        >
          ←
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--ink)]">{product.name}</p>
        <PdpCartButton />
      </div>

      <Container layout="wide" className="py-3 md:py-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 hidden text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] md:inline"
        >
          ← Back
        </button>

        <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[220px] md:sticky md:top-16 md:mx-0 md:max-w-none">
            <ProductGallery images={galleryImages} alt={product.name} size="compact" />
          </div>

          <div className="flex min-w-0 flex-col px-0">
            {product.brand && (
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--forest-mid)]">
                {product.brand.name}
              </p>
            )}
            <h1 className="mt-1 text-xl font-bold leading-tight text-[var(--ink)] md:text-2xl">
              {product.name}
            </h1>
            <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
              {product.unit ? <span>{product.unit}</span> : null}
              {product.category ? <span>· {product.category.name}</span> : null}
              <span className="font-mono">SKU {product.sku}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-2">
              <PriceDisplay amount={Number(unitPrice)} size="lg" />
              {product.unit && (
                <span className="text-sm text-[var(--ink-soft)]">/ {product.unit}</span>
              )}
            </div>

            <div className="mt-1.5">
              <StockBadge available={available} />
            </div>

            {product.description && (
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">{product.description}</p>
            )}

            {selectableDefs.length > 0 && (
              <div className="mt-5 space-y-4">
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
                    <div key={def.key} className="space-y-1.5">
                      <div className="text-[13px] font-bold text-[var(--ink)]">{label}</div>
                      <input
                        value={selected[def.key] ?? ""}
                        onChange={(e) => setSelected((s) => ({ ...s, [def.key]: e.target.value }))}
                        className="min-h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
                        placeholder={def.label}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {error && <div className="mt-3 text-sm text-[var(--danger)]">{error}</div>}
          </div>
        </div>

        <section className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--mist)] p-4">
          <h2 className="text-sm font-bold text-[var(--ink)]">Documents & specifications</h2>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Datasheets, installation guides, warranty and certifications appear here when attached.
          </p>
        </section>
      </Container>

      <div className="atc-bar anim-slide-up">
        <div className="mx-auto flex w-full max-w-[var(--layout-wide)] flex-wrap items-center gap-3">
          <QuantityStepper
            value={qty}
            onChange={setQty}
            max={available || 99}
          />
          <div className="min-w-0 flex-1 text-sm">
            <span className="text-[var(--ink-soft)]">Total </span>
            <PriceDisplay amount={lineTotal} size="sm" />
          </div>
          {added ? (
            <>
              <Button
                variant="outline"
                size="md"
                className="!rounded-md"
                onClick={handleAddToCart}
                disabled={available === 0}
              >
                Add more
              </Button>
              <Button
                variant="primary"
                size="md"
                className="!min-w-[8rem] !rounded-md flex-1 sm:flex-none"
                onClick={() => router.push("/cart")}
              >
                Go to cart
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="md"
              className="!min-w-[9rem] !rounded-md flex-1 sm:flex-none"
              onClick={handleAddToCart}
              disabled={available === 0}
            >
              {available === 0 ? "Out of stock" : "Add to Cart"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

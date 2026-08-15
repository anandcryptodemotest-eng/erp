"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
import { formatPortalPrice } from "@/lib/pricing-display";
import { PdpAtcActions } from "@/components/PdpAtcActions";
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
  sellPrice?: number | null;
  baseRate?: number | null;
  pricingBasis?: string | null;
  pricingUom?: string | null;
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
  taxRate?: number | null;
}

function optionList(options: unknown): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === "object" && options !== null && Array.isArray((options as { values?: unknown }).values)) {
    return ((options as { values: unknown[] }).values).map(String);
  }
  return [];
}

function specLines(product: Product, selected: Record<string, string>): string[] {
  const lines: string[] = [];
  const attrs = { ...(product.customAttributes ?? {}), ...selected };
  const thickness = attrs.thickness_mm ?? attrs.thickness;
  const size = attrs.size;
  const grade = attrs.grade;
  const finish = attrs.finish;
  const bits = [grade, finish, thickness != null && thickness !== "" ? `${thickness}mm` : null]
    .filter(Boolean)
    .map(String);
  if (bits.length) lines.push(bits.join(" · "));
  if (size) lines.push(String(size).replace(/x/gi, " × "));
  return lines;
}

export default function ProductDetailPage({ params }: { params: Promise<{ sku: string }> }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
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
        const p = r.data?.data;
        if (!p) {
          setLoading(false);
          return;
        }
        setProduct(p);
        try {
          const key = "customer_recent_viewed";
          const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as Array<{
            id: string;
            name: string;
            sellPrice?: number | null;
            baseRate?: number | null;
            pricingBasis?: string | null;
            pricingUom?: string | null;
            unit?: string;
            imageUrls?: string[];
          }>;
          const next = [
            {
              id: p.id,
              name: p.name,
              sellPrice: p.sellPrice,
              baseRate: p.baseRate,
              pricingBasis: p.pricingBasis,
              pricingUom: p.pricingUom,
              unit: p.unit,
              imageUrls: p.imageUrls ?? undefined,
            },
            ...prev.filter((x) => x.id !== p.id),
          ].slice(0, 8);
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
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

  const catalogPrice = useMemo(() => {
    if (!product) return formatPortalPrice({});
    return formatPortalPrice({
      sellPrice: matchedVariant?.sellPrice ?? product.sellPrice,
      baseRate: product.baseRate,
      pricingBasis: product.pricingBasis,
      pricingUom: product.pricingUom,
      unit: product.unit,
    });
  }, [product, matchedVariant]);

  const unitPrice = catalogPrice.amount;
  const available =
    product?.stocks?.reduce((s, w) => s + (w.quantity ?? 0), 0) ?? 99;

  const selectableDefs = (product?.attributeDefinitions ?? []).filter(
    (d) => optionList(d.options).length > 0 || d.isVariantAxis
  );

  const galleryImages = useMemo(() => {
    if (!product) return [];
    return productGalleryUrls({
      ...product,
      categoryName: product.category?.name,
    });
  }, [product]);

  const foldSpecs = product ? specLines(product, selected) : [];

  function handleAddToCart() {
    if (!product) return;
    setError("");
    for (const def of selectableDefs) {
      if (def.isRequired && !selected[def.key]) {
        setError(`Please select ${def.label}`);
        return;
      }
    }
    if (unitPrice == null || unitPrice <= 0) {
      setError("Price on request — contact dealer to order this item");
      return;
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

  const lineTotal = unitPrice != null ? unitPrice * qty : null;
  const canAdd = available > 0 && unitPrice != null && unitPrice > 0;

  return (
    <div className="pb-24 md:pb-28" data-pdp>
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--mist)] text-lg font-bold text-[var(--ink)] md:hidden"
          aria-label="Back"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="hidden text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] md:inline"
        >
          ← Back
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--ink)] md:hidden">{product.name}</p>
        <PdpCartButton className="ml-auto" />
      </div>

      <Container layout="wide" className="py-3 md:py-6">
        {/* Above the fold: what / spec / price / availability / buy path */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:items-start md:gap-6">
          <div className="mx-auto w-full max-w-[240px] md:sticky md:top-16 md:mx-0 md:max-w-none">
            <ProductGallery images={galleryImages} alt={product.name} size="compact" />
          </div>

          <div className="flex min-w-0 flex-col px-0">
            {product.brand && (
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--forest-mid)]">
                {product.brand.name}
              </p>
            )}
            <h1 className="mt-0.5 text-xl font-bold leading-tight text-[var(--ink)] md:text-2xl">
              {product.name}
            </h1>
            {foldSpecs.length > 0 ? (
              <p className="mt-1 text-sm font-medium text-[var(--ink-soft)]">{foldSpecs.join(" · ")}</p>
            ) : null}
            <p className="mt-1 font-mono text-xs text-[var(--ink-soft)]">SKU {product.sku}</p>

            <div className="mt-3 flex flex-wrap items-baseline gap-2">
              <PriceDisplay amount={catalogPrice.label} size="lg" />
              {catalogPrice.kind === "fixed" && product.unit ? (
                <span className="text-sm text-[var(--ink-soft)]">/ {product.unit}</span>
              ) : null}
            </div>

            <div className="mt-2">
              <StockBadge available={available} />
            </div>

            {selectableDefs.length > 0 && (
              <div className="mt-4 space-y-3">
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
          <h2 className="text-sm font-bold text-[var(--ink)]">Specifications</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--ink-soft)]">
            {product.category ? (
              <li>
                <span className="font-medium text-[var(--ink)]">Category:</span> {product.category.name}
              </li>
            ) : null}
            {product.unit ? (
              <li>
                <span className="font-medium text-[var(--ink)]">Unit:</span> {product.unit}
              </li>
            ) : null}
            {product.pricingBasis ? (
              <li>
                <span className="font-medium text-[var(--ink)]">Pricing:</span> {product.pricingBasis}
                {product.pricingUom ? ` (${product.pricingUom})` : ""}
              </li>
            ) : null}
            {product.taxRate != null ? (
              <li>
                <span className="font-medium text-[var(--ink)]">GST:</span> {product.taxRate}%
              </li>
            ) : null}
            {Object.entries(product.customAttributes ?? {}).map(([k, v]) => (
              <li key={k}>
                <span className="font-medium text-[var(--ink)]">{k}:</span> {String(v)}
              </li>
            ))}
            {product.description ? <li className="pt-1 leading-relaxed">{product.description}</li> : null}
            {!product.description && Object.keys(product.customAttributes ?? {}).length === 0 ? (
              <li>Datasheets and certifications appear here when attached.</li>
            ) : null}
          </ul>
        </section>
      </Container>

      <div className="atc-bar anim-slide-up">
        <div className="mx-auto flex w-full max-w-[var(--layout-wide)] flex-wrap items-center gap-3">
          <QuantityStepper value={qty} onChange={setQty} max={available || 99} />
          <div className="min-w-0 flex-1 text-sm">
            <span className="text-[var(--ink-soft)]">Total </span>
            <PriceDisplay
              amount={lineTotal != null ? lineTotal : "Price on request"}
              size="sm"
            />
          </div>
          <PdpAtcActions
            canAdd={canAdd}
            onAdd={handleAddToCart}
            disabledLabel={available <= 0 ? "Out of stock" : "Price on request"}
          />
        </div>
      </div>
    </div>
  );
}

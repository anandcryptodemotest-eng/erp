"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Chip,
  ChipGroup,
  PriceDisplay,
  ProductGallery,
  QuantityStepper,
  StockBadge,
  Container,
} from "@erp/ui";
import { api } from "@/lib/api-client";
import { addToCart } from "@/lib/cart-store";
import { productImageUrl } from "@/lib/media";

type GroupDetail = {
  groupCode: string;
  groupName: string;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  attributes: { key: string; label: string; options: string[]; isIdentity: boolean }[];
  requiredKeys: string[];
  imageUrls: string[];
  pricingBasis: string;
  baseRate: number | null;
  pricingUom: string | null;
};

type ResolveResult = {
  completeness: { complete: boolean; missing: string[]; unique: boolean; candidates: number };
  product: {
    id: string;
    sku: string;
    name: string;
    sellPrice: number | null;
    pricingBasis: string;
    baseRate: number | null;
    pricingUom: string | null;
    customAttributes: Record<string, unknown>;
    imageUrls: string[];
  } | null;
  stock: { available: number } | null;
  hint: string | null;
};

type QuoteData = {
  unitPrice?: number;
  lineTotal?: number;
};

export default function CatalogGroupPage({ params }: { params: Promise<{ groupCode: string }> }) {
  const router = useRouter();
  const [groupCode, setGroupCode] = useState("");
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    params.then((p) => setGroupCode(decodeURIComponent(p.groupCode)));
  }, [params]);

  useEffect(() => {
    if (!groupCode) return;
    setLoading(true);
    api<{ data: GroupDetail }>("inventory", `/api/catalog/groups/${encodeURIComponent(groupCode)}`).then((r) => {
      if (!r.error) {
        const g = r.data.data;
        setGroup(g);
        const initial: Record<string, string> = {};
        for (const a of g.attributes ?? []) {
          if (a.options.length === 1) initial[a.key] = a.options[0];
        }
        setSelected(initial);
      }
      setLoading(false);
    });
  }, [groupCode]);

  useEffect(() => {
    if (!groupCode || !group) return;
    const t = setTimeout(() => {
      api<{ data: ResolveResult }>("inventory", "/api/catalog/resolve", {
        method: "POST",
        body: JSON.stringify({ groupCode, attributes: selected }),
      }).then((r) => {
        if (!r.error) setResolved(r.data.data);
        else setResolved(null);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [groupCode, group, selected]);

  useEffect(() => {
    const product = resolved?.product;
    if (!product) {
      setQuote(null);
      return;
    }
    api<{ data: { quote?: QuoteData } & QuoteData }>("inventory", "/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        productId: product.id,
        quantity: qty,
        attributes: product.customAttributes,
      }),
    }).then((r) => {
      if (r.error) {
        setQuote(null);
        return;
      }
      const payload = r.data.data ?? r.data;
      const q = (payload as { quote?: QuoteData }).quote ?? (payload as QuoteData);
      setQuote(q);
    });
  }, [resolved?.product?.id, qty, resolved?.product?.customAttributes]);

  const canAdd = !!(
    resolved?.completeness.complete &&
    resolved.completeness.unique &&
    resolved.product &&
    (quote?.unitPrice != null || resolved.product.sellPrice != null)
  );
  const unitPrice = quote?.unitPrice ?? resolved?.product?.sellPrice ?? null;

  const galleryImages = useMemo(() => {
    if (!group) return [];
    const urls =
      resolved?.product != null
        ? resolved.product.imageUrls ?? []
        : group.imageUrls ?? [];
    if (urls.length) return urls;
    return [
      productImageUrl({
        name: resolved?.product?.name ?? group.groupName,
        imageUrls: urls,
        sku: resolved?.product?.sku,
      }),
    ];
  }, [group, resolved?.product]);

  const primaryImage = galleryImages[0] ?? "";

  function add() {
    if (!canAdd || !resolved?.product || unitPrice == null) return;
    addToCart({
      productId: resolved.product.id,
      sku: resolved.product.sku,
      name: resolved.product.name,
      price: unitPrice,
      qty,
      imageUrl: primaryImage || undefined,
      selectedAttributes: selected,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) {
    return (
      <Container className="py-10 text-sm text-[var(--ink-soft)]">Loading…</Container>
    );
  }
  if (!group) {
    return (
      <Container className="py-10 text-[var(--ink-soft)]">Product group not found.</Container>
    );
  }

  return (
    <Container layout="wide" className="py-4 md:py-8">
      <button
        type="button"
        onClick={() => router.push("/products")}
        className="mb-4 text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        ← Shop
      </button>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <ProductGallery images={galleryImages} alt={group.groupName} />

        <div className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--amber)]">
            {[group.brand?.name, group.category?.name].filter(Boolean).join(" · ") || "Catalog"}
          </p>
          <h1 className="font-display mt-2 text-2xl font-semibold text-[var(--ink)] md:text-3xl">
            {group.groupName}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PriceDisplay amount={unitPrice} size="lg" />
            {resolved?.stock != null ? <StockBadge available={resolved.stock.available} /> : null}
          </div>

          <div className="mt-8 space-y-5">
            {group.attributes.map((attr) => (
              <ChipGroup key={attr.key} label={attr.label}>
                {attr.options.map((opt) => (
                  <Chip
                    key={opt}
                    active={selected[attr.key] === opt}
                    onClick={() => setSelected((s) => ({ ...s, [attr.key]: opt }))}
                  >
                    {opt}
                  </Chip>
                ))}
              </ChipGroup>
            ))}
          </div>

          <div className="mt-8 space-y-4 border-t border-[var(--line)] pt-6">
            {resolved?.hint && !canAdd ? (
              <p className="text-sm text-amber-800">{resolved.hint}</p>
            ) : null}
            {canAdd && resolved?.product ? (
              <p className="font-mono text-xs text-[var(--ink-soft)]">SKU {resolved.product.sku}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              <QuantityStepper value={qty} onChange={setQty} />
              <Button
                variant="primary"
                size="block"
                className="min-w-[12rem] flex-1"
                disabled={!canAdd}
                onClick={add}
              >
                {added ? "Added ✓" : "Add to Cart"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

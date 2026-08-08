"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BillSummary,
  Button,
  Chip,
  ChipGroup,
  Container,
  PriceDisplay,
  PriceQuoteHeader,
  ProductGallery,
  QuantityStepper,
  StockBadge,
} from "@erp/ui";
import { api } from "@/lib/api-client";
import { addToCart } from "@/lib/cart-store";
import { productGalleryUrls } from "@/lib/media";
import { PdpCartButton } from "@/components/PdpCartButton";
import {
  billRowsFromQuote,
  cartBillLinesFromQuote,
  measureFromQuote,
  quoteFormula,
  type QuoteLike,
} from "@/lib/pricing-display";

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
  products?: { sellPrice: number | null }[];
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

export default function CatalogGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const router = useRouter();
  const [groupCode, setGroupCode] = useState("");
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [quote, setQuote] = useState<QuoteLike | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    params.then((p) => setGroupCode(decodeURIComponent(p.group)));
  }, [params]);

  useEffect(() => {
    if (!groupCode) return;
    setLoading(true);
    api<{ data: GroupDetail }>("inventory", `/api/portal/catalog/groups/${encodeURIComponent(groupCode)}`).then((r) => {
      if (!r.error) {
        const g = r.data?.data; if (!g) { setLoading(false); return; }
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
      api<{ data: ResolveResult }>("inventory", "/api/portal/catalog/resolve", {
        method: "POST",
        body: JSON.stringify({ groupCode, attributes: selected }),
      }).then((r) => {
        if (!r.error) setResolved(r.data?.data ?? null);
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
    api<{ data: { quote?: QuoteLike } }>("inventory", "/api/portal/pricing/quote", {
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
      const payload = r.data?.data;
      setQuote(payload?.quote ?? null);
    });
  }, [resolved?.product?.id, qty, resolved?.product?.customAttributes]);

  const canAdd = !!(
    resolved?.completeness.complete &&
    resolved.completeness.unique &&
    resolved.product &&
    (quote?.unitPrice != null || resolved.product.sellPrice != null)
  );

  const unitPrice = quote?.unitPrice ?? resolved?.product?.sellPrice ?? null;
  const lineTotal = quote?.lineTotal ?? (unitPrice != null ? unitPrice * qty : null);
  const rateAmount = quote?.rate?.amount ?? group?.baseRate ?? null;
  const rateUom = quote?.rate?.per ?? group?.pricingUom ?? null;
  const isMeasured =
    (quote?.basis != null && quote.basis !== "PER_EACH") ||
    (group?.pricingBasis != null && group.pricingBasis !== "PER_EACH");

  const missingLabels = useMemo(() => {
    if (!group || !resolved?.completeness.missing?.length) return [];
    return resolved.completeness.missing.map(
      (k) => group.attributes.find((a) => a.key === k)?.label ?? k
    );
  }, [group, resolved?.completeness.missing]);

  const galleryImages = useMemo(() => {
    if (!group) return [];
    return productGalleryUrls({
      name: resolved?.product?.name ?? group.groupName,
      sku: resolved?.product?.sku,
      id: resolved?.product?.id,
      imageUrls:
        resolved?.product != null
          ? resolved.product.imageUrls ?? []
          : group.imageUrls ?? [],
    });
  }, [group, resolved?.product]);

  const primaryImage = galleryImages[0] ?? "";
  const billRows = quote ? billRowsFromQuote(quote, qty) : [];
  const formula = quoteFormula(quote);
  const measure = measureFromQuote(quote);

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
      pricingBasis: quote?.basis ?? resolved.product.pricingBasis,
      rateAmount: quote?.rate?.amount,
      rateUom: quote?.rate?.per,
      measureQuantity: measure?.quantity,
      measureUom: measure?.uom,
      resolvedQuantity: quote?.resolvedQuantity ?? (measure ? measure.quantity * qty : undefined),
      lineTotal: lineTotal ?? unitPrice * qty,
      billLines: quote ? cartBillLinesFromQuote(quote, qty) : undefined,
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
    <div className="pb-24 md:pb-28">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#e8e8e8] bg-white px-3 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => router.push("/shop")}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f5f5f5] text-lg font-bold text-[var(--ink)]"
          aria-label="Back to shop"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--ink)]">{group.groupName}</p>
        </div>
        <PdpCartButton />
      </div>

      <Container layout="wide" className="py-3 md:py-6">
        <button
          type="button"
          onClick={() => router.push("/shop")}
          className="mb-3 hidden text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] md:inline"
        >
          ← Shop
        </button>

        <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[220px] md:sticky md:top-16 md:mx-0 md:max-w-none">
            <ProductGallery images={galleryImages} alt={group.groupName} size="compact" />
          </div>

          <div className="flex min-w-0 flex-col px-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--forest-mid)]">
              {[group.brand?.name, group.category?.name].filter(Boolean).join(" · ") || "Catalog"}
            </p>
            <h1 className="mt-1 text-xl font-bold leading-tight text-[var(--ink)] md:text-2xl">
              {group.groupName}
            </h1>

            <div className="mt-3">
              {quote && unitPrice != null ? (
                <PriceQuoteHeader
                  rateAmount={isMeasured ? rateAmount : null}
                  rateUom={isMeasured ? rateUom : null}
                  unitPrice={unitPrice}
                  unitLabel="per unit"
                  formula={formula}
                />
              ) : rateAmount != null && isMeasured ? (
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-[var(--ink-soft)]">From</span>
                  <PriceDisplay amount={rateAmount} size="lg" />
                  {rateUom ? (
                    <span className="text-sm font-semibold text-[var(--ink-soft)]">/ {rateUom}</span>
                  ) : null}
                </div>
              ) : (
                <PriceDisplay amount={unitPrice} size="lg" />
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {resolved?.stock != null ? <StockBadge available={resolved.stock.available} /> : null}
              {canAdd && resolved?.product ? (
                <span className="font-mono text-[11px] text-[var(--ink-soft)]">
                  SKU {resolved.product.sku}
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
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

            {resolved?.hint && !canAdd ? (
              <p className="mt-4 text-sm text-amber-800">{resolved.hint}</p>
            ) : null}

            {quote && billRows.length > 0 && lineTotal != null ? (
              <BillSummary
                className="mt-5"
                title="Price breakup"
                rows={billRows}
                totalLabel="Line total"
                totalValue={lineTotal}
                footer="Rate is per measured unit; line total = (measure × rate) × quantity."
              />
            ) : null}
          </div>
        </div>
      </Container>

      <div className="atc-bar anim-slide-up">
        <div className="mx-auto flex w-full max-w-[var(--layout-wide)] flex-wrap items-center gap-3">
          <QuantityStepper value={qty} onChange={setQty} />
          <div className="min-w-0 flex-1">
            {lineTotal != null ? (
              <div className="text-sm">
                <span className="text-[var(--ink-soft)]">Total </span>
                <PriceDisplay amount={lineTotal} size="sm" />
                {formula ? (
                  <div className="text-[11px] text-[var(--ink-soft)]">{formula}</div>
                ) : null}
              </div>
            ) : missingLabels.length > 0 ? (
              <p className="text-xs text-[var(--ink-soft)]">
                Select {missingLabels.join(", ")}
              </p>
            ) : (
              <p className="text-xs text-[var(--ink-soft)]">Configure options to add</p>
            )}
          </div>
          {added ? (
            <>
              <Button
                variant="outline"
                size="md"
                className="!rounded-md"
                disabled={!canAdd}
                onClick={add}
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
              disabled={!canAdd}
              onClick={add}
            >
              Add to Cart
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

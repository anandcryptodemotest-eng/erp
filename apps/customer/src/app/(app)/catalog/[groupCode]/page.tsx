"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  } | null;
  stock: { available: number } | null;
  hint: string | null;
};

type QuoteData = {
  unitPrice?: number;
  lineTotal?: number;
  breakdown?: { label: string; value: number }[];
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
        // Pre-select axes that have only one option (e.g. fixed grade/thickness)
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

  const img = useMemo(() => {
    if (!group) return "";
    return productImageUrl({
      name: group.groupName,
      imageUrls: group.imageUrls?.length ? group.imageUrls : undefined,
      sku: resolved?.product?.sku,
    });
  }, [group, resolved?.product?.sku]);

  function add() {
    if (!canAdd || !resolved?.product || unitPrice == null) return;
    addToCart({
      productId: resolved.product.id,
      sku: resolved.product.sku,
      name: resolved.product.name,
      price: unitPrice,
      qty,
      imageUrl: img || undefined,
      selectedAttributes: selected,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!group) return <div className="p-8 text-gray-500">Product group not found.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button type="button" onClick={() => router.push("/products")} className="text-sm text-gray-500 mb-4">
        ← Products
      </button>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="w-full h-full object-cover" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">{group.groupName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {[group.brand?.name, group.category?.name].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-6 space-y-5">
            {group.attributes.map((attr) => (
              <div key={attr.key}>
                <div className="text-sm font-medium text-gray-800 mb-2">{attr.label}</div>
                <div className="flex flex-wrap gap-2">
                  {attr.options.map((opt) => {
                    const active = selected[attr.key] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSelected((s) => ({ ...s, [attr.key]: opt }))}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${
                          active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t pt-6 space-y-3">
            {resolved?.hint && !canAdd && (
              <p className="text-sm text-amber-700">{resolved.hint}</p>
            )}
            {canAdd && resolved?.product && (
              <p className="text-xs text-gray-400 font-mono">SKU {resolved.product.sku}</p>
            )}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-gray-900">
                {unitPrice != null ? `₹${Number(unitPrice).toLocaleString("en-IN")}` : "—"}
              </span>
              {resolved?.stock != null && (
                <span className="text-sm text-gray-500">
                  {resolved.stock.available > 0
                    ? `${resolved.stock.available} available`
                    : "Out of stock"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 border rounded-lg px-2 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!canAdd}
                onClick={add}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
              >
                {added ? "Added ✓" : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

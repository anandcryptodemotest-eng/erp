"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BillSummary, Button, Container, PriceDisplay, QuantityStepper, SectionHeader } from "@erp/ui";
import {
  getCart,
  updateQty,
  removeFromCart,
  cartTotal,
  lineAmount,
  subscribeCart,
  type CartItem,
} from "@/lib/cart-store";
import { productImageUrl } from "@/lib/media";
import { billSummaryRows, estimateBillFromLines } from "@/lib/bill-summary";

function attrSummary(item: CartItem): string | null {
  const attrs = item.selectedAttributes;
  if (!attrs) return null;
  const parts = Object.entries(attrs)
    .filter(([, v]) => v != null && String(v).length > 0)
    .map(([, v]) => String(v));
  return parts.length ? parts.join(" · ") : null;
}

function lineBillRows(item: CartItem): { label: string; value: string; muted?: boolean; emphasize?: boolean }[] {
  if (item.billLines?.length) {
    return item.billLines.map((r) => ({
      ...r,
      emphasize: r.label.toLowerCase().includes("price / unit"),
    }));
  }
  const rows: { label: string; value: string; muted?: boolean; emphasize?: boolean }[] = [];
  if (item.rateAmount != null && item.rateUom) {
    rows.push({
      label: "Rate",
      value: `₹${item.rateAmount.toLocaleString("en-IN")} / ${item.rateUom}`,
    });
  }
  if (item.measureQuantity != null && item.measureUom) {
    rows.push({
      label: "Measure / unit",
      value: `${item.measureQuantity} ${item.measureUom}`,
    });
  }
  rows.push({
    label: "Price / unit",
    value: `₹${item.price.toLocaleString("en-IN")}`,
    emphasize: true,
  });
  rows.push({ label: "Quantity", value: String(item.qty) });
  return rows;
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(getCart());
    return subscribeCart(() => setItems(getCart()));
  }, []);

  function handleQty(productId: string, variantId: string | undefined, qty: number) {
    setItems(updateQty(productId, variantId, qty));
  }

  function handleRemove(productId: string, variantId?: string) {
    setItems(removeFromCart(productId, variantId));
  }

  const bill = useMemo(
    () =>
      estimateBillFromLines(
        items.map((i) => ({
          price: i.price,
          qty: i.qty,
          taxRate: typeof i.taxRate === "number" ? i.taxRate : 0,
        }))
      ),
    [items]
  );
  const cartRows = useMemo(() => billSummaryRows(bill), [bill]);
  const payTotal = items.length ? bill.total : cartTotal();

  return (
    <Container layout="wide" className="pb-28 pt-4 md:pb-32">
      <SectionHeader title="Your cart" />
      <p className="mb-4 -mt-1 text-sm text-[var(--ink-soft)]">
        {items.length === 0
          ? "Nothing here yet"
          : `${items.length} line${items.length === 1 ? "" : "s"}`}
      </p>

      {items.length === 0 && (
        <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-6 py-12 text-center">
          <p className="text-lg font-bold text-[var(--ink)]">Cart is empty</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Browse products and add configurations.</p>
          <Link href="/shop" className="mt-5 inline-block">
            <Button variant="primary" className="!rounded-md">
              Start shopping
            </Button>
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((item, i) => {
              const attrs = attrSummary(item);
              const amount = lineAmount(item);
              return (
                <div
                  key={`${item.productId}-${item.variantId}`}
                  className="overflow-hidden rounded-lg border border-[#e8e8e8] bg-white"
                >
                  <div className="flex gap-3 p-3">
                    <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-md bg-[#f5f5f5]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl || productImageUrl({ id: item.productId, name: item.name }, i)}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[13px] font-semibold text-[var(--ink)]">
                        {item.name}
                      </div>
                      {attrs ? (
                        <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">{attrs}</p>
                      ) : null}
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--ink-soft)]">
                        SKU {item.sku}
                      </p>
                      {item.rateAmount != null && item.rateUom && item.measureQuantity != null ? (
                        <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
                          {item.measureQuantity} {item.measureUom} × ₹
                          {item.rateAmount.toLocaleString("en-IN")}/{item.rateUom} ={" "}
                          <span className="font-semibold text-[var(--ink)]">
                            ₹{item.price.toLocaleString("en-IN")}/unit
                          </span>
                        </p>
                      ) : (
                        <PriceDisplay amount={item.price} className="mt-1" size="sm" />
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <QuantityStepper
                          value={item.qty}
                          onChange={(n) => handleQty(item.productId, item.variantId, n)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemove(item.productId, item.variantId)}
                          className="ml-auto text-xs font-semibold text-[var(--danger)]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="self-start text-right">
                      <div className="text-sm font-bold tabular-nums text-[var(--ink)]">
                        ₹{amount.toLocaleString("en-IN")}
                      </div>
                      {item.qty > 1 ? (
                        <div className="text-[10px] text-[var(--ink-soft)]">
                          {item.qty} × ₹{item.price.toLocaleString("en-IN")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <details className="border-t border-[#f0f0f0] bg-[#fafafa]">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--forest)]">
                      Line breakup
                    </summary>
                    <div className="space-y-1 px-3 pb-3">
                      {lineBillRows(item).map((row) => (
                        <div
                          key={row.label}
                          className="flex justify-between gap-2 text-xs text-[var(--ink-soft)]"
                        >
                          <span>{row.label}</span>
                          <span
                            className={
                              row.emphasize
                                ? "font-semibold tabular-nums text-[var(--ink)]"
                                : "tabular-nums"
                            }
                          >
                            {row.value}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between gap-2 border-t border-[#e8e8e8] pt-1 text-xs font-bold text-[var(--ink)]">
                        <span>Line total</span>
                        <span className="tabular-nums">₹{amount.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>

          <BillSummary
            className="mt-4"
            title="Bill summary"
            rows={cartRows}
            totalLabel="To pay"
            totalValue={payTotal}
            footer="GST is included only when set on the product; otherwise 0%."
          />

          <div className="atc-bar mt-4 !relative !shadow-none">
            <Button
              variant="primary"
              size="block"
              className="!rounded-md"
              onClick={() => router.push("/checkout")}
            >
              Proceed to checkout · ₹{payTotal.toLocaleString("en-IN")}
            </Button>
          </div>
        </>
      )}
    </Container>
  );
}

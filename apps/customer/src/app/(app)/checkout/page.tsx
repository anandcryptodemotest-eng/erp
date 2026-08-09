"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormDefinition } from "@erp/workflow";
import { BillSummary, Button, Container, PriceDisplay, SectionHeader, Skeleton } from "@erp/ui";
import { AddressForm } from "@/components/AddressForm";
import { api } from "@/lib/api-client";
import { getCart, clearCart, saveCart, lineAmount, type CartItem } from "@/lib/cart-store";
import { reserveInventoryForCheckout, validateCartForCheckout } from "@/lib/checkout-validate";
import { ensureCustomerProfile } from "@/lib/ensure-customer-profile";
import { billSummaryRows, estimateBillFromLines } from "@/lib/bill-summary";
import { productImageUrl } from "@/lib/media";
import {
  CustomerScreenController,
  createCustomerHost,
} from "@/lib/ui-host/CustomerScreenController";

interface Address {
  id: string;
  label: string;
  line1: string;
  city: string;
  state?: string | null;
  pincode: string;
  isDefault: boolean;
}
interface CustomerProfile {
  id: string;
  name: string;
  wallet: number;
  addresses?: Address[];
}

function validPrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [screen, setScreen] = useState<FormDefinition | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [selectedAddr, setSelectedAddr] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [showNewAddr, setShowNewAddr] = useState(false);

  const bill = useMemo(
    () =>
      estimateBillFromLines(
        items.map((i) => ({
          price: lineAmount(i) / Math.max(1, i.qty),
          qty: i.qty,
          taxRate: typeof i.taxRate === "number" ? i.taxRate : 0,
        }))
      ),
    [items]
  );
  const subtotal = bill.subtotal;
  const payTotal = bill.total;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const cart = getCart();
      if (cart.length === 0) {
        router.replace("/cart");
        return;
      }

      const fixed: CartItem[] = [];
      for (const line of cart) {
        let price = line.price;
        if (!validPrice(price) || price <= 0) {
          // Measured products often have null sellPrice — requote
          const quoteRes = await api<{
            data?: { quote?: { unitPrice?: number }; unitPrice?: number };
          }>("portal", "/api/portal/pricing/quote", {
            method: "POST",
            body: JSON.stringify({
              productId: line.productId,
              variantId: line.variantId,
              quantity: line.qty,
              attributes: line.selectedAttributes ?? {},
            }),
          });
          const qp =
            quoteRes.data?.data?.quote?.unitPrice ?? quoteRes.data?.data?.unitPrice;
          if (validPrice(qp) && qp > 0) {
            price = qp;
          } else {
            const res = await api<{ data: { sellPrice?: number; name?: string } }>(
              "portal",
              `/api/portal/products/${line.productId}`
            );
            const sell = res.data?.data?.sellPrice;
            if (!validPrice(sell) || sell <= 0) {
              if (!cancelled) {
                setError(
                  `Could not load price for ${line.name || line.productId}. Remove it and re-add from shop.`
                );
              }
              continue;
            }
            price = sell;
            if (res.data?.data?.name) line.name = res.data.data.name;
          }
        }
        fixed.push({
          ...line,
          price,
          lineTotal: price * line.qty,
          variantId: line.variantId || undefined,
        });
      }

      if (cancelled) return;
      if (fixed.length === 0) {
        clearCart();
        router.replace("/products");
        return;
      }
      saveCart(fixed);
      setItems(fixed);

      const [profileEnsure, formRes] = await Promise.all([
        ensureCustomerProfile(),
        api<{ data: { definition: FormDefinition } }>(
          "sales",
          "/api/workflow-forms/published?formId=customer-checkout&audience=CUSTOMER"
        ),
      ]);

      if (cancelled) return;
      if (!profileEnsure.customer) {
        setError(profileEnsure.error ?? "Could not load customer profile");
        setReady(true);
        return;
      }
      const cust = profileEnsure.customer as unknown as CustomerProfile;
      setProfile(cust);
      const addrs = cust.addresses ?? [];
      setAddresses(addrs);
      const def = addrs.find((x) => x.isDefault) ?? addrs[0];
      if (!def) setShowNewAddr(true);
      else setSelectedAddr(def.id);

      const formDef = formRes.data?.data?.definition;
      if (!formDef?.layout?.length) {
        setError(formRes.error ?? "Checkout form not available");
        setReady(true);
        return;
      }
      setScreen(formDef);
      setFieldValues({
        paymentMethod: "COD",
        notes: "",
      });
      setReady(true);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submitCheckout(payload: Record<string, unknown>) {
    if (items.length === 0 || !profile) {
      setError("Customer profile not loaded");
      setPlacing(false);
      return;
    }

    const addressId = selectedAddr;
    if (!addressId) {
      setError("Please select or add a delivery address");
      setPlacing(false);
      setShowNewAddr(true);
      return;
    }

    setError("");
    setPlacing(true);

    const validated = await validateCartForCheckout(items);
    if (!validated.ok) {
      setError(validated.errors.join(" · ") || "Cart validation failed");
      setItems(validated.lines.length ? validated.lines : items);
      setPlacing(false);
      return;
    }
    if (validated.warnings.length) {
      // Surface price updates but continue
      setItems(validated.lines);
    } else {
      setItems(validated.lines);
    }

    await reserveInventoryForCheckout({
      reference: `checkout-${profile.id}-${Date.now()}`,
      lines: validated.lines,
    });

    const rawPay = String(payload.paymentMethod ?? fieldValues.paymentMethod ?? "COD");
    const paymentMethod = (
      ["COD", "COUNTER", "BANK_TRANSFER", "UPI", "CARD", "WALLET", "SPLIT"].includes(rawPay)
        ? rawPay
        : "COD"
    ) as "COD" | "COUNTER" | "BANK_TRANSFER" | "UPI" | "CARD" | "WALLET" | "SPLIT";
    const notes = String(payload.notes ?? fieldValues.notes ?? "").trim();

    const attrNotes = validated.lines
      .filter((i) => i.selectedAttributes && Object.keys(i.selectedAttributes).length)
      .map((i) => `${i.name}: ${JSON.stringify(i.selectedAttributes)}`)
      .join("; ");
    const combinedNotes = [notes, attrNotes].filter(Boolean).join("\n");

    const body = {
      customerId: profile.id,
      isOnlineOrder: true,
      deliveryAddressId: addressId,
      deliveryFee: 0,
      paymentMethod,
      ...(combinedNotes ? { notes: combinedNotes } : {}),
      items: validated.lines.map((i) => ({
        productId: i.productId,
        productName: i.name,
        ...(i.variantId ? { variantId: i.variantId } : {}),
        quantity: i.qty,
        unitPrice: Number(i.price),
      })),
    };

    const res = await api<{ data: { id: string; requestNumber: string; status: string } }>(
      "sales",
      "/api/sales-requests",
      { method: "POST", body: JSON.stringify(body) }
    );
    setPlacing(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const sreq = res.data?.data;
    if (!sreq?.id) {
      setError("Request created but response was incomplete");
      return;
    }
    clearCart();
    router.push(`/orders/${sreq.id}?placed=1&type=sreq`);
  }

  const host = useMemo(
    () =>
      createCustomerHost({
        permissions: {
          canEdit: true,
          canComplete: !placing && !showNewAddr && Boolean(selectedAddr),
          roles: ["CUSTOMER"],
        },
        navigation: { push: (path) => router.push(path), replace: (path) => router.replace(path) },
      }),
    [placing, showNewAddr, selectedAddr, router]
  );

  if (!ready) {
    return (
      <Container layout="wide" className="space-y-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <p className="text-center text-sm text-[var(--ink-soft)]">Preparing checkout…</p>
      </Container>
    );
  }

  if (items.length === 0) return null;

  return (
    <Container layout="wide" className="pb-28 pt-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--amber)]">Checkout</p>
      <SectionHeader title="Place order" className="mb-2" />
      {profile ? <p className="mb-6 -mt-2 text-sm text-[var(--ink-soft)]">Ordering as {profile.name}</p> : null}

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-[var(--ink)]">Items</h2>
        <div className="space-y-2 rounded-[var(--radius)] border border-[var(--line)] bg-white p-3 shadow-[var(--shadow-sm)]">
          {items.map((i, idx) => (
            <div key={`${i.productId}-${i.variantId ?? ""}`} className="flex items-center gap-3 text-sm">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--mist)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imageUrl || productImageUrl({ id: i.productId, name: i.name }, idx)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 font-medium text-[var(--ink)]">{i.name}</div>
                <div className="text-xs text-[var(--ink-soft)]">
                  Qty {i.qty} · <PriceDisplay amount={i.price} size="sm" className="inline" />
                  {i.rateAmount != null && i.rateUom && i.measureQuantity != null
                    ? ` · ${i.measureQuantity} ${i.measureUom} × ₹${i.rateAmount}/${i.rateUom}`
                    : ""}
                </div>
              </div>
              <PriceDisplay amount={lineAmount(i)} size="sm" />
            </div>
          ))}
        </div>
      </section>

      <BillSummary
        className="mb-2"
        title="Bill summary"
        rows={billSummaryRows(bill)}
        totalLabel="Order total"
        totalValue={payTotal}
        footer="GST is included only when set on the product; otherwise 0%. Sales may adjust pricing later."
      />
      <div className="mb-5" />

      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Delivery address</h2>
          {!showNewAddr ? (
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowNewAddr(true)}
            >
              + Add new
            </Button>
          ) : null}
        </div>

        {addresses.length > 0 && !showNewAddr ? (
          <div className="space-y-2">
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAddr(a.id)}
                className={`min-h-[var(--touch-min)] w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedAddr === a.id
                    ? "border-[var(--forest)] bg-[#f5f8f6]"
                    : "border-[#e8e8e8] bg-white"
                }`}
              >
                <span className="text-sm font-semibold text-[var(--ink)]">{a.label}</span>
                {a.isDefault ? (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                    Default
                  </span>
                ) : null}
                <div className="mt-0.5 text-xs text-[var(--ink-soft)]">
                  {a.line1}, {a.city}
                  {a.state ? `, ${a.state}` : ""} – {a.pincode}
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {(showNewAddr || addresses.length === 0) && profile ? (
          <div className="mb-2 space-y-2 rounded-lg border border-[#e8e8e8] bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--ink)]">
                {addresses.length === 0 ? "Add delivery address" : "New address"}
              </p>
              {addresses.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setShowNewAddr(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
            <AddressForm
              customerId={profile.id}
              initial={{ isDefault: addresses.length === 0 }}
              onSaved={async (created) => {
                setAddresses((prev) => {
                  const cleared = created.isDefault
                    ? prev.map((a) => ({ ...a, isDefault: false }))
                    : prev;
                  return [created, ...cleared.filter((a) => a.id !== created.id)];
                });
                setSelectedAddr(created.id);
                setShowNewAddr(false);
                setError("");
              }}
              onCancel={addresses.length > 0 ? () => setShowNewAddr(false) : undefined}
            />
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="mb-3 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_8%,white)] px-4 py-2.5 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {!showNewAddr && selectedAddr && screen ? (
        <CustomerScreenController
          host={host}
          screen={screen}
          order={{
            id: "checkout",
            status: "DRAFT",
              totalAmount: payTotal,
          }}
          customer={profile ? { id: profile.id, name: profile.name } : null}
          fieldValues={fieldValues}
          setFieldValue={(key, value) => setFieldValues((prev) => ({ ...prev, [key]: value }))}
          busy={placing}
          submitContext={{
            onBusy: setPlacing,
            onCheckoutSubmit: submitCheckout,
          }}
        />
      ) : null}
    </Container>
  );
}

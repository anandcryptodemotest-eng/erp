"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/admin-api";
import { Button, Input, PageScaffold } from "@erp/ui";

type Product = { id: string; name: string; sku?: string; unitPrice?: number };
type Line = { productId: string; productName: string; quantity: number; unitPrice: number };

export default function QuickBillPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [walkInName, setWalkInName] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderNumber?: string; pdfUrl?: string } | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const r = await api("/api/products?limit=100");
      setProducts(r.data ?? []);
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  function addLine() {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      setError("Select a product");
      return;
    }
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        quantity,
        unitPrice: p.unitPrice ?? 0,
      },
    ]);
    setProductId("");
    setQty("1");
    setError(null);
  }

  async function createBill() {
    if (lines.length === 0) {
      setError("Add at least one line");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api("/api/quick-bills", {
        method: "POST",
        body: JSON.stringify({
          walkInName: walkInName.trim() || undefined,
          issueBill: true,
          paymentMethod: "CASH",
          items: lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        }),
      });
      const order = r.data?.order;
      const invoice = r.data?.invoice?.invoice;
      setResult({
        orderNumber: order?.orderNumber,
        pdfUrl: r.data?.invoice?.pdfUrl ?? invoice?.pdfUrl,
      });
      setLines([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create Bill failed");
    } finally {
      setBusy(false);
    }
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  return (
    <PageScaffold
      className="space-y-6"
      hero={{
        eyebrow: "Sales",
        title: "Quick Bill",
        description: "Walk-in customer → Create Bill → same Invoice as Order Desk. No SREQ or prep workflow.",
      }}
    >
      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_10%,white)] px-4 py-2.5 text-sm text-[var(--danger)]">{error}</div>
      )}
      {result && (
        <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--success)_35%,var(--line))] bg-[color-mix(in_srgb,var(--success)_10%,white)] px-4 py-2.5 text-sm text-[var(--success)]">
          Bill created · {result.orderNumber}
          {result.pdfUrl ? (
            <>
              {" "}
              ·{" "}
              <a className="underline" href={result.pdfUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </>
          ) : null}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-4 max-w-xl">
        <Input
          label="Customer name (optional walk-in)"
          value={walkInName}
          onChange={(e) => setWalkInName(e.target.value)}
          placeholder="Walk-in Customer"
        />

        <label className="block text-xs text-[var(--ink-soft)]">
          Product
          <select
            className="mt-0.5 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.unitPrice != null ? `· ₹${p.unitPrice}` : ""}
              </option>
            ))}
          </select>
        </label>

        <Input label="Qty" value={qty} onChange={(e) => setQty(e.target.value)} type="number" min={1} />

        <Button type="button" variant="secondary" onClick={addLine}>
          Add line
        </Button>

        {lines.length > 0 && (
          <ul className="text-sm space-y-1 border-t border-[var(--line)] pt-3">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {l.productName} × {l.quantity}
                </span>
                <span>₹{(l.quantity * l.unitPrice).toFixed(2)}</span>
              </li>
            ))}
            <li className="flex justify-between font-semibold pt-2">
              <span>Subtotal</span>
              <span>₹{total.toFixed(2)}</span>
            </li>
          </ul>
        )}

        <Button disabled={busy || lines.length === 0} onClick={() => void createBill()}>
          {busy ? "Creating…" : "Create Bill"}
        </Button>
      </div>
    </PageScaffold>
  );
}

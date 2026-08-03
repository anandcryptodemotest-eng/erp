"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionGroup, Button, Trash2 } from "@erp/ui";

const iconSm = { width: "var(--icon-sm)", height: "var(--icon-sm)" } as const;
const deleteIconBtn =
  "text-[var(--ink-soft)] hover:text-[var(--danger)] focus-visible:text-[var(--danger)]";

type VariantRow = {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, unknown>;
  costPrice?: number | null;
  sellPrice?: number | null;
  stocks?: { quantity: number; warehouse?: { name: string } }[];
};

type AxisDef = { key: string; label: string; options: string[] };

export function ProductVariantsSection({
  productId,
  productSku,
  productStructure,
  variantAxes,
  axisDefs,
  onStructureChange,
  onAxesChange,
  api,
}: {
  productId: string | null;
  productSku: string;
  productStructure: "SIMPLE" | "VARIANT";
  variantAxes: string[];
  axisDefs: AxisDef[];
  onStructureChange: (s: "SIMPLE" | "VARIANT") => void;
  onAxesChange: (axes: string[]) => void;
  api: (path: string, init?: RequestInit) => Promise<{ data?: unknown; error?: string }>;
}) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [axisValues, setAxisValues] = useState<Record<string, string>>({});
  const [manualSku, setManualSku] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCost, setManualCost] = useState("");

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError("");
    try {
      const r = await api(`/api/products/${productId}/variants?limit=100`);
      setVariants(Array.isArray(r.data) ? (r.data as VariantRow[]) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load variants");
    } finally {
      setLoading(false);
    }
  }, [api, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setAxisValues((prev) => {
      const next: Record<string, string> = {};
      for (const key of variantAxes) {
        const def = axisDefs.find((d) => d.key === key);
        next[key] = prev[key] ?? (def?.options ?? []).join(", ");
      }
      return next;
    });
  }, [variantAxes, axisDefs]);

  async function generateFromAxes() {
    if (!productId) return;
    const axes: Record<string, string[]> = {};
    for (const key of variantAxes) {
      const vals = (axisValues[key] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!vals.length) {
        setError(`Add values for axis "${key}" (comma-separated)`);
        return;
      }
      axes[key] = vals;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/products/${productId}/variants`, {
        method: "POST",
        body: JSON.stringify({ generate: true, axes }),
      });
      onStructureChange("VARIANT");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    if (!productId) return;
    if (!manualSku.trim() || !manualName.trim()) {
      setError("SKU and name required");
      return;
    }
    const attributes: Record<string, string> = {};
    for (const key of variantAxes) {
      const first = (axisValues[key] ?? "").split(",")[0]?.trim();
      if (first) attributes[key] = first;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/products/${productId}/variants`, {
        method: "POST",
        body: JSON.stringify({
          sku: manualSku.trim(),
          name: manualName.trim(),
          attributes,
          ...(manualCost !== "" ? { costPrice: Number(manualCost) } : {}),
        }),
      });
      onStructureChange("VARIANT");
      setManualSku("");
      setManualName("");
      setManualCost("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(vid: string) {
    if (!productId || !confirm("Delete this variant? It will be hidden (soft delete).")) return;
    setBusy(true);
    try {
      await api(`/api/products/${productId}/variants/${vid}`, { method: "DELETE" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pe-section">
      <h3 className="pe-section-title">Product structure & variants</h3>
      <p className="text-xs text-[var(--ink-soft)] mb-3">
        SIMPLE = one stockable identity. VARIANT = physical SKUs by axis (size, color…). Stock and OMS use variantId.
      </p>

      <div className="flex flex-wrap gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="productStructure"
            checked={productStructure === "SIMPLE"}
            onChange={() => onStructureChange("SIMPLE")}
          />
          Simple
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="productStructure"
            checked={productStructure === "VARIANT"}
            onChange={() => onStructureChange("VARIANT")}
          />
          Variant
        </label>
      </div>

      {productStructure === "VARIANT" && (
        <>
          <div className="mb-3">
            <label className="block text-sm font-medium text-[var(--ink-soft)] mb-1">Variant axes</label>
            <div className="flex flex-wrap gap-2">
              {axisDefs.length === 0 && (
                <p className="text-xs text-[var(--ink-soft)]">
                  Mark attributes as variant axes in Fields, or type keys below after selecting size/color defs.
                </p>
              )}
              {axisDefs.map((d) => {
                const on = variantAxes.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      on ? "border-gray-800 bg-[var(--ink)] text-white" : "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-soft)]"
                    }`}
                    onClick={() =>
                      onAxesChange(
                        on ? variantAxes.filter((k) => k !== d.key) : [...variantAxes, d.key]
                      )
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {variantAxes.map((key) => {
            const def = axisDefs.find((d) => d.key === key);
            return (
              <div key={key} className="mb-2">
                <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">
                  {def?.label ?? key} values (comma-separated)
                </label>
                <input
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                  value={axisValues[key] ?? ""}
                  onChange={(e) => setAxisValues((v) => ({ ...v, [key]: e.target.value }))}
                  placeholder={def?.options?.length ? def.options.join(", ") : "8x4, 7x3"}
                />
              </div>
            );
          })}

          {!productId && (
            <p className="text-xs text-[var(--warning)] bg-amber-50 rounded-lg px-3 py-2 mb-3">
              Save the product first, then generate SKUs. Suggested prefix: {productSku || "(SKU)"}
            </p>
          )}

          {productId && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                disabled={busy || !variantAxes.length}
                onClick={() => void generateFromAxes()}
                className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Generate SKUs from axes
              </button>
            </div>
          )}

          {productId && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="SKU"
                value={manualSku}
                onChange={(e) => setManualSku(e.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Cost (optional)"
                value={manualCost}
                onChange={(e) => setManualCost(e.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void addManual()}
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-medium"
              >
                Add variant
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          {loading && <p className="text-xs text-[var(--ink-soft)]">Loading variants…</p>}

          {variants.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[var(--mist)] text-[var(--ink-soft)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Axes</th>
                    <th className="px-3 py-2 font-medium">Cost</th>
                    <th className="px-3 py-2 font-medium">Stock</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className="border-t border-[var(--line)]">
                      <td className="px-3 py-2 font-mono">{v.sku}</td>
                      <td className="px-3 py-2">{v.name}</td>
                      <td className="px-3 py-2 text-[var(--ink-soft)]">
                        {Object.entries(v.attributes ?? {})
                          .map(([k, val]) => `${k}=${val}`)
                          .join(", ")}
                      </td>
                      <td className="px-3 py-2">{v.costPrice ?? "—"}</td>
                      <td className="px-3 py-2">
                        {(v.stocks ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <ActionGroup aria-label="Row actions">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={deleteIconBtn}
                            aria-label={`Delete variant ${v.name}`}
                            title="Delete variant"
                            onClick={() => void deactivate(v.id)}
                          >
                            <Trash2 style={iconSm} aria-hidden />
                          </Button>
                        </ActionGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

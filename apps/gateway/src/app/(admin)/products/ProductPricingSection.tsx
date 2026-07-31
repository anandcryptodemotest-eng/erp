"use client";

import type { QuoteSuccess } from "@/lib/pricing-quote";
import { PeSection } from "./ProductEditorForm";

const BASIS_OPTIONS = [
  { value: "PER_EACH", label: "PER_EACH — fixed price per unit" },
  { value: "PER_AREA", label: "PER_AREA — rate × area" },
  { value: "PER_WEIGHT", label: "PER_WEIGHT — rate × weight" },
  { value: "PER_VOLUME", label: "PER_VOLUME — rate × volume" },
] as const;

const UOM_OPTIONS = ["sq_ft", "sq_m", "kg", "m3"] as const;

function isMeasured(basis: string) {
  return basis === "PER_AREA" || basis === "PER_WEIGHT" || basis === "PER_VOLUME";
}

function defaultUom(basis: string) {
  if (basis === "PER_AREA") return "sq_ft";
  if (basis === "PER_WEIGHT") return "kg";
  if (basis === "PER_VOLUME") return "m3";
  return "each";
}

export type PricingFormSlice = {
  pricingBasis: string;
  pricingUom: string;
  baseRate: string;
  sellPrice: string;
  weight: string;
  weightUnit: string;
};

export function ProductPricingSection({
  form,
  onChange,
  quotePreview,
  quotePreviewLoading,
  quotePreviewError,
}: {
  form: PricingFormSlice;
  onChange: (patch: Partial<PricingFormSlice>) => void;
  quotePreview: QuoteSuccess | null;
  quotePreviewLoading: boolean;
  quotePreviewError: string;
}) {
  const measured = isMeasured(form.pricingBasis);

  return (
    <PeSection title="Pricing">
      <div className="pe-grid">
        <div className={`pe-field ${measured ? "" : "pe-field-span"}`}>
          <label className="pe-label">Pricing Basis</label>
          <select
            className="pe-select"
            value={form.pricingBasis}
            onChange={(e) => {
              const pricingBasis = e.target.value;
              let pricingUom = form.pricingUom;
              if (isMeasured(pricingBasis) && (!pricingUom || pricingUom === "each")) {
                pricingUom = defaultUom(pricingBasis);
              }
              onChange({ pricingBasis, pricingUom });
            }}
          >
            {BASIS_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        {!measured && (
          <div className="pe-field">
            <label className="pe-label">Sell Price (per each) *</label>
            <input
              className="pe-input"
              type="number"
              required
              min={0}
              step="0.01"
              value={form.sellPrice}
              onChange={(e) => onChange({ sellPrice: e.target.value })}
              placeholder="List price"
            />
          </div>
        )}

        {measured && (
          <>
            <div className="pe-field">
              <label className="pe-label">Pricing UOM</label>
              <select
                className="pe-select"
                value={form.pricingUom}
                onChange={(e) => onChange({ pricingUom: e.target.value })}
              >
                {UOM_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="pe-field">
              <label className="pe-label">Rate per {form.pricingUom || "UOM"} (₹) *</label>
              <input
                className="pe-input"
                type="number"
                required
                min={0}
                step="0.01"
                value={form.baseRate}
                onChange={(e) => onChange({ baseRate: e.target.value })}
                placeholder="Required"
              />
            </div>
            {form.pricingBasis === "PER_WEIGHT" && (
              <>
                <div className="pe-field">
                  <label className="pe-label">Product weight</label>
                  <input
                    className="pe-input"
                    type="number"
                    min={0}
                    step="0.001"
                    value={form.weight}
                    onChange={(e) => onChange({ weight: e.target.value })}
                  />
                </div>
                <div className="pe-field">
                  <label className="pe-label">Weight unit</label>
                  <select
                    className="pe-select"
                    value={form.weightUnit}
                    onChange={(e) => onChange({ weightUnit: e.target.value })}
                  >
                    {["kg", "g", "lb"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="pe-preview">
        <div className="pe-preview-title">Preview</div>
        {quotePreviewLoading && <p className="pe-preview-muted">Quoting…</p>}
        {!quotePreviewLoading && quotePreviewError && (
          <p className="pe-preview-err">
            {!measured && /no rate found/i.test(quotePreviewError)
              ? "Enter sell price to preview."
              : quotePreviewError}
          </p>
        )}
        {!quotePreviewLoading && quotePreview && !measured && (
          <div className="pe-preview-body">
            <div className="pe-preview-muted">1 each</div>
            <div>
              <strong>₹{quotePreview.quote.unitPrice.toLocaleString("en-IN")}</strong>
            </div>
          </div>
        )}
        {!quotePreviewLoading && quotePreview && measured && (
          <div className="pe-preview-body">
            {form.pricingBasis === "PER_AREA" &&
              quotePreview.quote.measure?.length != null &&
              quotePreview.quote.measure?.width != null && (
                <div>
                  {quotePreview.quote.measure.length}×{quotePreview.quote.measure.width}
                </div>
              )}
            {form.pricingBasis === "PER_AREA" && quotePreview.quote.measure?.area != null && (
              <div className="pe-preview-muted">
                {quotePreview.quote.measure.area} {quotePreview.quote.pricingUom || "sq_ft"}
              </div>
            )}
            {form.pricingBasis === "PER_WEIGHT" && quotePreview.quote.measure?.weight != null && (
              <div className="pe-preview-muted">
                {quotePreview.quote.measure.weight} {quotePreview.quote.pricingUom || "kg"}
              </div>
            )}
            {form.pricingBasis === "PER_VOLUME" && quotePreview.quote.measure?.volume != null && (
              <div className="pe-preview-muted">
                {quotePreview.quote.measure.volume} {quotePreview.quote.pricingUom || "m3"}
              </div>
            )}
            {quotePreview.quote.rate?.amount != null && (
              <div className="pe-preview-muted">
                ₹{quotePreview.quote.rate.amount} /{" "}
                {quotePreview.quote.rate.per || form.pricingUom}
              </div>
            )}
            <div>
              <strong>
                ₹{quotePreview.quote.unitPrice.toLocaleString("en-IN")}
                {form.pricingBasis === "PER_AREA" ? " / sheet" : ""}
              </strong>
            </div>
          </div>
        )}
        {!quotePreviewLoading && !quotePreview && !quotePreviewError && (
          <p className="pe-preview-muted">
            {measured ? "Set rate and attributes to preview." : "Enter sell price to preview."}
          </p>
        )}
      </div>
    </PeSection>
  );
}

export { isMeasured as isMeasuredPricingBasis, defaultUom as defaultPricingUom };

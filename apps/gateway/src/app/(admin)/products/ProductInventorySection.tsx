"use client";

import { PeSection } from "./ProductEditorForm";

export type InventoryFormSlice = {
  costPrice: string;
  reorderLevel: string;
  initialStock: string;
};

export function ProductInventorySection({
  form,
  onChange,
  showInitialStock,
}: {
  form: InventoryFormSlice;
  onChange: (patch: Partial<InventoryFormSlice>) => void;
  showInitialStock: boolean;
}) {
  const costMissing = form.costPrice === "" || form.costPrice == null;

  return (
    <PeSection title="Inventory">
      <div className="pe-grid">
        <div className="pe-field">
          <label className="pe-label">Cost Price (₹)</label>
          <input
            className="pe-input"
            type="number"
            min={0}
            step="0.01"
            value={form.costPrice}
            onChange={(e) => onChange({ costPrice: e.target.value })}
            placeholder="Optional"
          />
          {costMissing ? (
            <p className="pe-warn">Valuation / margin unavailable until cost is set.</p>
          ) : (
            <p className="pe-hint">Per inventory unit (e.g. per sheet).</p>
          )}
        </div>
        <div className="pe-field">
          <label className="pe-label">Costing</label>
          <div className="pe-static">Manual</div>
        </div>
        <div className="pe-field">
          <label className="pe-label">Reorder Level</label>
          <input
            className="pe-input"
            type="number"
            min={0}
            value={form.reorderLevel}
            onChange={(e) => onChange({ reorderLevel: e.target.value })}
          />
        </div>
        {showInitialStock && (
          <div className="pe-field">
            <label className="pe-label">Opening Stock</label>
            <input
              className="pe-input"
              type="number"
              min={0}
              value={form.initialStock}
              onChange={(e) => onChange({ initialStock: e.target.value })}
            />
          </div>
        )}
      </div>
    </PeSection>
  );
}

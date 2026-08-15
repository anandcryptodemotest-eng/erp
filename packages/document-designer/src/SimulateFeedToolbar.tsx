"use client";

import "./document-designer.css";
import type { SimulateFeed } from "./types";

export type SimulateInvoiceOption = { id: string; number: string };

export function SimulateFeedToolbar({
  feed,
  invoices,
  onChange,
}: {
  feed: SimulateFeed;
  invoices: SimulateInvoiceOption[];
  onChange: (feed: SimulateFeed) => void;
}) {
  return (
    <div className="erp-doc-designer__simulate">
      <span className="erp-doc-designer__simulate-label">Simulate</span>
      <label className="erp-doc-designer__simulate-opt">
        <input
          type="radio"
          name="erp-doc-feed"
          checked={feed.kind === "sample"}
          onChange={() => onChange({ kind: "sample" })}
        />
        Sample payload
      </label>
      <label className="erp-doc-designer__simulate-opt">
        <input
          type="radio"
          name="erp-doc-feed"
          checked={feed.kind === "invoice"}
          onChange={() =>
            onChange({
              kind: "invoice",
              invoiceId: feed.kind === "invoice" ? feed.invoiceId : invoices[0]?.id ?? "",
            })
          }
        />
        Live document
      </label>
      {feed.kind === "invoice" && (
        <select
          value={feed.invoiceId}
          onChange={(e) => onChange({ kind: "invoice", invoiceId: e.target.value })}
        >
          {invoices.length === 0 && <option value="">No invoices</option>}
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.number}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

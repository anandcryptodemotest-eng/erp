"use client";

import type { DocumentBindingSchema } from "@erp/documents";
import { listFormatters } from "@erp/documents";

export function BindingPicker({
  schema,
  value,
  formatter,
  readOnly,
  onSelect,
  onFormatterChange,
}: {
  schema: DocumentBindingSchema;
  value?: string;
  formatter?: string;
  readOnly?: boolean;
  onSelect: (path: string, suggestedFormatter?: string) => void;
  onFormatterChange: (formatter: string) => void;
}) {
  const formatters = listFormatters();

  return (
    <div>
      <div className="erp-doc-designer__field">
        <span>Bound field</span>
        <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid #e7e5e4", borderRadius: 4, padding: 4 }}>
          {schema.groups.map((g) => (
            <details key={g.label} className="erp-doc-designer__binding-group" open>
              <summary>{g.label}</summary>
              {g.fields.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  disabled={readOnly}
                  className={`erp-doc-designer__binding-leaf${value === f.path ? " erp-doc-designer__binding-leaf--active" : ""}`}
                  onClick={() => onSelect(f.path, f.formatter)}
                >
                  {f.label}
                  <span style={{ color: "#a8a29e", marginLeft: 6 }}>{f.path}</span>
                </button>
              ))}
            </details>
          ))}
        </div>
      </div>
      <div className="erp-doc-designer__field">
        <span>Path</span>
        <input type="text" readOnly value={value ?? ""} placeholder="Select from tree" />
      </div>
      <div className="erp-doc-designer__field">
        <span>Formatter</span>
        <select
          disabled={readOnly}
          value={formatter ?? ""}
          onChange={(e) => onFormatterChange(e.target.value)}
        >
          <option value="">None</option>
          {formatters.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

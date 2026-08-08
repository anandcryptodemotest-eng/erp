"use client";

import type { ReactNode } from "react";
import type { DocumentBindingSchema, PlacedItem } from "@erp/documents";
import { BindingPicker } from "./BindingPicker";
import { LogoImageControls } from "./LogoImageControls";
import type { DesignerCommand } from "./types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="erp-doc-designer__section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function PropertyPanel({
  item,
  schema,
  readOnly,
  dispatch,
  onDelete,
  developerJson,
  onUploadImage,
}: {
  item: PlacedItem | undefined;
  schema: DocumentBindingSchema;
  readOnly: boolean;
  dispatch: (cmd: DesignerCommand) => void;
  onDelete: () => void;
  developerJson: ReactNode;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  if (!item) {
    return (
      <div>
        <p style={{ color: "#78716c", fontSize: 12 }}>Select an element on the canvas or outline.</p>
        {developerJson}
      </div>
    );
  }

  const patch = (p: Partial<PlacedItem>) => {
    if (readOnly) return;
    dispatch({ type: "UpdateProperties", id: item.id, patch: p });
  };

  const columns =
    (item.properties?.columns as { key: string; label: string; width?: number; formatter?: string }[]) ??
    [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#78716c" }}>{item.id}</div>
          <div style={{ fontSize: 10, textTransform: "uppercase", color: "#047857" }}>{item.type}</div>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="erp-doc-designer__palette-btn erp-doc-designer__palette-btn--danger"
            title="Delete selected (Delete / Backspace)"
            onClick={onDelete}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h10z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Delete
          </button>
        )}
      </div>

      <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0 }}>
        <Section title="General">
          <label className="erp-doc-designer__field">
            Name
            <input
              value={item.name ?? ""}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          {item.type === "Text" && (
            <label className="erp-doc-designer__field">
              Text
              <textarea
                rows={2}
                value={String(item.properties?.text ?? "")}
                onChange={(e) => patch({ properties: { text: e.target.value } })}
              />
            </label>
          )}
        </Section>

        {(item.type === "Logo" || item.type === "Image") && (
          <LogoImageControls
            item={item}
            readOnly={readOnly}
            onUploadImage={onUploadImage}
            onPatch={patch}
          />
        )}

        {(item.type === "Field" || item.type === "Logo" || item.type === "Table" || item.type === "Image") && (
          <Section title="Binding">
            {item.type === "Logo" && (
              <p style={{ fontSize: 10, color: "#78716c", marginBottom: 6 }}>
                Runtime invoices use this path (usually Seller → Logo URL). Template upload above is
                the fallback when the payload has no logo.
              </p>
            )}
            <BindingPicker
              schema={schema}
              value={item.binding?.path}
              formatter={item.binding?.formatter}
              readOnly={readOnly}
              onSelect={(path, suggested) =>
                patch({
                  binding: {
                    path,
                    formatter: suggested ?? item.binding?.formatter,
                    fallback: item.binding?.fallback ?? "",
                  },
                })
              }
              onFormatterChange={(formatter) =>
                patch({
                  binding: {
                    path: item.binding?.path ?? "",
                    formatter: formatter || undefined,
                    fallback: item.binding?.fallback ?? "",
                  },
                })
              }
            />
            <label className="erp-doc-designer__field">
              Fallback
              <input
                value={item.binding?.fallback ?? ""}
                onChange={(e) =>
                  patch({
                    binding: {
                      path: item.binding?.path ?? "",
                      formatter: item.binding?.formatter,
                      fallback: e.target.value,
                    },
                  })
                }
              />
            </label>
            {item.type === "Table" && columns.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>Columns</div>
                {columns.map((c, idx) => (
                  <div key={idx} className="erp-doc-designer__grid-2" style={{ marginBottom: 4 }}>
                    <input
                      value={c.key}
                      placeholder="key"
                      onChange={(e) => {
                        const next = columns.map((col, i) =>
                          i === idx ? { ...col, key: e.target.value } : col
                        );
                        patch({ properties: { columns: next } });
                      }}
                    />
                    <input
                      value={c.label}
                      placeholder="label"
                      onChange={(e) => {
                        const next = columns.map((col, i) =>
                          i === idx ? { ...col, label: e.target.value } : col
                        );
                        patch({ properties: { columns: next } });
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title="Appearance">
          <div className="erp-doc-designer__grid-2">
            <label className="erp-doc-designer__field">
              Font size
              <input
                type="number"
                value={item.style?.fontSize ?? ""}
                onChange={(e) =>
                  patch({
                    style: {
                      ...item.style,
                      fontSize: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="erp-doc-designer__field">
              Weight
              <input
                value={item.style?.fontWeight ?? ""}
                onChange={(e) => patch({ style: { ...item.style, fontWeight: e.target.value } })}
              />
            </label>
            <label className="erp-doc-designer__field">
              Color
              <input
                value={item.style?.color ?? ""}
                onChange={(e) => patch({ style: { ...item.style, color: e.target.value } })}
              />
            </label>
            <label className="erp-doc-designer__field">
              Align
              <select
                value={item.style?.textAlign ?? ""}
                onChange={(e) =>
                  patch({
                    style: {
                      ...item.style,
                      textAlign: (e.target.value || undefined) as "left" | "center" | "right" | undefined,
                    },
                  })
                }
              >
                <option value="">Default</option>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
        </Section>

        <Section title="Position">
          <div className="erp-doc-designer__grid-2">
            {(["x", "y", "width", "height"] as const).map((key) => (
              <label key={key} className="erp-doc-designer__field">
                {key}
                <input
                  type="number"
                  value={
                    key === "height"
                      ? (item.placement.height ?? 0)
                      : item.placement[key]
                  }
                  onChange={(e) =>
                    patch({
                      placement: {
                        ...item.placement,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </Section>

        <Section title="Advanced">
          <div className="erp-doc-designer__grid-2">
            <label className="erp-doc-designer__field">
              Locked
              <input
                type="checkbox"
                checked={Boolean(item.locked)}
                onChange={(e) => patch({ locked: e.target.checked })}
              />
            </label>
            <label className="erp-doc-designer__field">
              Visible
              <input
                type="checkbox"
                checked={item.visible !== false}
                onChange={(e) => patch({ visible: e.target.checked })}
              />
            </label>
            <label className="erp-doc-designer__field">
              zIndex
              <input
                type="number"
                value={item.zIndex ?? 0}
                onChange={(e) => patch({ zIndex: Number(e.target.value) })}
              />
            </label>
            <label className="erp-doc-designer__field">
              Opacity
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={item.opacity ?? 1}
                onChange={(e) => patch({ opacity: Number(e.target.value) })}
              />
            </label>
            <label className="erp-doc-designer__field">
              Rotation
              <input
                type="number"
                value={item.rotation ?? 0}
                onChange={(e) => patch({ rotation: Number(e.target.value) })}
              />
            </label>
          </div>
        </Section>
      </fieldset>

        <Section title="Developer">
        <details>
          <summary style={{ cursor: "pointer", fontSize: 11, marginBottom: 8 }}>JSON</summary>
          {developerJson}
        </details>
      </Section>
    </div>
  );
}

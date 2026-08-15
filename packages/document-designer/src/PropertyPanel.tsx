"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DocumentBindingSchema, DocumentPage, PlacedItem, StudioLevel } from "@erp/documents";
import {
  SAMPLE_DOCUMENT_PAYLOAD,
  formatValue,
  getByPath,
  printWidgetById,
} from "@erp/documents";
import { BindingPicker } from "./BindingPicker";
import { LogoImageControls } from "./LogoImageControls";
import { alignPlacement, spacingFromPadding, spacingPadding, type AlignPreset, type SpacingPreset } from "./layout";
import type { DesignerCommand } from "./types";

type PropTab = "properties" | "data" | "style";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="erp-doc-designer__section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function PillRow({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="erp-doc-studio__pills">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={
            value === o.id
              ? "erp-doc-studio__pill erp-doc-studio__pill--active"
              : "erp-doc-studio__pill"
          }
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PropertyPanel({
  item,
  schema,
  page,
  level,
  readOnly,
  dispatch,
  onDelete,
  developerJson,
  onUploadImage,
}: {
  item: PlacedItem | undefined;
  schema: DocumentBindingSchema;
  page: DocumentPage;
  level: StudioLevel;
  readOnly: boolean;
  dispatch: (cmd: DesignerCommand) => void;
  onDelete: () => void;
  developerJson?: ReactNode;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const [propTab, setPropTab] = useState<PropTab | null>(null);
  const [sizeCustom, setSizeCustom] = useState(level !== "business");
  const power = level === "power" || level === "developer";
  const developer = level === "developer";

  useEffect(() => {
    setPropTab(null);
  }, [item?.id]);

  if (!item) {
    return (
      <div>
        <p style={{ color: "#78716c", fontSize: 12 }}>Select an element on the page.</p>
        {developer ? developerJson : null}
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

  const bindable =
    item.type === "Field" || item.type === "Logo" || item.type === "Table" || item.type === "Image";
  const sample =
    item.binding?.path
      ? formatValue(
          getByPath(SAMPLE_DOCUMENT_PAYLOAD, item.binding.path),
          item.binding.formatter,
          item.binding.fallback ?? ""
        )
      : "";
  const align = (item.placement.align ?? item.style?.textAlign ?? "left") as AlignPreset;
  const spacing = spacingFromPadding(item.style?.padding) ?? "medium";
  const activeTab: PropTab = propTab ?? (bindable ? "data" : "properties");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name || item.type}</div>
          <div style={{ fontSize: 10, textTransform: "uppercase", color: "#047857" }}>{item.type}</div>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="erp-doc-designer__palette-btn erp-doc-designer__palette-btn--danger"
            title="Delete selected (Delete / Backspace)"
            onClick={onDelete}
          >
            Delete
          </button>
        )}
      </div>

      <div className="erp-doc-studio__pills" style={{ marginBottom: 12 }}>
        {(["properties", "data", "style"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={
              activeTab === t
                ? "erp-doc-studio__pill erp-doc-studio__pill--active"
                : "erp-doc-studio__pill"
            }
            onClick={() => setPropTab(t)}
          >
            {t === "properties" ? "Properties" : t === "data" ? "Data" : "Style"}
          </button>
        ))}
      </div>

      <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0 }}>
        {activeTab === "properties" && (
          <>
            <Section title="Properties">
              <label className="erp-doc-designer__field">
                Name
                <input
                  value={item.name ?? ""}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>
              {item.type === "Text" && (
                <label className="erp-doc-designer__field">
                  Content
                  <textarea
                    rows={2}
                    value={String(item.properties?.text ?? "")}
                    onChange={(e) => patch({ properties: { text: e.target.value } })}
                  />
                </label>
              )}
            </Section>

            <Section title="Layout">
              <p className="erp-doc-studio__field-caption">Position</p>
              <PillRow
                options={[
                  { id: "left", label: "Left" },
                  { id: "center", label: "Center" },
                  { id: "right", label: "Right" },
                ]}
                value={align}
                onChange={(id) => {
                  const next = alignPlacement(item, page, id as AlignPreset);
                  patch({ placement: next.placement, style: next.style });
                }}
              />
              <p className="erp-doc-studio__field-caption">Size</p>
              <PillRow
                options={[
                  { id: "auto", label: "Auto" },
                  { id: "custom", label: "Custom" },
                ]}
                value={sizeCustom ? "custom" : "auto"}
                onChange={(id) => setSizeCustom(id === "custom")}
              />
              {sizeCustom && (
                <div className="erp-doc-designer__grid-2">
                  <label className="erp-doc-designer__field">
                    Width
                    <input
                      type="number"
                      value={item.placement.width}
                      onChange={(e) =>
                        patch({
                          placement: { ...item.placement, width: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="erp-doc-designer__field">
                    Height
                    <input
                      type="number"
                      value={item.placement.height ?? 0}
                      onChange={(e) =>
                        patch({
                          placement: { ...item.placement, height: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                </div>
              )}
              <p className="erp-doc-studio__field-caption">Spacing</p>
              <PillRow
                options={[
                  { id: "small", label: "Small" },
                  { id: "medium", label: "Medium" },
                  { id: "large", label: "Large" },
                ]}
                value={spacing}
                onChange={(id) =>
                  patch({ style: { ...item.style, padding: spacingPadding(id as SpacingPreset) } })
                }
              />
              <details open={power}>
                <summary className="erp-doc-studio__advanced">Advanced</summary>
                <div className="erp-doc-designer__grid-2">
                  {(["x", "y", "width", "height"] as const).map((key) => (
                    <label key={key} className="erp-doc-designer__field">
                      {key}
                      <input
                        type="number"
                        value={key === "height" ? (item.placement.height ?? 0) : item.placement[key]}
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
              </details>
            </Section>
          </>
        )}

        {activeTab === "data" && (
          <>
            <Section title="Content">
              <p style={{ fontWeight: 600, margin: 0 }}>{item.name || item.type}</p>
            </Section>
            {bindable && (
              <Section title="Data">
                <p className="erp-doc-studio__field-caption">Path</p>
                <code>{item.binding?.path || "—"}</code>
                {item.binding?.path ? (
                  <>
                    <p className="erp-doc-studio__field-caption">Sample</p>
                    <p style={{ fontWeight: 600, margin: "4px 0 8px" }}>{sample || "—"}</p>
                  </>
                ) : null}
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
            {(item.type === "Logo" || item.type === "Image") && (
              <LogoImageControls
                item={item}
                readOnly={readOnly}
                onUploadImage={onUploadImage}
                onPatch={patch}
              />
            )}
            {item.type === "Widget" && (
              <Section title="Composition">
                <p style={{ fontSize: 11, marginBottom: 6 }}>
                  <code>{item.widgetId ?? "—"}</code>
                </p>
                <p style={{ fontSize: 10, color: "#78716c", marginBottom: 6 }}>
                  Catalog-owned. Slots bind at preview/generate.
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
                  {(printWidgetById(item.widgetId)?.slots ?? []).map((s) => (
                    <li key={s.path}>
                      {s.label}{" "}
                      <code style={{ fontSize: 10, color: "#78716c" }}>{s.path}</code>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {!bindable && item.type !== "Widget" && item.type !== "Logo" && item.type !== "Image" && (
              <p style={{ fontSize: 12, color: "#78716c" }}>This block has no payload binding.</p>
            )}
          </>
        )}

        {activeTab === "style" && item.type !== "Widget" && (
          <Section title="Style">
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
                Alignment
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
              <label className="erp-doc-designer__field">
                Border
                <input
                  value={item.style?.border ?? ""}
                  onChange={(e) => patch({ style: { ...item.style, border: e.target.value } })}
                />
              </label>
            </div>
          </Section>
        )}

        {power && (
          <Section title="Visibility">
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
            </div>
          </Section>
        )}

        {developer && (
          <Section title="Technical">
            <div className="erp-doc-designer__grid-2">
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
            {developerJson}
          </Section>
        )}
      </fieldset>
    </div>
  );
}

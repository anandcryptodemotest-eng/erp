"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { DocumentBindingSchema, DocumentDefinition, StudioLevel } from "@erp/documents";
import {
  bindingSchemaForDocumentType,
  findItemById,
  flattenItems,
} from "@erp/documents";
import {
  defaultAreaContainer,
  defaultItem,
  defaultPageNumberItem,
  invoiceStarterItems,
} from "./defaultItem";
import { PageCanvas } from "./PageCanvas";
import { PropertyPanel } from "./PropertyPanel";
import { canvasReducer, createInitialState, getPrimarySelected } from "./reducer";
import type { DesignerCommand, GridSize, PaletteTile } from "./types";
import { PALETTE_GROUPS, QR_TILE } from "./types";
import "./document-designer.css";

export type DocumentDesignerProps = {
  /** Initial / remount definition. Remount the designer (React `key`) when loading a different document. */
  definition: DocumentDefinition;
  readOnly?: boolean;
  bindingSchema?: DocumentBindingSchema;
  /** Working experience — chrome only. Default business. */
  level?: StudioLevel;
  /** Optional print-look HTML (host-provided, read-only preview). */
  previewHtml?: string;
  /** Host upload for Logo/Image — returns a public URL. */
  onUploadImage?: (file: File) => Promise<string>;
  onChange?: (definition: DocumentDefinition) => void;
  className?: string;
};

export function DocumentDesigner({
  definition,
  readOnly = false,
  bindingSchema,
  level = "business",
  onUploadImage,
  onChange,
  className,
}: DocumentDesignerProps) {
  const [state, rawDispatch] = useReducer(canvasReducer, definition, createInitialState);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(definition, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const skipNotify = useRef(true);
  const power = level === "power" || level === "developer";
  const developer = level === "developer";

  const dispatch = useCallback(
    (cmd: DesignerCommand) => {
      if (readOnly && cmd.type !== "SetSelection" && cmd.type !== "SetGrid") return;
      rawDispatch(cmd);
    },
    [readOnly]
  );

  useEffect(() => {
    setJsonText(JSON.stringify(state.definition, null, 2));
    if (skipNotify.current) {
      skipNotify.current = false;
      return;
    }
    onChangeRef.current?.(state.definition);
  }, [state.definition]);

  const schema =
    bindingSchema ?? bindingSchemaForDocumentType(state.definition.documentType);

  const outline = useMemo(
    () => flattenItems(state.definition.items),
    [state.definition.items]
  );

  const selectedItem = getPrimarySelected(state);

  const deleteSelected = useCallback(() => {
    if (readOnly || state.selectedIds.size === 0) return;
    const ids = [...state.selectedIds].filter((id) => {
      const item = findItemById(state.definition.items, id);
      return item && !item.locked;
    });
    if (ids.length === 0) return;
    dispatch({ type: "DeleteItems", ids });
  }, [dispatch, readOnly, state.definition.items, state.selectedIds]);

  useEffect(() => {
    if (readOnly) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
        return;
      }
      if (state.selectedIds.size === 0) return;
      e.preventDefault();
      deleteSelected();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, readOnly, state.selectedIds.size]);

  const addTile = (tile: PaletteTile) => {
    const parent = selectedItem?.type === "Container" ? selectedItem.id : null;
    if (tile.action.kind === "item") {
      dispatch({ type: "CreateItems", items: [defaultItem(tile.action.type)], parentId: parent });
      return;
    }
    if (tile.action.kind === "qr") {
      dispatch({ type: "CreateItems", items: [defaultItem("QR")], parentId: parent });
      return;
    }
    if (tile.action.kind === "pageNumber") {
      dispatch({ type: "CreateItems", items: [defaultPageNumberItem()], parentId: parent });
      return;
    }
    dispatch({
      type: "CreateItems",
      items: [defaultAreaContainer(tile.action.area)],
      parentId: null,
    });
  };

  const addInvoiceStarter = () => {
    dispatch({ type: "CreateItems", items: invoiceStarterItems(), parentId: null });
  };

  const applyJson = () => {
    try {
      const next = JSON.parse(jsonText) as DocumentDefinition;
      dispatch({ type: "ReplaceDefinition", definition: next });
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  const developerJson = developer ? (
    <div>
      <p style={{ fontSize: 10, color: "#78716c", marginBottom: 6 }}>
        Raw DocumentDefinition.
      </p>
      <textarea
        style={{
          width: "100%",
          height: 160,
          fontFamily: "monospace",
          fontSize: 10,
          border: "1px solid #d6d3d1",
          borderRadius: 4,
          padding: 6,
        }}
        value={jsonText}
        disabled={readOnly}
        onChange={(e) => setJsonText(e.target.value)}
      />
      {jsonError && <p style={{ color: "#dc2626", fontSize: 11 }}>{jsonError}</p>}
      {!readOnly && (
        <button
          type="button"
          className="erp-doc-designer__palette-btn"
          style={{ marginTop: 6 }}
          onClick={applyJson}
        >
          Apply JSON
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className={`erp-doc-designer${className ? ` ${className}` : ""}`}>
      <aside className="erp-doc-designer__pane">
        <p className="erp-doc-studio__group-label" style={{ marginBottom: 8 }}>
          Components
        </p>
        {PALETTE_GROUPS.map((group) => (
          <div key={group.id} className="erp-doc-studio__group">
            <p className="erp-doc-studio__group-label">{group.label}</p>
            <div className="erp-doc-studio__tiles">
              {group.tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  disabled={readOnly}
                  className={
                    tile.span === "full"
                      ? "erp-doc-studio__tile erp-doc-studio__tile--full"
                      : "erp-doc-studio__tile"
                  }
                  onClick={() => addTile(tile)}
                >
                  {tile.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {power && (
          <div className="erp-doc-studio__group">
            <p className="erp-doc-studio__group-label">More</p>
            <div className="erp-doc-studio__tiles">
              <button
                type="button"
                disabled={readOnly}
                className="erp-doc-studio__tile erp-doc-studio__tile--full"
                onClick={() => addTile(QR_TILE)}
              >
                {QR_TILE.label}
              </button>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "#78716c",
                  cursor: "pointer",
                }}
              >
                Invoice starter
              </summary>
              <p style={{ fontSize: 10, color: "#78716c", margin: "6px 0" }}>
                Optional ERP composition pack. Not part of the generic catalog.
              </p>
              {!readOnly && (
                <button
                  type="button"
                  className="erp-doc-designer__palette-btn"
                  onClick={addInvoiceStarter}
                >
                  Insert invoice layout
                </button>
              )}
            </details>
          </div>
        )}

        {power ? (
          <>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#78716c",
                margin: "16px 0 8px",
              }}
            >
              Layers
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {outline.map((n) => {
                const row = findItemById(state.definition.items, n.id);
                const selected = state.selectedIds.has(n.id);
                return (
                  <li key={n.id} className="erp-doc-designer__outline-row">
                    <button
                      type="button"
                      className={`erp-doc-designer__outline-btn${
                        selected ? " erp-doc-designer__outline-btn--active" : ""
                      }`}
                      style={{ paddingLeft: 6 + n.depth * 12 }}
                      onClick={(e) =>
                        dispatch({
                          type: "SetSelection",
                          ids: [n.id],
                          mode: e.shiftKey ? "toggle" : "replace",
                        })
                      }
                    >
                      {row?.name ?? n.id}{" "}
                      <span style={{ color: "#a8a29e", fontSize: 10 }}>{n.type}</span>
                    </button>
                    {!readOnly && !row?.locked && (
                      <button
                        type="button"
                        className="erp-doc-designer__icon-btn erp-doc-designer__icon-btn--danger"
                        title="Delete"
                        aria-label={`Delete ${row?.name ?? n.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: "SetSelection", ids: [n.id] });
                          dispatch({ type: "DeleteItems", ids: [n.id] });
                        }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="erp-doc-studio__hint" style={{ paddingLeft: 0 }}>
            Select on the page. Layers are in Power mode.
          </p>
        )}
      </aside>

      <div className="erp-doc-designer__canvas-wrap">
        <div className="erp-doc-designer__toolbar">
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Grid
            <select
              value={state.gridSize}
              onChange={(e) =>
                dispatch({
                  type: "SetGrid",
                  gridSize: Number(e.target.value) as GridSize,
                })
              }
            >
              <option value={0}>Off</option>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
            </select>
          </label>
          <span style={{ color: "#78716c", fontSize: 11 }}>
            {state.selectedIds.size} selected
          </span>
          {!readOnly && state.selectedIds.size > 0 && (
            <button
              type="button"
              className="erp-doc-designer__palette-btn erp-doc-designer__palette-btn--danger"
              title="Delete selected (Delete / Backspace)"
              onClick={deleteSelected}
            >
              <TrashIcon /> Delete
            </button>
          )}
        </div>

        <PageCanvas state={state} readOnly={readOnly} dispatch={dispatch} />
        {state.definition.items.length === 0 && (
          <p className="erp-doc-studio__empty">
            Empty page. Add Text, Field, Image, or Table from Components — or open Data and place a bound path.
          </p>
        )}
        {state.definition.items.length === 0 && (
          <p className="erp-doc-studio__empty">
            Empty page. Add Text, Field, Image, or Table from Components — or open Data and place a bound path.
          </p>
        )}
      </div>

      <aside className="erp-doc-designer__pane erp-doc-designer__pane--right">
        <PropertyPanel
          item={selectedItem}
          schema={schema}
          page={state.definition.page}
          level={level}
          readOnly={readOnly}
          dispatch={dispatch}
          onDelete={deleteSelected}
          onUploadImage={onUploadImage}
          developerJson={developerJson}
        />
      </aside>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

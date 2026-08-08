"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { DocumentBindingSchema, DocumentDefinition, DocumentItemType } from "@erp/documents";
import {
  bindingSchemaForDocumentType,
  findItemById,
  flattenItems,
} from "@erp/documents";
import { defaultItem } from "./defaultItem";
import { PageCanvas } from "./PageCanvas";
import { PropertyPanel } from "./PropertyPanel";
import { canvasReducer, createInitialState, getPrimarySelected } from "./reducer";
import type { DesignerCommand, GridSize } from "./types";
import { PALETTE } from "./types";
import "./document-designer.css";

export type DocumentDesignerProps = {
  /** Initial / remount definition. Remount the designer (React `key`) when loading a different document. */
  definition: DocumentDefinition;
  readOnly?: boolean;
  bindingSchema?: DocumentBindingSchema;
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
  previewHtml,
  onUploadImage,
  onChange,
  className,
}: DocumentDesignerProps) {
  const [state, rawDispatch] = useReducer(
    canvasReducer,
    definition,
    createInitialState
  );
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(definition, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const skipNotify = useRef(true);

  const dispatch = useCallback(
    (cmd: DesignerCommand) => {
      if (readOnly && cmd.type !== "SetSelection" && cmd.type !== "SetGrid") return;
      rawDispatch(cmd);
    },
    [readOnly]
  );

  // Notify host when the document model changes (not on mount / selection-only).
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

  const addFromPalette = (type: DocumentItemType) => {
    const parent =
      selectedItem?.type === "Container" ? selectedItem.id : null;
    dispatch({
      type: "CreateItems",
      items: [defaultItem(type)],
      parentId: parent,
    });
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

  const developerJson = (
    <div>
      <p style={{ fontSize: 10, color: "#78716c", marginBottom: 6 }}>
        Raw DocumentDefinition — most users can ignore this.
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
  );

  return (
    <div className={`erp-doc-designer${className ? ` ${className}` : ""}`}>
      <aside className="erp-doc-designer__pane">
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#78716c", marginBottom: 8 }}>
          Outline
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

        {!readOnly && (
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
              Palette{" "}
              {selectedItem?.type === "Container"
                ? `→ ${selectedItem.name ?? selectedItem.id}`
                : "(page)"}
            </p>
            <div>
              {PALETTE.map((p) => (
                <button
                  key={p.type}
                  type="button"
                  className="erp-doc-designer__palette-btn"
                  onClick={() => addFromPalette(p.type)}
                >
                  + {p.label}
                </button>
              ))}
            </div>
          </>
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
            Layer: default · {state.selectedIds.size} selected
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
          {previewHtml != null && (
            <button
              type="button"
              className="erp-doc-designer__palette-btn"
              onClick={() => setShowPrintPreview((v) => !v)}
            >
              {showPrintPreview ? "Hide" : "Show"} print preview
            </button>
          )}
        </div>

        {!showPrintPreview ? (
          <PageCanvas state={state} readOnly={readOnly} dispatch={dispatch} />
        ) : (
          <iframe
            title="print-preview"
            className="erp-doc-designer__preview-frame"
            srcDoc={previewHtml}
            style={{ maxWidth: 640, margin: "0 auto", display: "block", minHeight: 900 }}
          />
        )}
      </div>

      <aside className="erp-doc-designer__pane erp-doc-designer__pane--right">
        <PropertyPanel
          item={selectedItem}
          schema={schema}
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

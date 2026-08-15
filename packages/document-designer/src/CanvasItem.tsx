"use client";

import { useCallback, useRef } from "react";
import type { PlacedItem } from "@erp/documents";
import { SAMPLE_DOCUMENT_PAYLOAD, formatValue, getByPath } from "@erp/documents";
import { snap } from "./snap";
import type { DesignerCommand, GridSize, ResizeHandle } from "./types";

const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function itemPreview(item: PlacedItem): string {
  if (item.type === "Text") return String(item.properties?.text ?? "Text");
  if (item.type === "Field") {
    const path = item.binding?.path;
    const sample = path
      ? formatValue(
          getByPath(SAMPLE_DOCUMENT_PAYLOAD, path),
          item.binding?.formatter,
          item.binding?.fallback ?? ""
        )
      : "";
    if (sample) return sample;
    if (item.name && item.name !== "Field") return item.name;
    return path ? `{${path}}` : "Field";
  }
  if (item.type === "Table") return item.name && item.name !== "Table" ? item.name : "Table";
  if (item.type === "Logo") {
    const src = typeof item.properties?.src === "string" ? item.properties.src : "";
    return src ? "" : "Logo";
  }
  if (item.type === "Image") {
    const src = typeof item.properties?.src === "string" ? item.properties.src : "";
    return src ? "" : "Image";
  }
  if (item.type === "QR") return "QR";
  if (item.type === "Widget") return item.name ?? item.widgetId ?? "Widget";
  if (item.type === "Line") return "";
  if (item.type === "Box") return "";
  if (item.type === "Container") return item.name ?? "Container";
  return item.type;
}

export function CanvasItemView({
  item,
  selectedIds,
  primaryId,
  gridSize,
  readOnly,
  offsetX,
  offsetY,
  dispatch,
  depth = 0,
}: {
  item: PlacedItem;
  selectedIds: Set<string>;
  primaryId?: string;
  gridSize: GridSize;
  readOnly: boolean;
  offsetX: number;
  offsetY: number;
  dispatch: (cmd: DesignerCommand) => void;
  depth?: number;
}) {
  const selected = primaryId === item.id;
  const multiSelected = selectedIds.has(item.id);

  const dragRef = useRef<{
    mode: "move" | "resize";
    handle?: ResizeHandle;
    startClientX: number;
    startClientY: number;
    lastDx: number;
    lastDy: number;
    ids: string[];
  } | null>(null);

  const onSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey) {
        dispatch({ type: "SetSelection", ids: [item.id], mode: "toggle" });
      } else {
        dispatch({ type: "SetSelection", ids: [item.id], mode: "replace" });
      }
    },
    [dispatch, item.id]
  );

  const beginMove = (e: React.PointerEvent) => {
    if (readOnly || item.locked) return;
    if ((e.target as HTMLElement).dataset.handle) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    let ids = [item.id];
    if (selectedIds.has(item.id) && selectedIds.size > 1) {
      ids = [...selectedIds];
    } else {
      dispatch({ type: "SetSelection", ids: [item.id] });
    }

    dragRef.current = {
      mode: "move",
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastDx: 0,
      lastDy: 0,
      ids,
    };
  };

  const beginResize = (e: React.PointerEvent, handle: ResizeHandle) => {
    if (readOnly || item.locked) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      mode: "resize",
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastDx: 0,
      lastDy: 0,
      ids: [item.id],
    };
    dispatch({ type: "SetSelection", ids: [item.id] });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const rawDx = e.clientX - d.startClientX;
    const rawDy = e.clientY - d.startClientY;
    const targetDx = snap(rawDx, gridSize);
    const targetDy = snap(rawDy, gridSize);
    const dx = targetDx - d.lastDx;
    const dy = targetDy - d.lastDy;
    if (dx === 0 && dy === 0) return;
    d.lastDx = targetDx;
    d.lastDy = targetDy;
    if (d.mode === "move") {
      dispatch({ type: "MoveItems", ids: d.ids, dx, dy });
    } else if (d.handle) {
      dispatch({ type: "ResizeItems", id: item.id, handle: d.handle, dx, dy });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  if (item.visible === false) return null;

  const left = offsetX + item.placement.x;
  const top = offsetY + item.placement.y;
  const width = item.placement.width;
  const height = item.placement.height ?? 16;
  const isSelected = selected || multiSelected;

  return (
    <div
      className={`erp-doc-designer__item${isSelected ? " erp-doc-designer__item--selected" : ""}${
        item.type === "Container" ? " erp-doc-designer__item--container" : ""
      }${item.type === "Widget" ? " erp-doc-designer__item--widget" : ""}`}
      data-id={item.id}
      style={{
        left,
        top,
        width,
        height,
        zIndex: (item.zIndex ?? 0) + depth,
        opacity: item.opacity ?? 1,
        fontSize: item.style?.fontSize ?? 11,
        fontWeight: item.style?.fontWeight,
        color: item.style?.color,
        textAlign: item.style?.textAlign,
        background:
          item.type === "Box"
            ? item.style?.background ?? "rgba(0,0,0,0.02)"
            : item.type === "Line"
              ? "#444"
              : undefined,
        border: item.style?.border,
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
      }}
      onClick={onSelect}
      onPointerDown={beginMove}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {isSelected && (
        <span className="erp-doc-designer__item-label">{item.name ?? item.id}</span>
      )}
      {item.type === "Widget" ? (
        <div className="erp-doc-designer__widget-chrome">
          <div>{item.name ?? "Widget"}</div>
          <div style={{ color: "#a8a29e", fontSize: 9 }}>{item.widgetId}</div>
        </div>
      ) : (item.type === "Logo" || item.type === "Image") &&
      typeof item.properties?.src === "string" &&
      item.properties.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.properties.src}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
        />
      ) : item.type === "Table" ? (
        <CanvasTablePreview item={item} />
      ) : item.type !== "Container" ? (
        <div
          style={{
            padding: "0 2px",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            lineHeight: 1.15,
            height: "100%",
          }}
        >
          {itemPreview(item)}
        </div>
      ) : null}
      {item.type === "Container" && (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {(item.children ?? []).map((child) => (
            <CanvasItemView
              key={child.id}
              item={child}
              selectedIds={selectedIds}
              primaryId={primaryId}
              gridSize={gridSize}
              readOnly={readOnly}
              offsetX={0}
              offsetY={0}
              dispatch={dispatch}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
      {selected && !readOnly && !item.locked && (
        <>
          {HANDLES.map((h) => (
            <div
              key={h}
              data-handle={h}
              className={`erp-doc-designer__handle erp-doc-designer__handle--${h}`}
              onPointerDown={(e) => beginResize(e, h)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          ))}
          <div
            data-handle="rotate"
            className="erp-doc-designer__handle erp-doc-designer__handle--rotate"
            title="Rotation (coming soon)"
          />
        </>
      )}
    </div>
  );
}

function CanvasTablePreview({ item }: { item: PlacedItem }) {
  const columns =
    (item.properties?.columns as { key: string; label: string; width?: number; formatter?: string }[]) ?? [];
  const path = item.binding?.path;
  const rows = (
    path ? (getByPath(SAMPLE_DOCUMENT_PAYLOAD, path) as Record<string, unknown>[] | undefined) : undefined
  ) ?? [];
  if (columns.length === 0) {
    return <div style={{ padding: "0 2px", fontSize: 10, color: "#78716c" }}>{item.name ?? "Table"}</div>;
  }
  return (
    <table className="erp-doc-designer__canvas-table">
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              style={{
                width: c.width,
                textAlign: c.formatter === "currency" ? "right" : "left",
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(Array.isArray(rows) ? rows : []).map((row, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.key} style={{ textAlign: c.formatter === "currency" ? "right" : "left" }}>
                {formatValue(row[c.key], c.formatter)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

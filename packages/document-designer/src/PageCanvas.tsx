"use client";

import { useCallback, useRef, useState } from "react";
import type { PlacedItem } from "@erp/documents";
import { CanvasItemView } from "./CanvasItem";
import { pageSize } from "./snap";
import type { CanvasState, DesignerCommand } from "./types";

type Marquee = { x0: number; y0: number; x1: number; y1: number } | null;

function collectHits(
  items: PlacedItem[],
  rect: { left: number; top: number; right: number; bottom: number },
  ox: number,
  oy: number,
  out: string[]
) {
  for (const item of items) {
    const left = ox + item.placement.x;
    const top = oy + item.placement.y;
    const right = left + item.placement.width;
    const bottom = top + (item.placement.height ?? 16);
    const intersects =
      left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top;
    if (intersects) out.push(item.id);
    if (item.children?.length) {
      collectHits(item.children, rect, left, top, out);
    }
  }
}

export function PageCanvas({
  state,
  readOnly,
  dispatch,
}: {
  state: CanvasState;
  readOnly: boolean;
  dispatch: (cmd: DesignerCommand) => void;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<Marquee>(null);
  const marqueeOrigin = useRef<{ x: number; y: number } | null>(null);
  const marqueeShift = useRef(false);

  const { width, height } = pageSize(state.definition.page.size);
  const margin = state.definition.page.margin ?? {
    top: 40,
    right: 40,
    bottom: 40,
    left: 40,
  };

  const primaryId = state.selectedIds.values().next().value as string | undefined;

  const onPagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly) return;
      if ((e.target as HTMLElement).closest("[data-id]")) return;
      const page = pageRef.current;
      if (!page) return;
      const bounds = page.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      marqueeOrigin.current = { x, y };
      marqueeShift.current = e.shiftKey;
      setMarquee({ x0: x, y0: y, x1: x, y1: y });
      if (!e.shiftKey) {
        dispatch({ type: "SetSelection", ids: [] });
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [dispatch, readOnly]
  );

  const onPagePointerMove = useCallback((e: React.PointerEvent) => {
    if (!marqueeOrigin.current || !pageRef.current) return;
    const bounds = pageRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    setMarquee({
      x0: marqueeOrigin.current.x,
      y0: marqueeOrigin.current.y,
      x1: x,
      y1: y,
    });
  }, []);

  const onPagePointerUp = useCallback(() => {
    if (marquee && marqueeOrigin.current) {
      const left = Math.min(marquee.x0, marquee.x1);
      const right = Math.max(marquee.x0, marquee.x1);
      const top = Math.min(marquee.y0, marquee.y1);
      const bottom = Math.max(marquee.y0, marquee.y1);
      if (right - left > 4 || bottom - top > 4) {
        const hits: string[] = [];
        collectHits(
          state.definition.items,
          { left, top, right, bottom },
          margin.left,
          margin.top,
          hits
        );
        dispatch({
          type: "SetSelection",
          ids: hits,
          mode: marqueeShift.current ? "add" : "replace",
        });
      }
    }
    marqueeOrigin.current = null;
    setMarquee(null);
  }, [dispatch, margin.left, margin.top, marquee, state.definition.items]);

  return (
    <div
      ref={pageRef}
      className="erp-doc-designer__page"
      style={{ width, height }}
      onPointerDown={onPagePointerDown}
      onPointerMove={onPagePointerMove}
      onPointerUp={onPagePointerUp}
      onPointerCancel={onPagePointerUp}
    >
      <div className="erp-doc-designer__layer" data-layer="default">
        {state.definition.items.map((item) => (
          <CanvasItemView
            key={item.id}
            item={item}
            selectedIds={state.selectedIds}
            primaryId={primaryId}
            gridSize={state.gridSize}
            readOnly={readOnly}
            offsetX={margin.left}
            offsetY={margin.top}
            dispatch={dispatch}
          />
        ))}
      </div>
      {marquee && (
        <div
          className="erp-doc-designer__marquee"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
    </div>
  );
}

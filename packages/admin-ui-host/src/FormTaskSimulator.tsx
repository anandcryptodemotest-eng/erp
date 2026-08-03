"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { FormDefinition } from "@erp/workflow";
import type {
  AttachmentItem,
  CommentItem,
  LineItemLike,
  ScreenDefinition,
} from "@erp/ui-runtime";
import { TaskScreenRuntime } from "./TaskScreenRuntime";
import { bootstrapAdminRuntime } from "./bootstrap";
import { ADMIN_RUNTIME_VERSION } from "./widgetCatalog";
import {
  SAMPLE_COMMENTS,
  SAMPLE_INVENTORY,
  SAMPLE_ITEMS,
  SAMPLE_LOOKUPS,
  SAMPLE_ORDER,
  SAMPLE_TIMELINE,
} from "./simulator/sample-context";

export type SimulatorMode = "draft" | "published" | "readonly" | "approval" | "completed";

export type FormTaskSimulatorProps = {
  screen: FormDefinition;
  viewport?: "desktop" | "mobile";
  mode?: SimulatorMode;
  /** Apply recommended FormFields + ActionButtons when layout is empty */
  onApplyRecommendedLayout?: () => void;
};

function modePermissions(mode: SimulatorMode): { canComplete: boolean; canEdit: boolean } {
  switch (mode) {
    case "readonly":
    case "published":
    case "completed":
      return { canComplete: false, canEdit: false };
    case "approval":
      return { canComplete: true, canEdit: false };
    case "draft":
    default:
      return { canComplete: true, canEdit: true };
  }
}

/**
 * Interactive task-UI simulation for Form Designer.
 * Uses the same TaskScreenRuntime + widgets as production OMS.
 */
export function FormTaskSimulator(props: FormTaskSimulatorProps): ReactNode {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [items, setItems] = useState<LineItemLike[]>(SAMPLE_ITEMS);
  const [comments, setComments] = useState<CommentItem[]>(SAMPLE_COMMENTS);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">(props.viewport ?? "desktop");
  const [mode, setMode] = useState<SimulatorMode>(props.mode ?? "draft");

  bootstrapAdminRuntime();

  const screen = useMemo(() => props.screen as ScreenDefinition, [props.screen]);
  const hasLayout = (screen.layout?.length ?? 0) > 0;
  const perms = modePermissions(mode);

  function setFieldValue(key: string, value: string, itemId?: string) {
    if (!perms.canEdit) return;
    const bagKey = itemId ? `${itemId}:${key}` : key;
    setFieldValues((prev) => ({ ...prev, [bagKey]: value }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Task review
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
            Simulation only — same widgets as the live task screen. Does not write to the database.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--line)] p-0.5 text-[10px]">
          {(["desktop", "mobile"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewport(v)}
              className={`rounded-md px-2 py-1 capitalize ${
                viewport === v ? "bg-[var(--ink)] text-white" : "text-[var(--ink-soft)] hover:bg-[var(--mist)]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-[var(--line)] bg-[var(--mist)]/50 px-3 py-2 text-[10px] text-[var(--ink-soft)] sm:grid-cols-4">
        <div>
          <dt className="font-semibold uppercase tracking-wide">Runtime</dt>
          <dd className="font-mono text-[var(--ink)]">v{ADMIN_RUNTIME_VERSION}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Theme</dt>
          <dd className="text-[var(--ink)]">{screen.themeId ?? screen.theme ?? "oms-default"}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Viewport</dt>
          <dd className="capitalize text-[var(--ink)]">{viewport}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Mode</dt>
          <dd>
            <select
              className="rounded border border-[var(--line)] bg-[var(--surface)] px-1 py-0.5 text-[10px] text-[var(--ink)]"
              value={mode}
              onChange={(e) => setMode(e.target.value as SimulatorMode)}
            >
              {(["draft", "published", "readonly", "approval", "completed"] as const).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </dd>
        </div>
      </dl>

      {!hasLayout ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-raised)] p-4 space-y-3">
          <p className="text-sm font-medium text-[var(--ink)]">No layout configured.</p>
          <p className="text-xs text-[var(--ink-soft)]">Recommended for a basic task screen:</p>
          <ul className="space-y-1 text-xs text-[var(--ink)]">
            <li>✓ Form Fields</li>
            <li>✓ Action Buttons</li>
          </ul>
          {props.onApplyRecommendedLayout && (
            <button
              type="button"
              className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-[var(--ink-inverse)]"
              onClick={props.onApplyRecommendedLayout}
            >
              Apply
            </button>
          )}
        </div>
      ) : (
        <div
          className={`mx-auto transition-[max-width] ${
            viewport === "mobile" ? "max-w-[390px]" : "max-w-none"
          }`}
        >
          <TaskScreenRuntime
            screen={screen}
            order={SAMPLE_ORDER}
            customer={{ id: "cust-sim", name: "Acme Builders (sample)" }}
            items={items}
            taskAction={mode === "approval" ? "APPROVE" : "SIMULATE"}
            canComplete={perms.canComplete}
            fieldValues={fieldValues}
            setFieldValue={setFieldValue}
            lookups={SAMPLE_LOOKUPS}
            inventory={SAMPLE_INVENTORY}
            timeline={SAMPLE_TIMELINE}
            comments={comments}
            attachments={attachments}
            skipBootstrap
            hostApis={{
              uploadFile: async (file) => {
                const att: AttachmentItem = {
                  id: `att-${Date.now()}`,
                  name: file.name,
                  mimeType: file.type,
                  size: file.size,
                };
                setAttachments((prev) => [...prev, att]);
                return att;
              },
              addComment: (body) => {
                setComments((prev) => [
                  ...prev,
                  {
                    id: `c-${Date.now()}`,
                    body,
                    author: "Designer",
                    at: new Date().toISOString(),
                  },
                ]);
              },
            }}
            lineEditor={
              perms.canEdit
                ? {
                    canAdd: true,
                    canRemove: true,
                    canEditPrice: true,
                    searchProducts: async (q) => {
                      const catalog = [
                        { id: "prod-oak", name: "Oak beam", sku: "OAK-01", sellPrice: 200 },
                        { id: "prod-nail", name: "Nail box 2kg", sku: "NL-2", sellPrice: 45 },
                        { id: "prod-teak", name: "Teak plank 8ft", sku: "TK-8", sellPrice: 120 },
                      ];
                      const qq = q.trim().toLowerCase();
                      return catalog.filter(
                        (p) =>
                          !qq ||
                          p.name.toLowerCase().includes(qq) ||
                          (p.sku ?? "").toLowerCase().includes(qq)
                      );
                    },
                    addProduct: (p) => {
                      setItems((prev) => [
                        ...prev,
                        {
                          id: `line-${Date.now()}`,
                          productId: p.id,
                          productName: p.name,
                          quantity: 1,
                          unitPrice: p.sellPrice ?? 0,
                          availableQty: 20,
                        },
                      ]);
                    },
                    removeLine: (lineId) => {
                      setItems((prev) => prev.filter((l) => l.id !== lineId));
                    },
                  }
                : undefined
            }
            onComplete={(payload) => setLastPayload(payload)}
          />
        </div>
      )}

      {lastPayload && (
        <details className="rounded-lg border border-[var(--line)] bg-[var(--mist)] px-3 py-2 text-[11px] text-[var(--ink-soft)]">
          <summary className="cursor-pointer font-medium text-[var(--ink-soft)]">
            Last complete payload (simulation)
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all">
            {JSON.stringify(lastPayload, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

"use client";

/**
 * OMS Screen Controller (ADR 0005 / ADR 0009 / ADR 0010 Admin Host).
 * Resolves ScreenDefinition → UIContext → UI Runtime.
 * Widgets must not load entity data or call business APIs.
 */

import type { ReactNode } from "react";
import type {
  ScreenDefinition,
  LineItemLike,
  LineEditorApi,
  PickerOption,
  InventoryLineView,
  WorkflowTimelineEvent,
  CommentItem,
  AttachmentItem,
  HostApis,
  TaskDocumentMeta,
} from "@erp/ui-runtime";
import { TaskScreenRuntime, normalizeScreenDefinition } from "./TaskScreenRuntime";

export type StepUiLike = {
  formId?: string;
  title?: string;
  description?: string;
  fields?: ScreenDefinition["fields"];
  theme?: ScreenDefinition["theme"];
  themeId?: string;
  confirmLabel?: string;
  layout?: ScreenDefinition["layout"];
};

type LayoutWidget = NonNullable<ScreenDefinition["layout"]>[number];

/** Commercial widgets that should stay above remarks / delivery date. */
const COMMERCIAL_BEFORE_FORMFIELDS = new Set([
  "StatusBanner",
  "ProductList",
  "CatalogSearch",
  "PriceSummary",
  "InventoryView",
]);

/**
 * Host chrome for pinned / outdated starter layouts (BL-036):
 * - Remarks + delivery date (FormFields order scope) below line items
 * - CustomerInfo + Notes + Attachments on every human step (Phase 2 ids; Comments/FileUpload aliases OK)
 */
export function applyHostLayoutChrome(
  act: { action: string; label: string },
  layout: LayoutWidget[] | undefined
): LayoutWidget[] | undefined {
  if (!layout?.length) return layout;

  let next = [...layout];

  if (
    act.action === "dispatch" &&
    next.some((w) => w.widget === "FormFields") &&
    !next.some((w) => w.widget === "DispatchFulfillment")
  ) {
    next = next.map((w) =>
      w.widget === "FormFields" ? { widget: "DispatchFulfillment", props: w.props ?? {} } : w
    );
  }

  // Sales review (and any layout with ProductList + FormFields): FormFields after commercial block.
  const formFieldsIdx = next.findIndex((w) => w.widget === "FormFields");
  const productIdx = next.findIndex((w) => w.widget === "ProductList");
  if (formFieldsIdx >= 0 && productIdx >= 0 && formFieldsIdx < productIdx) {
    const [ff] = next.splice(formFieldsIdx, 1);
    let insertAt = 0;
    for (let i = 0; i < next.length; i++) {
      if (COMMERCIAL_BEFORE_FORMFIELDS.has(next[i].widget)) insertAt = i + 1;
    }
    next.splice(insertAt, 0, ff);
  }

  if (!next.some((w) => w.widget === "CustomerInfo")) {
    const afterBanner = next.findIndex((w) => w.widget === "StatusBanner");
    next.splice(afterBanner >= 0 ? afterBanner + 1 : 0, 0, { widget: "CustomerInfo", props: {} });
  }

  const hasNotes = next.some((w) => w.widget === "Comments" || w.widget === "Notes");
  const hasAttach = next.some((w) => w.widget === "FileUpload" || w.widget === "Attachments");
  const actionIdx = next.findIndex((w) => w.widget === "ActionButtons");
  const injectAt = actionIdx >= 0 ? actionIdx : next.length;
  const toInject: LayoutWidget[] = [];
  if (!hasNotes) toInject.push({ widget: "Notes", props: {} });
  if (!hasAttach) toInject.push({ widget: "Attachments", props: {} });
  if (toInject.length) next.splice(injectAt, 0, ...toInject);

  return next;
}

export function stepUiToScreen(
  act: { action: string; label: string },
  ui?: StepUiLike | null
): ScreenDefinition {
  const layout = applyHostLayoutChrome(act, ui?.layout ? [...ui.layout] : undefined);
  return normalizeScreenDefinition({
    key: ui?.formId ?? act.action,
    id: ui?.formId,
    title: ui?.title ?? act.label,
    description: ui?.description,
    fields: ui?.fields,
    theme: ui?.theme,
    themeId: ui?.themeId,
    confirmLabel: ui?.confirmLabel,
    layout,
  });
}

export function ScreenController(props: {
  action: string;
  label: string;
  ui?: StepUiLike | null;
  order: Record<string, unknown>;
  customer?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    creditLimit?: number | null;
    isBlocked?: boolean | null;
  } | null;
  items: LineItemLike[];
  canComplete: boolean;
  fieldValues: Record<string, string>;
  setFieldValue: (key: string, value: string, itemId?: string) => void;
  onComplete: (payload: Record<string, unknown>) => void;
  busy?: boolean;
  lineEditor?: LineEditorApi;
  toast?: { success: (m: string) => void; error: (m: string) => void };
  /** ADR 0009 host-supplied context */
  lookups?: { warehouses?: PickerOption[]; drivers?: PickerOption[] };
  inventory?: InventoryLineView[];
  timeline?: WorkflowTimelineEvent[];
  comments?: CommentItem[];
  attachments?: AttachmentItem[];
  hostApis?: HostApis;
  /** Domain documents linked to this task entity (invoice, etc.). */
  documents?: Record<string, TaskDocumentMeta>;
  variables?: Record<string, unknown>;
}): ReactNode {
  if (!props.ui?.layout?.length) {
    return (
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
        No form layout for step <strong>{props.label}</strong>. Republish the workflow
        form with layout widgets.
      </div>
    );
  }

  let screen: ScreenDefinition;
  try {
    screen = stepUiToScreen({ action: props.action, label: props.label }, props.ui);
  } catch (e) {
    return (
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
        {e instanceof Error ? e.message : "Invalid screen definition"}
      </div>
    );
  }

  return (
    <TaskScreenRuntime
      screen={screen}
      order={props.order}
      customer={props.customer}
      items={props.items}
      taskAction={props.action}
      canComplete={props.canComplete}
      fieldValues={props.fieldValues}
      setFieldValue={props.setFieldValue}
      onComplete={props.onComplete}
      busy={props.busy}
      lineEditor={props.lineEditor}
      toast={props.toast}
      lookups={props.lookups}
      inventory={props.inventory}
      timeline={props.timeline}
      comments={props.comments}
      attachments={props.attachments}
      hostApis={props.hostApis}
      documents={props.documents}
      variables={props.variables}
    />
  );
}

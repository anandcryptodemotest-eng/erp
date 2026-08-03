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

export function stepUiToScreen(
  act: { action: string; label: string },
  ui?: StepUiLike | null
): ScreenDefinition {
  return normalizeScreenDefinition({
    key: ui?.formId ?? act.action,
    id: ui?.formId,
    title: ui?.title ?? act.label,
    description: ui?.description,
    fields: ui?.fields,
    theme: ui?.theme,
    themeId: ui?.themeId,
    confirmLabel: ui?.confirmLabel,
    layout: ui?.layout,
  });
}

export function ScreenController(props: {
  action: string;
  label: string;
  ui?: StepUiLike | null;
  order: Record<string, unknown>;
  customer?: { id?: string; name?: string | null } | null;
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
    />
  );
}

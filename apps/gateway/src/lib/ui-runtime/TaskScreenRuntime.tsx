"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  createUIRuntime,
  renderScreenLayout,
  collectScreenPayload,
  validateScreen,
  normalizeScreenDefinition,
  resolveTheme,
  ensureDefaultThemes,
  registerActivity,
  listWidgetManifests,
  type ScreenDefinition,
  type UIContext,
  type LineItemLike,
  type LineEditorApi,
  type PickerOption,
  type InventoryLineView,
  type WorkflowTimelineEvent,
  type CommentItem,
  type AttachmentItem,
  type HostApis,
} from "@erp/ui-runtime";
import { ensureOmsWidgetsRegistered } from "./oms-widgets";
import { SO_TASK_TYPES } from "@erp/workflow";

let activitiesBootstrapped = false;

export function ensurePlatformExtensionsBootstrapped(): void {
  ensureDefaultThemes();
  ensureOmsWidgetsRegistered();
  if (!activitiesBootstrapped) {
    activitiesBootstrapped = true;
    for (const t of SO_TASK_TYPES) {
      registerActivity({
        type: t.type,
        label: t.label,
        kind: t.kind,
      });
    }
  }
}

export function TaskScreenRuntime(props: {
  screen: ScreenDefinition;
  order: Record<string, unknown>;
  customer?: { id?: string; name?: string | null } | null;
  items: LineItemLike[];
  taskAction: string;
  canComplete: boolean;
  fieldValues: Record<string, string>;
  setFieldValue: (key: string, value: string, itemId?: string) => void;
  onComplete: (payload: Record<string, unknown>) => void;
  busy?: boolean;
  lineEditor?: LineEditorApi;
  toast?: { success: (m: string) => void; error: (m: string) => void };
  lookups?: { warehouses?: PickerOption[]; drivers?: PickerOption[] };
  inventory?: InventoryLineView[];
  timeline?: WorkflowTimelineEvent[];
  comments?: CommentItem[];
  attachments?: AttachmentItem[];
  hostApis?: HostApis;
}): ReactNode {
  ensurePlatformExtensionsBootstrapped();

  const screen = useMemo(() => {
    try {
      return normalizeScreenDefinition(props.screen);
    } catch {
      return null;
    }
  }, [props.screen]);

  const [localError, setLocalError] = useState<string | null>(null);

  if (!screen) {
    return (
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
        Form has no layout. Republish the form asset with layout widgets.
      </div>
    );
  }

  const theme = resolveTheme(screen.themeId ?? screen.theme);

  function requestComplete(ctx: UIContext) {
    const runtime = createUIRuntime({ context: ctx, toast: props.toast });
    const v = validateScreen(runtime);
    if (!v.ok) {
      setLocalError(v.errors?.join("; ") ?? "Validation failed");
      props.toast?.error(v.errors?.[0] ?? "Validation failed");
      return;
    }
    setLocalError(null);
    props.onComplete(collectScreenPayload(runtime));
  }

  const context: UIContext = {
    entity: {
      type: "SALES_ORDER",
      id: String(props.order.id ?? ""),
      data: props.order,
    },
    order: props.order,
    customer: props.customer,
    items: props.items,
    permissions: {
      canEdit: props.canComplete,
      canComplete: props.canComplete && !props.busy,
      roles: [],
    },
    variables: {},
    fieldValues: props.fieldValues,
    setFieldValue: props.setFieldValue,
    screen,
    theme,
    task: { action: props.taskAction },
    lineEditor: props.lineEditor,
    lookups: props.lookups,
    inventory: props.inventory,
    timeline: props.timeline,
    comments: props.comments,
    attachments: props.attachments,
    hostApis: props.hostApis,
  };
  context.variables.__requestComplete = () => requestComplete(context);

  const runtime = createUIRuntime({ context, toast: props.toast });
  const nodes = renderScreenLayout(runtime);

  return (
    <div
      className={`rounded-xl border-2 p-4 space-y-3 shadow-sm ${theme.panelBorder} ${theme.panelBg}`}
    >
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${theme.accentText}`}>
          Step — your work
        </p>
        <h3 className="text-base font-semibold text-slate-900">
          {screen.title ?? screen.key}
        </h3>
        {screen.description && (
          <p className="text-xs mt-0.5 text-slate-500">{screen.description}</p>
        )}
      </div>
      {localError && <p className="text-xs text-red-600">{localError}</p>}
      {nodes.map((n, i) => (
        <div key={i}>{n}</div>
      ))}
    </div>
  );
}

export { listWidgetManifests, normalizeScreenDefinition };
export { createAdminHost } from "./admin-host";


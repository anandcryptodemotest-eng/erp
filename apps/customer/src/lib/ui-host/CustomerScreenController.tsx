"use client";

/**
 * Customer Host Screen Controller (ADR 0010 / 0011 / 0005).
 * Assembles UIContext; dispatches submit by formId. Widgets never call REST.
 */

import { useMemo, useState, type ReactNode } from "react";
import {
  createUIRuntime,
  renderScreenLayout,
  collectScreenPayload,
  validateScreen,
  normalizeScreenDefinition,
  resolveTheme,
  hostServicesToHostApis,
  type FormDefinition,
  type Host,
  type LineItemLike,
  type ScreenDefinition,
  type UIContext,
  type WorkflowTimelineEvent,
} from "@erp/ui-runtime";
import { ensureCustomerWidgetsRegistered } from "./customer-widgets";
import {
  dispatchCustomerFormSubmit,
  type CustomerFormSubmitContext,
} from "./form-submit";

export type CustomerScreenSubmitContext = CustomerFormSubmitContext & {
  /** Checkout host supplies this for customer-checkout */
  onCheckoutSubmit?: (payload: Record<string, unknown>) => void | Promise<void>;
  onBusy?: (busy: boolean) => void;
};

export function CustomerScreenController(props: {
  host: Host;
  screen: FormDefinition | ScreenDefinition;
  order?: Record<string, unknown>;
  customer?: { id?: string; name?: string | null } | null;
  items?: LineItemLike[];
  fieldValues: Record<string, string>;
  setFieldValue: (key: string, value: string, itemId?: string) => void;
  timeline?: WorkflowTimelineEvent[];
  busy?: boolean;
  /** Domain context for formId → API dispatch */
  submitContext?: CustomerScreenSubmitContext;
}): ReactNode {
  ensureCustomerWidgetsRegistered();

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
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Form has no layout. Publish a Customer audience form with layout widgets.
      </div>
    );
  }

  const formId = screen.id ?? screen.key;
  const theme = resolveTheme(props.host.theme.themeId ?? screen.themeId ?? screen.theme);
  const order = props.order ?? {};

  async function requestComplete(ctx: UIContext) {
    const runtime = createUIRuntime({ context: ctx });
    const v = validateScreen(runtime);
    if (!v.ok) {
      setLocalError(v.errors?.join("; ") ?? "Validation failed");
      return;
    }
    setLocalError(null);
    const payload = collectScreenPayload(runtime);
    const sc = props.submitContext;
    sc?.onBusy?.(true);

    if (formId === "customer-checkout" && sc?.onCheckoutSubmit) {
      try {
        await sc.onCheckoutSubmit(payload);
      } catch (e: unknown) {
        setLocalError(e instanceof Error ? e.message : "Submit failed");
        sc?.onBusy?.(false);
      }
      return;
    }

    // Prefer generic Host.services.submit only as escape hatch; default is formId dispatch
    if (props.host.services.submit && !sc) {
      void props.host.services.submit(payload);
      return;
    }

    await dispatchCustomerFormSubmit(formId, payload, {
      customerId: sc?.customerId ?? props.customer?.id,
      addressMode: sc?.addressMode,
      addressId: sc?.addressId,
      onSuccess: async (result) => {
        sc?.onBusy?.(false);
        await sc?.onSuccess?.(result);
      },
      onError: (message) => {
        sc?.onBusy?.(false);
        setLocalError(message);
        sc?.onError?.(message);
      },
    });
  }

  const context: UIContext = {
    entity: {
      type: "CUSTOMER",
      id: String(props.customer?.id ?? order.id ?? ""),
      data: order,
    },
    order,
    customer: props.customer,
    items: props.items ?? [],
    permissions: {
      ...props.host.permissions,
      canComplete: props.host.permissions.canComplete && !props.busy,
    },
    variables: {},
    fieldValues: props.fieldValues,
    setFieldValue: props.setFieldValue,
    screen,
    theme,
    task: { action: formId },
    timeline: props.timeline,
    hostApis: hostServicesToHostApis(props.host.services),
  };
  context.variables.__requestComplete = () => void requestComplete(context);

  const runtime = createUIRuntime({
    context,
    navigation: props.host.navigation,
  });
  const nodes = renderScreenLayout(runtime);

  return (
    <div className="space-y-4">
      {localError && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{localError}</p>
      )}
      {nodes.map((n, i) => (
        <div key={i}>{n}</div>
      ))}
    </div>
  );
}

export function createCustomerHost(opts: {
  permissions?: Host["permissions"];
  navigation?: Host["navigation"];
  services?: Host["services"];
  themeId?: string;
}): Host {
  return {
    id: "CUSTOMER",
    permissions: opts.permissions ?? {
      canEdit: true,
      canComplete: true,
      roles: ["CUSTOMER"],
    },
    navigation: opts.navigation ?? {},
    theme: { themeId: opts.themeId ?? "oms-default" },
    services: opts.services ?? {},
  };
}

"use client";

import type { UIRuntime, ValidationResult, Widget } from "@erp/ui-runtime";
import {
  coerceOpenInNewTab,
  isValidExternalLinkUrl,
  resolveExternalLinkUrl,
} from "./resolve-external-link-url";

/**
 * Generic third-party open helper for OMS task forms.
 * Does not claim/complete tasks, persist fields, or call APIs.
 * Porter booking gates remain on DispatchFulfillment.
 */
export const ExternalLinkWidget: Widget = {
  render(runtime: UIRuntime, props: Record<string, unknown>) {
    const label =
      (typeof props.label === "string" && props.label.trim()) || "Open external app";
    const description =
      typeof props.description === "string" && props.description.trim()
        ? props.description.trim()
        : "";
    const openInNewTab = coerceOpenInNewTab(props.openInNewTab, true);
    const effectiveUrl = resolveExternalLinkUrl(props, runtime.context.variables ?? {});
    const valid = isValidExternalLinkUrl(effectiveUrl);

    function open() {
      if (!valid) return;
      window.open(effectiveUrl, openInNewTab ? "_blank" : "_self", "noopener,noreferrer");
    }

    return (
      <div className="space-y-2 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-3">
        {description ? (
          <p className="text-sm text-[var(--ink-soft)]">{description}</p>
        ) : null}
        <button
          type="button"
          className="ws-btn ws-btn--primary disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!valid}
          onClick={open}
          title={valid ? effectiveUrl : undefined}
        >
          {label}
        </button>
        {!valid ? (
          <p className="text-xs text-[var(--ink-soft)]">External link is not configured.</p>
        ) : null}
      </div>
    );
  },

  validate(_runtime: UIRuntime, _props: Record<string, unknown>): ValidationResult {
    return { ok: true };
  },

  collectPayload(_runtime: UIRuntime, _props: Record<string, unknown>): Record<string, unknown> {
    return {};
  },
};

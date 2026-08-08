"use client";

import {
  applyPorterBookingEvent,
  canCompleteDispatch,
  DEFAULT_PORTER_BOOK_URL,
  parseFulfillmentMode,
  parsePorterBookingStatus,
  type FulfillmentMode,
  type PorterBookingStatus,
} from "@erp/types";
import type { UIRuntime, Widget } from "@erp/ui-runtime";

function val(runtime: UIRuntime, key: string): string {
  return runtime.context.fieldValues[key] ?? "";
}

function set(runtime: UIRuntime, key: string, value: string) {
  runtime.context.setFieldValue(key, value);
}

function bookingLabel(status: PorterBookingStatus): string {
  if (status === "BOOKING_PENDING") return "Booking pending";
  if (status === "BOOKED") return "Booked";
  if (status === "CANCELLED") return "Cancelled";
  return "Not booked";
}

export const DispatchFulfillmentWidget: Widget = {
  render(runtime: UIRuntime) {
    const canEdit = runtime.context.permissions.canEdit;
    const porterEnabled = runtime.context.variables.porterEnabled !== false;
    const bookUrl =
      (typeof runtime.context.variables.porterBookUrl === "string" &&
        runtime.context.variables.porterBookUrl.trim()) ||
      DEFAULT_PORTER_BOOK_URL;

    const mode = parseFulfillmentMode(val(runtime, "fulfillmentMode") || "own_fleet");
    const status = parsePorterBookingStatus(val(runtime, "porterBookingStatus"));

    function setMode(next: FulfillmentMode) {
      set(runtime, "fulfillmentMode", next);
      if (next === "porter") {
        set(runtime, "carrier", "porter");
        if (!val(runtime, "porterBookingStatus")) {
          set(runtime, "porterBookingStatus", "NOT_BOOKED");
        }
      }
    }

    function bookOnPorter() {
      const next = applyPorterBookingEvent(status, "BOOK_REQUESTED");
      set(runtime, "fulfillmentMode", "porter");
      set(runtime, "carrier", "porter");
      set(runtime, "porterBookingStatus", next);
      window.open(bookUrl, "_blank", "noopener,noreferrer");
    }

    function onTrackingChange(key: "trackingNumber" | "trackingUrl", value: string) {
      set(runtime, key, value);
      if (!value.trim()) return;
      const next = applyPorterBookingEvent(
        parsePorterBookingStatus(val(runtime, "porterBookingStatus")),
        "TRACKING_ENTERED"
      );
      set(runtime, "porterBookingStatus", next);
      set(runtime, "fulfillmentMode", "porter");
      set(runtime, "carrier", "porter");
    }

    function cancelBooking() {
      const next = applyPorterBookingEvent(status, "CANCELLED");
      set(runtime, "porterBookingStatus", next);
    }

    return (
      <div className="space-y-3" key="DispatchFulfillment">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Fulfillment
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setMode("own_fleet")}
              className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium ${
                mode === "own_fleet"
                  ? "bg-[var(--brand)] text-[var(--ink-inverse)]"
                  : "border border-[var(--line)] bg-white text-[var(--ink-soft)]"
              }`}
            >
              Own fleet
            </button>
            {porterEnabled ? (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setMode("porter")}
                className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-medium ${
                  mode === "porter"
                    ? "bg-[var(--brand)] text-[var(--ink-inverse)]"
                    : "border border-[var(--line)] bg-white text-[var(--ink-soft)]"
                }`}
              >
                Porter
              </button>
            ) : null}
          </div>
        </div>

        {mode === "own_fleet" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block text-xs text-[var(--ink-soft)]">
              Vehicle no. *
              <input
                className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-2 text-sm disabled:bg-[var(--mist)]"
                disabled={!canEdit}
                value={val(runtime, "vehicleInfo")}
                onChange={(e) => set(runtime, "vehicleInfo", e.target.value)}
              />
            </label>
            <label className="block text-xs text-[var(--ink-soft)]">
              Driver name / ID *
              <input
                className="mt-0.5 w-full rounded border border-[var(--line)] px-2 py-2 text-sm disabled:bg-[var(--mist)]"
                disabled={!canEdit}
                value={val(runtime, "assignedDriverId")}
                onChange={(e) => set(runtime, "assignedDriverId", e.target.value)}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--mist)]/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                Porter · {bookingLabel(status)}
              </span>
              {status === "BOOKING_PENDING" || status === "BOOKED" ? (
                <button
                  type="button"
                  disabled={!canEdit}
                  className="text-xs text-[var(--ink-soft)] underline"
                  onClick={cancelBooking}
                >
                  Cancel booking
                </button>
              ) : null}
            </div>
            <p className="text-xs text-[var(--ink-soft)]">
              Opens Porter in a new tab. Opening Porter does not dispatch the order. Tracking ID is
              optional — you can complete after booking is pending.
            </p>
            <button
              type="button"
              disabled={!canEdit}
              onClick={bookOnPorter}
              className="inline-flex min-h-11 items-center rounded-lg bg-[var(--ink)] px-4 text-sm font-semibold text-[var(--ink-inverse)] disabled:opacity-50"
            >
              Book on Porter
            </button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-xs text-[var(--ink-soft)]">
                Tracking / booking ID (optional)
                <input
                  className="mt-0.5 w-full rounded border border-[var(--line)] bg-white px-2 py-2 text-sm disabled:bg-[var(--mist)]"
                  disabled={!canEdit}
                  value={val(runtime, "trackingNumber")}
                  onChange={(e) => onTrackingChange("trackingNumber", e.target.value)}
                  placeholder="Porter trip id"
                />
              </label>
              <label className="block text-xs text-[var(--ink-soft)]">
                Tracking URL (optional)
                <input
                  className="mt-0.5 w-full rounded border border-[var(--line)] bg-white px-2 py-2 text-sm disabled:bg-[var(--mist)]"
                  disabled={!canEdit}
                  value={val(runtime, "trackingUrl")}
                  onChange={(e) => onTrackingChange("trackingUrl", e.target.value)}
                  placeholder="https://…"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    );
  },
  validate(runtime) {
    const gate = canCompleteDispatch({
      fulfillmentMode: val(runtime, "fulfillmentMode") || "own_fleet",
      porterBookingStatus: val(runtime, "porterBookingStatus"),
      vehicleInfo: val(runtime, "vehicleInfo"),
      assignedDriverId: val(runtime, "assignedDriverId"),
      trackingNumber: val(runtime, "trackingNumber"),
      trackingUrl: val(runtime, "trackingUrl"),
    });
    return gate.ok ? { ok: true } : { ok: false, errors: [gate.error] };
  },
  collectPayload(runtime) {
    const mode = parseFulfillmentMode(val(runtime, "fulfillmentMode") || "own_fleet");
    const out: Record<string, unknown> = {
      fulfillmentMode: mode,
      vehicleInfo: val(runtime, "vehicleInfo").trim() || undefined,
      assignedDriverId: val(runtime, "assignedDriverId").trim() || undefined,
      trackingNumber: val(runtime, "trackingNumber").trim() || undefined,
      trackingUrl: val(runtime, "trackingUrl").trim() || undefined,
    };
    if (mode === "porter") {
      out.carrier = "porter";
      out.porterBookingStatus = parsePorterBookingStatus(val(runtime, "porterBookingStatus"));
    }
    return out;
  },
};

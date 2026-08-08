/**
 * Central dispatch fulfillment rules (Phase 0 Porter + own fleet).
 * UI, Zod, and the DISPATCH adapter must all call these helpers — do not fork interpretations.
 */

export const FULFILLMENT_MODES = ["own_fleet", "porter"] as const;
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number];

export const PORTER_BOOKING_STATUSES = [
  "NOT_BOOKED",
  "BOOKING_PENDING",
  "BOOKED",
  "CANCELLED",
] as const;
export type PorterBookingStatus = (typeof PORTER_BOOKING_STATUSES)[number];

export type PorterBookingEvent = "BOOK_REQUESTED" | "TRACKING_ENTERED" | "CANCELLED";

export const DEFAULT_PORTER_BOOK_URL = "https://porter.in/";

export function parseFulfillmentMode(raw: unknown): FulfillmentMode {
  return raw === "porter" ? "porter" : "own_fleet";
}

export function parsePorterBookingStatus(raw: unknown): PorterBookingStatus {
  if (typeof raw === "string" && (PORTER_BOOKING_STATUSES as readonly string[]).includes(raw)) {
    return raw as PorterBookingStatus;
  }
  return "NOT_BOOKED";
}

/** Pure state machine — the only place Porter booking status may change. */
export function applyPorterBookingEvent(
  current: PorterBookingStatus,
  event: PorterBookingEvent
): PorterBookingStatus {
  if (event === "CANCELLED") {
    if (current === "BOOKING_PENDING" || current === "BOOKED") return "CANCELLED";
    return current;
  }
  if (event === "BOOK_REQUESTED") {
    if (current === "NOT_BOOKED" || current === "CANCELLED") return "BOOKING_PENDING";
    return current;
  }
  if (event === "TRACKING_ENTERED") {
    if (current === "CANCELLED") return "BOOKED";
    if (current === "NOT_BOOKED" || current === "BOOKING_PENDING" || current === "BOOKED") {
      return "BOOKED";
    }
  }
  return current;
}

export type DispatchCompleteInput = {
  fulfillmentMode?: unknown;
  porterBookingStatus?: unknown;
  assignedDriverId?: unknown;
  vehicleInfo?: unknown;
  trackingNumber?: unknown;
  trackingUrl?: unknown;
  carrier?: unknown;
};

export type DispatchCompleteResult = { ok: true } | { ok: false; error: string };

/**
 * Single complete gate:
 * - own_fleet: vehicle + driver required
 * - porter: BOOKING_PENDING or BOOKED (tracking optional); NOT_BOOKED / CANCELLED blocked
 */
export function canCompleteDispatch(input: DispatchCompleteInput): DispatchCompleteResult {
  const mode = parseFulfillmentMode(input.fulfillmentMode);
  if (mode === "own_fleet") {
    const vehicle = String(input.vehicleInfo ?? "").trim();
    const driver = String(input.assignedDriverId ?? "").trim();
    if (!vehicle) return { ok: false, error: "Vehicle no. is required for own fleet" };
    if (!driver) return { ok: false, error: "Driver name / ID is required for own fleet" };
    return { ok: true };
  }
  const status = parsePorterBookingStatus(input.porterBookingStatus);
  if (status === "NOT_BOOKED") {
    return { ok: false, error: "Book on Porter before completing dispatch" };
  }
  if (status === "CANCELLED") {
    return { ok: false, error: "Porter booking was cancelled — book again or switch to own fleet" };
  }
  return { ok: true };
}

export type NormalizedDispatchPayload = {
  fulfillmentMode: FulfillmentMode;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  porterBookingStatus: PorterBookingStatus | null;
  assignedDriverId: string | null;
  vehicleInfo: string | null;
};

/** Normalize payload before persist. Applying tracking id promotes status via the state machine. */
export function normalizeDispatchPayload(input: DispatchCompleteInput): NormalizedDispatchPayload {
  const mode = parseFulfillmentMode(input.fulfillmentMode);
  const trackingNumber = String(input.trackingNumber ?? "").trim() || null;
  const trackingUrl = String(input.trackingUrl ?? "").trim() || null;
  const assignedDriverId = String(input.assignedDriverId ?? "").trim() || null;
  const vehicleInfo = String(input.vehicleInfo ?? "").trim() || null;

  if (mode !== "porter") {
    return {
      fulfillmentMode: "own_fleet",
      carrier: null,
      trackingNumber,
      trackingUrl,
      porterBookingStatus: null,
      assignedDriverId,
      vehicleInfo,
    };
  }

  let status = parsePorterBookingStatus(input.porterBookingStatus);
  if (trackingNumber || trackingUrl) {
    status = applyPorterBookingEvent(status, "TRACKING_ENTERED");
  }

  return {
    fulfillmentMode: "porter",
    carrier: "porter",
    trackingNumber,
    trackingUrl,
    porterBookingStatus: status,
    assignedDriverId,
    vehicleInfo,
  };
}

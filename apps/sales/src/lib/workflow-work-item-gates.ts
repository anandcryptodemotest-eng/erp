/**
 * Pure gates for composite Work Item complete (no Prisma / config imports).
 */

/** True when payload has enough fulfillment data to complete dispatch in the same session. */
export function hasDispatchFulfillmentPayload(payload: Record<string, unknown>): boolean {
  const vehicle = String(payload.vehicleInfo ?? "").trim();
  const driver = String(payload.assignedDriverId ?? "").trim();
  if (vehicle && driver) return true;
  const mode = String(payload.fulfillmentMode ?? payload.carrier ?? "").toLowerCase();
  const status = String(payload.porterBookingStatus ?? "").toUpperCase();
  if (mode === "porter" && (status === "BOOKING_PENDING" || status === "BOOKED")) return true;
  if (status === "BOOKING_PENDING" || status === "BOOKED") return true;
  return false;
}

/** True when payload has real collection evidence (blank strings do not count). */
export function hasPaymentCollectionPayload(payload: Record<string, unknown>): boolean {
  const amountRaw = payload.paymentAmount ?? payload.amount;
  if (amountRaw != null && amountRaw !== "") {
    const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
    if (Number.isFinite(amount) && amount > 0) return true;
  }
  const method = String(payload.paymentMethod ?? payload.method ?? "").trim();
  if (method) return true;
  const ref = String(payload.paymentReference ?? payload.reference ?? "").trim();
  if (ref) return true;
  return false;
}

/**
 * Whether to advance this activity inside a composite Work Item complete.
 */
export function shouldCompleteStep(
  stepKey: string,
  workItemKey: string,
  payload: Record<string, unknown>
): boolean {
  if (workItemKey === "bill_and_collect") {
    if (stepKey === "invoice") return true;
    if (stepKey === "payment") return hasPaymentCollectionPayload(payload);
    return true;
  }
  if (workItemKey === "dispatch_order" && stepKey === "dispatch") {
    // Warehouse-only session: do not run canCompleteDispatch yet
    return hasDispatchFulfillmentPayload(payload);
  }
  return true;
}

export function slicePayloadForStep(
  stepKey: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (stepKey === "warehouse") {
    const out: Record<string, unknown> = {};
    if (payload.warehouseId != null) out.warehouseId = payload.warehouseId;
    if (payload.items != null) out.items = payload.items;
    return out;
  }
  if (stepKey === "dispatch") {
    const { warehouseId: _w, ...rest } = payload;
    return rest;
  }
  if (stepKey === "invoice") {
    const out: Record<string, unknown> = {};
    for (const k of ["invoiceId", "invoiceNumber", "notes", "items"]) {
      if (payload[k] != null) out[k] = payload[k];
    }
    return Object.keys(out).length ? out : {};
  }
  if (stepKey === "payment") {
    const out: Record<string, unknown> = {};
    for (const k of [
      "paymentAmount",
      "paymentMethod",
      "paymentReference",
      "amount",
      "method",
      "reference",
      "notes",
    ]) {
      if (payload[k] != null && payload[k] !== "") out[k] = payload[k];
    }
    return out;
  }
  return payload;
}

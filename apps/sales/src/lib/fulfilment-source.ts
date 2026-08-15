/**
 * Exclusive capture-channel invariant for fulfilment-bound Sales Orders.
 * Quick Bill is not a fulfilment source and must not call this module.
 */

export const FULFILMENT_SOURCE_KINDS = ["SREQ", "WALK_IN", "QUOTE"] as const;
export type FulfilmentSourceKind = (typeof FULFILMENT_SOURCE_KINDS)[number];

export type FulfilmentSourceInput = {
  sourceKind?: string | null;
  salesRequestId?: string | null;
  quoteId?: string | null;
  customerId?: string | null;
  walkInName?: string | null;
  walkInPhone?: string | null;
};

export type FulfilmentSource =
  | { sourceKind: "SREQ"; salesRequestId: string }
  | { sourceKind: "QUOTE"; quoteId: string }
  | {
      sourceKind: "WALK_IN";
      customerId?: string;
      walkInName?: string;
      walkInPhone?: string;
    };

export class FulfilmentSourceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "FulfilmentSourceError";
    this.status = status;
  }
}

function trim(value?: string | null): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

export function assertFulfilmentSource(input: FulfilmentSourceInput): FulfilmentSource {
  const kind = input.sourceKind?.trim();
  if (!kind || !FULFILMENT_SOURCE_KINDS.includes(kind as FulfilmentSourceKind)) {
    throw new FulfilmentSourceError("sourceKind must be SREQ, WALK_IN, or QUOTE");
  }

  const salesRequestId = trim(input.salesRequestId);
  const quoteId = trim(input.quoteId);
  const customerId = trim(input.customerId);
  const walkInName = trim(input.walkInName);
  const walkInPhone = trim(input.walkInPhone);
  const hasWalkInCapture = Boolean(walkInName || walkInPhone);

  if (kind === "SREQ") {
    if (!salesRequestId) throw new FulfilmentSourceError("SREQ requires salesRequestId");
    if (quoteId) throw new FulfilmentSourceError("SREQ cannot include quoteId");
    if (hasWalkInCapture) throw new FulfilmentSourceError("SREQ cannot include walk-in capture data");
    return { sourceKind: "SREQ", salesRequestId };
  }

  if (kind === "QUOTE") {
    if (!quoteId) throw new FulfilmentSourceError("QUOTE requires quoteId");
    if (salesRequestId) throw new FulfilmentSourceError("QUOTE cannot include salesRequestId");
    if (hasWalkInCapture) throw new FulfilmentSourceError("QUOTE cannot include walk-in capture data");
    return { sourceKind: "QUOTE", quoteId };
  }

  if (salesRequestId) throw new FulfilmentSourceError("WALK_IN cannot include salesRequestId");
  if (quoteId) throw new FulfilmentSourceError("WALK_IN cannot include quoteId");
  if (!customerId && !walkInName) {
    throw new FulfilmentSourceError("WALK_IN requires an existing customerId or walk-in name");
  }
  return { sourceKind: "WALK_IN", customerId, walkInName, walkInPhone };
}

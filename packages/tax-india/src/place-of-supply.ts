import { parseGstinStateCode } from "./gstin";
import type { PlaceOfSupplyInput, PlaceOfSupplyResult } from "./types";

function validStateCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (!/^\d{2}$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (n < 1 || n > 37) return null;
  return trimmed;
}

export function resolvePlaceOfSupply(input: PlaceOfSupplyInput): PlaceOfSupplyResult {
  const fromTransaction = validStateCode(input.transactionPos);
  if (fromTransaction) return { ok: true, stateCode: fromTransaction };

  const fromShipTo = validStateCode(input.shipToStateCode);
  if (fromShipTo) return { ok: true, stateCode: fromShipTo };

  const fromBuyerState = validStateCode(input.buyerStateCode);
  if (fromBuyerState) return { ok: true, stateCode: fromBuyerState };

  const fromGstin = input.buyerGstin ? parseGstinStateCode(input.buyerGstin) : null;
  if (fromGstin) return { ok: true, stateCode: fromGstin };

  const fromDefault = validStateCode(input.tenantDefaultPos);
  if (fromDefault) return { ok: true, stateCode: fromDefault };

  return {
    ok: false,
    reason:
      "Place of supply could not be determined. Set ship-to state, buyer GSTIN, transaction POS, or tenant default.",
  };
}

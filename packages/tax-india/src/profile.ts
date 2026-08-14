import { z } from "zod";
import {
  EInvoiceMode,
  TaxRegime,
  TaxScheme,
  TaxSettingKey,
  type TenantTaxProfile,
} from "./types";
import { validateGstin } from "./gstin";

export const tenantTaxSettingsSchema = z
  .object({
    [TaxSettingKey.Regime]: z.enum([TaxRegime.None, TaxRegime.InGst]).optional(),
    [TaxSettingKey.Scheme]: z
      .enum([TaxScheme.Unregistered, TaxScheme.Regular, TaxScheme.Composition])
      .optional(),
    [TaxSettingKey.Gstin]: z.string().optional(),
    [TaxSettingKey.LegalName]: z.string().optional(),
    [TaxSettingKey.Address]: z.string().optional(),
    [TaxSettingKey.StateCode]: z.string().optional(),
    [TaxSettingKey.PlaceOfSupplyDefault]: z.string().optional(),
    [TaxSettingKey.EInvoiceMode]: z
      .enum([EInvoiceMode.Off, EInvoiceMode.Optional, EInvoiceMode.Required])
      .optional(),
    [TaxSettingKey.LutNumber]: z.string().optional(),
  })
  .passthrough();

export function normalizeRegimeScheme(
  regime: TaxRegime,
  scheme?: TaxScheme | null
): TaxScheme {
  if (regime === TaxRegime.None) return TaxScheme.Unregistered;
  if (scheme === TaxScheme.Regular || scheme === TaxScheme.Composition) return scheme;
  return TaxScheme.Regular;
}

export function assertTenantTaxProfile(
  regime: TaxRegime,
  scheme: TaxScheme
): { ok: true } | { ok: false; error: string } {
  if (regime === TaxRegime.None && scheme !== TaxScheme.Unregistered) {
    return { ok: false, error: "When tax.regime is NONE, tax.scheme must be UNREGISTERED" };
  }
  if (regime === TaxRegime.InGst && scheme === TaxScheme.Unregistered) {
    return { ok: false, error: "When tax.regime is IN_GST, tax.scheme cannot be UNREGISTERED" };
  }
  if (regime === TaxRegime.InGst && scheme !== TaxScheme.Regular && scheme !== TaxScheme.Composition) {
    return { ok: false, error: "When tax.regime is IN_GST, tax.scheme must be REGULAR or COMPOSITION" };
  }
  return { ok: true };
}

export function parseTenantTaxProfile(
  settings: Record<string, string | undefined>
): TenantTaxProfile {
  const regime = (settings[TaxSettingKey.Regime] as TaxRegime) || TaxRegime.None;
  const scheme = normalizeRegimeScheme(regime, settings[TaxSettingKey.Scheme] as TaxScheme);
  return {
    regime,
    scheme,
    gstin: settings[TaxSettingKey.Gstin]?.trim().toUpperCase() ?? "",
    legalName: settings[TaxSettingKey.LegalName]?.trim() ?? "",
    address: settings[TaxSettingKey.Address]?.trim() ?? "",
    stateCode: settings[TaxSettingKey.StateCode]?.trim() ?? "",
    placeOfSupplyDefault: settings[TaxSettingKey.PlaceOfSupplyDefault]?.trim() ?? "",
    eInvoiceMode: (settings[TaxSettingKey.EInvoiceMode] as EInvoiceMode) || EInvoiceMode.Off,
    lutNumber: settings[TaxSettingKey.LutNumber]?.trim() || undefined,
    nicMode: settings[TaxSettingKey.NicMode] === "PRODUCTION" ? "PRODUCTION" : "DEMO",
  };
}

export function validateTaxSettingsUpdate(
  incoming: Record<string, string>,
  existing: Record<string, string> = {}
): { ok: true; normalized: Record<string, string> } | { ok: false; error: string } {
  const merged = { ...existing, ...incoming };
  const regime = (merged[TaxSettingKey.Regime] as TaxRegime) || TaxRegime.None;
  let scheme = merged[TaxSettingKey.Scheme] as TaxScheme | undefined;

  if (incoming[TaxSettingKey.Regime] === TaxRegime.None) {
    scheme = TaxScheme.Unregistered;
    merged[TaxSettingKey.Scheme] = TaxScheme.Unregistered;
  }

  scheme = normalizeRegimeScheme(regime, scheme);
  merged[TaxSettingKey.Scheme] = scheme;

  const invariant = assertTenantTaxProfile(regime, scheme);
  if (!invariant.ok) return invariant;

  if (regime === TaxRegime.InGst) {
    const gstin = merged[TaxSettingKey.Gstin]?.trim().toUpperCase() ?? "";
    if (!gstin) return { ok: false, error: "GSTIN is required when India GST is enabled" };
    const check = validateGstin(gstin);
    if (!check.valid) return { ok: false, error: check.error ?? "Invalid GSTIN" };
    merged[TaxSettingKey.Gstin] = gstin;
    if (!merged[TaxSettingKey.StateCode] && check.stateCode) {
      merged[TaxSettingKey.StateCode] = check.stateCode;
    }
    if (!merged[TaxSettingKey.LegalName]?.trim()) {
      return { ok: false, error: "Legal name is required when India GST is enabled" };
    }
  }

  if (merged[TaxSettingKey.EInvoiceMode] && regime === TaxRegime.None) {
    merged[TaxSettingKey.EInvoiceMode] = EInvoiceMode.Off;
  }

  if (!merged[TaxSettingKey.NicMode]) {
    merged[TaxSettingKey.NicMode] = "DEMO";
  }
  if (merged[TaxSettingKey.NicMode] !== "PRODUCTION") {
    merged[TaxSettingKey.NicMode] = "DEMO";
  }

  return { ok: true, normalized: merged };
}

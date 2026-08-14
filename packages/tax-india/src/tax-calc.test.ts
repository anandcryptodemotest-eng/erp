import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertTenantTaxProfile,
  computeLineTax,
  normalizeRate,
  resolveDocumentKind,
  resolvePlaceOfSupply,
} from "./index";
import { TaxRegime, TaxScheme, TaxTreatment, type TenantTaxProfile } from "./types";

describe("tax-india", () => {
  it("enforces regime/scheme invariants", () => {
    assert.equal(assertTenantTaxProfile(TaxRegime.None, TaxScheme.Unregistered).ok, true);
    assert.equal(assertTenantTaxProfile(TaxRegime.None, TaxScheme.Regular).ok, false);
    assert.equal(assertTenantTaxProfile(TaxRegime.InGst, TaxScheme.Regular).ok, true);
    assert.equal(assertTenantTaxProfile(TaxRegime.InGst, TaxScheme.Unregistered).ok, false);
  });

  it("normalizes percent vs fraction rates", () => {
    assert.equal(normalizeRate(18), 0.18);
    assert.equal(normalizeRate(0.18), 0.18);
  });

  it("resolves document kind by regime", () => {
    const none: TenantTaxProfile = {
      regime: TaxRegime.None,
      scheme: TaxScheme.Unregistered,
      gstin: "",
      legalName: "",
      address: "",
      stateCode: "",
      placeOfSupplyDefault: "",
      eInvoiceMode: "OFF",
      nicMode: "DEMO",
    };
    assert.equal(resolveDocumentKind(none), "COMMERCIAL");

    const comp: TenantTaxProfile = { ...none, regime: TaxRegime.InGst, scheme: TaxScheme.Composition };
    assert.equal(resolveDocumentKind(comp), "BILL_OF_SUPPLY");
  });

  it("splits CGST/SGST for intra-state", () => {
    const profile: TenantTaxProfile = {
      regime: TaxRegime.InGst,
      scheme: TaxScheme.Regular,
      gstin: "29AAAAA0000A1Z5",
      legalName: "Seller",
      address: "",
      stateCode: "29",
      placeOfSupplyDefault: "29",
      eInvoiceMode: "OFF",
      nicMode: "DEMO",
    };
    const line = computeLineTax(
      { taxableValue: 1000, taxRate: 0.18, taxTreatment: TaxTreatment.Taxable },
      { profile, sellerState: "29", posState: "29" }
    );
    assert.equal(line.taxAmount, 180);
    assert.equal(line.cgst, 90);
    assert.equal(line.sgst, 90);
    assert.equal(line.igst, 0);
  });

  it("uses IGST for inter-state", () => {
    const profile: TenantTaxProfile = {
      regime: TaxRegime.InGst,
      scheme: TaxScheme.Regular,
      gstin: "29AAAAA0000A1Z5",
      legalName: "Seller",
      address: "",
      stateCode: "29",
      placeOfSupplyDefault: "29",
      eInvoiceMode: "OFF",
      nicMode: "DEMO",
    };
    const line = computeLineTax(
      { taxableValue: 1000, taxRate: 0.18, taxTreatment: TaxTreatment.Taxable },
      { profile, sellerState: "29", posState: "07" }
    );
    assert.equal(line.igst, 180);
    assert.equal(line.cgst, 0);
  });

  it("blocks POS when unresolved", () => {
    const r = resolvePlaceOfSupply({});
    assert.equal(r.ok, false);
  });

  it("prefers transaction POS over default", () => {
    const r = resolvePlaceOfSupply({ transactionPos: "07", tenantDefaultPos: "29" });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.stateCode, "07");
  });
});

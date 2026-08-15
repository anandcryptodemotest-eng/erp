import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SO_STANDARD_FORMS,
  SO_STANDARD_FORMS_REV1,
  SO_STANDARD_FORMS_REV2,
  SO_STANDARD_FORMS_REV3,
  SO_STANDARD_FORMS_REV4,
  STARTER_FORM_LATEST_REVISION,
} from "../templates/so-standard-v5";
import {
  classifyStarterFormHash,
  hashFormDefinition,
} from "./starter-hash";

describe("SO_STANDARD starter revisions", () => {
  it("exposes latest revision 5", () => {
    assert.equal(STARTER_FORM_LATEST_REVISION, 5);
  });

  it("rev1 and rev2 differ for sales-review", () => {
    const rev1 = SO_STANDARD_FORMS_REV1.find((f) => f.id === "sales-review")!;
    const rev2 = SO_STANDARD_FORMS_REV2.find((f) => f.id === "sales-review")!;
    assert.notEqual(hashFormDefinition(rev1), hashFormDefinition(rev2));
  });

  it("classifies rev1–rev4 hashes as eligible against latest 5", () => {
    const formId = "invoice";
    const r1 = SO_STANDARD_FORMS_REV1.find((f) => f.id === formId)!;
    const r2 = SO_STANDARD_FORMS_REV2.find((f) => f.id === formId)!;
    const r3 = SO_STANDARD_FORMS_REV3.find((f) => f.id === formId)!;
    const r4 = SO_STANDARD_FORMS_REV4.find((f) => f.id === formId)!;
    const r5 = SO_STANDARD_FORMS.find((f) => f.id === formId)!;
    const hashes = {
      1: hashFormDefinition(r1),
      2: hashFormDefinition(r2),
      3: hashFormDefinition(r3),
      4: hashFormDefinition(r4),
      5: hashFormDefinition(r5),
    };
    assert.notEqual(hashes[4], hashes[5], "invoice body changes in rev5");
    assert.equal(classifyStarterFormHash(hashes[1], hashes, 5), "eligible");
    assert.equal(classifyStarterFormHash(hashes[2], hashes, 5), "eligible");
    assert.equal(classifyStarterFormHash(hashes[3], hashes, 5), "eligible");
    assert.equal(classifyStarterFormHash(hashes[4], hashes, 5), "eligible");
    assert.equal(classifyStarterFormHash(hashes[5], hashes, 5), "already-current");
  });

  it("invoice rev5 has InvoiceGenerate, editable lines, and optional advance fields", () => {
    const inv = SO_STANDARD_FORMS.find((f) => f.id === "invoice")!;
    const widgets = (inv.layout ?? []).map((w) => w.widget);
    assert.ok(widgets.includes("InvoiceGenerate"));
    assert.ok(widgets.includes("FormFields"));
    const pl = (inv.layout ?? []).find((w) => w.widget === "ProductList");
    assert.equal(pl?.props?.editable, true);
    const keys = (inv.fields ?? []).map((f) => f.key);
    assert.ok(keys.includes("paymentAmount"));
  });

  it("every latest form has ActionButtons", () => {
    for (const form of SO_STANDARD_FORMS) {
      const widgets = (form.layout ?? []).map((w) => w.widget);
      assert.ok(widgets.includes("ActionButtons"), `${form.id} needs ActionButtons`);
      if (form.id !== "invoice") {
        assert.ok(widgets.length >= 3, `${form.id} should have richer layout`);
      }
    }
  });
});

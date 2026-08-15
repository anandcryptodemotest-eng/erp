import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UIRuntime } from "@erp/ui-runtime";
import { ExternalLinkWidget } from "./external-link";
import {
  coerceOpenInNewTab,
  isValidExternalLinkUrl,
  resolveExternalLinkUrl,
} from "./resolve-external-link-url";

describe("resolveExternalLinkUrl", () => {
  it("uses props.url when no variable is configured", () => {
    assert.equal(
      resolveExternalLinkUrl({ url: "https://porter.in/book" }, {}),
      "https://porter.in/book"
    );
  });

  it("prefers a non-empty variable over props.url", () => {
    assert.equal(
      resolveExternalLinkUrl(
        { url: "https://fallback.example", urlFromVariable: "carrierBookUrl" },
        { carrierBookUrl: "https://tenant.example/book" }
      ),
      "https://tenant.example/book"
    );
  });

  it("falls back to props.url when variable is empty", () => {
    assert.equal(
      resolveExternalLinkUrl(
        { url: "https://fallback.example", urlFromVariable: "carrierBookUrl" },
        { carrierBookUrl: "  " }
      ),
      "https://fallback.example"
    );
  });

  it("returns empty when variable and url are both missing", () => {
    assert.equal(
      resolveExternalLinkUrl({ urlFromVariable: "carrierBookUrl" }, { carrierBookUrl: "" }),
      ""
    );
  });

  it("trims whitespace on both sources", () => {
    assert.equal(
      resolveExternalLinkUrl({ url: "  https://a.example  " }, {}),
      "https://a.example"
    );
  });
});

describe("isValidExternalLinkUrl", () => {
  it("accepts http and https", () => {
    assert.equal(isValidExternalLinkUrl("https://porter.in/"), true);
    assert.equal(isValidExternalLinkUrl("http://localhost:3000/x"), true);
  });

  it("rejects empty and non-http schemes", () => {
    assert.equal(isValidExternalLinkUrl(""), false);
    assert.equal(isValidExternalLinkUrl("javascript:alert(1)"), false);
    assert.equal(isValidExternalLinkUrl("not-a-url"), false);
  });
});

describe("coerceOpenInNewTab", () => {
  it("keeps booleans and defaults", () => {
    assert.equal(coerceOpenInNewTab(true), true);
    assert.equal(coerceOpenInNewTab(false), false);
    assert.equal(coerceOpenInNewTab(undefined), true);
    assert.equal(coerceOpenInNewTab("false"), false);
    assert.equal(coerceOpenInNewTab("true"), true);
  });
});

describe("ExternalLinkWidget contract", () => {
  const runtime = { context: { variables: {} } } as unknown as UIRuntime;

  it("validate never blocks completion", () => {
    const r = ExternalLinkWidget.validate(runtime, { url: "" });
    assert.equal(r.ok, true);
  });

  it("collectPayload returns empty object", () => {
    assert.deepEqual(ExternalLinkWidget.collectPayload(runtime, { url: "https://x.example" }), {});
  });
});

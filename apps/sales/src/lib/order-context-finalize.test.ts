import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure helpers mirrored for unit test without Prisma.
 * Keep in sync with asAttachmentList logic in order-context-finalize.ts
 */
function asAttachmentList(payload: unknown): { url?: string; fileUrl?: string; name?: string }[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const raw = p.attachments;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as {
    url?: string;
    fileUrl?: string;
    name?: string;
  }[];
}

describe("order-context-finalize payload parsing", () => {
  it("reads attachments array from complete payload", () => {
    const list = asAttachmentList({
      attachments: [{ url: "/uploads/a.pdf", name: "a.pdf" }, { fileUrl: "/uploads/b.png" }],
    });
    assert.equal(list.length, 2);
    assert.equal(list[0]!.url, "/uploads/a.pdf");
  });

  it("ignores missing attachments", () => {
    assert.equal(asAttachmentList({ remarks: "x" }).length, 0);
    assert.equal(asAttachmentList(null).length, 0);
  });
});

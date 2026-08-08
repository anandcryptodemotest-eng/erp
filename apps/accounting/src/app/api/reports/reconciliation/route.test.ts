import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

function request(query: string, tenantId?: string) {
  return new NextRequest(`http://localhost/api/reports/reconciliation${query}`,
    tenantId ? { headers: { "x-tenant-id": tenantId } } : undefined);
}

test("requires a tenant header before querying accounting data", async () => {
  const response = await GET(request(""));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Tenant required" });
});

test("rejects malformed report dates", async () => {
  const response = await GET(request("?from=not-a-date", "tenant-a"));

  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, "string");
});

test("rejects reversed report ranges", async () => {
  const response = await GET(request("?from=2026-08-02T00:00:00.000Z&to=2026-08-01T23:59:59.999Z", "tenant-a"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "from must be before to" });
});

test("rejects report ranges longer than 366 days", async () => {
  const response = await GET(request("?from=2025-01-01T00:00:00.000Z&to=2026-01-03T00:00:00.000Z", "tenant-a"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Report range cannot exceed 366 days" });
});

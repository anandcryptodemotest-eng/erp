import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

function request(headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/audit", { headers });
}

test("requires tenant and authenticated user context", async () => {
  const response = await GET(request());

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("rejects roles without audit access", async () => {
  const response = await GET(request({
    "x-tenant-id": "tenant-a",
    "x-user-id": "user-a",
    "x-user-role": "SALES_EXECUTIVE",
  }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Audit access required" });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createToken } from "@erp/auth";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const params = Promise.resolve({ id: "tenant-b" });

async function tenantRequest() {
  const token = await createToken({ userId: "user-a", tenantId: "tenant-a", role: "ADMIN", modules: [] });
  return new NextRequest("http://localhost/api/tenants/tenant-b/roles", { headers: { authorization: `Bearer ${token}` } });
}

test("rejects unauthenticated role access", async () => {
  const response = await GET(new NextRequest("http://localhost/api/tenants/tenant-b/roles"), { params });
  assert.equal(response.status, 401);
});

test("rejects wrong-tenant role reads", async () => {
  const response = await GET(await tenantRequest(), { params });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Tenant access denied" });
});

test("rejects wrong-tenant role writes before parsing body", async () => {
  const response = await POST(await tenantRequest(), { params });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Tenant access denied" });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createToken } from "@erp/auth";
import { NextRequest } from "next/server";
import { GET } from "./route";

const params = Promise.resolve({ id: "tenant-b" });

test("rejects an unauthenticated tenant-user request", async () => {
  const response = await GET(new NextRequest("http://localhost/api/tenants/tenant-b/users"), { params });

  assert.equal(response.status, 401);
});

test("rejects a JWT issued for another tenant before querying membership", async () => {
  const token = await createToken({
    userId: "user-a",
    tenantId: "tenant-a",
    role: "ADMIN",
    modules: [],
  });
  const request = new NextRequest("http://localhost/api/tenants/tenant-b/users", {
    headers: { authorization: `Bearer ${token}` },
  });
  const response = await GET(request, { params });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Tenant access denied" });
});
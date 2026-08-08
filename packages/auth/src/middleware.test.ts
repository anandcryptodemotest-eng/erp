import assert from "node:assert/strict";
import { test } from "node:test";
import { createServiceMiddleware } from "./middleware";
import { platformRequest, serviceRequest, tenantRequest, unauthenticatedRequest } from "./test-fixtures";

process.env.JWT_SECRET = "auth-test-jwt-secret";
process.env.SERVICE_SECRET = "auth-test-service-secret";

const middleware = createServiceMiddleware("sales");

async function status(request: Request) {
  return (await middleware(request as never)).status;
}

test("rejects unauthenticated service requests", async () => {
  assert.equal(await status(unauthenticatedRequest()), 401);
});

test("accepts the configured service key", async () => {
  assert.equal(await status(serviceRequest()), 200);
});

test("accepts a tenant JWT for the owning module", async () => {
  assert.equal(await status(await tenantRequest({ modules: ["sales"] })), 200);
});

test("rejects a tenant JWT without the licensed module", async () => {
  assert.equal(await status(await tenantRequest({ modules: ["inventory"] })), 403);
});

test("accepts a platform operator JWT with explicit tenant context", async () => {
  assert.equal(await status(await platformRequest({ tenantId: "target-tenant" })), 200);
});

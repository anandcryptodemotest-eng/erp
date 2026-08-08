import assert from "node:assert/strict";
import { test } from "node:test";

process.env.SERVICE_SECRET = "service-client-test-secret";

const originalFetch = globalThis.fetch;

test("propagates service authentication and tenant/request context", async () => {
  let captured: RequestInit | undefined;
  globalThis.fetch = async (_input, init) => {
    captured = init;
    return new Response(JSON.stringify({ data: { accepted: true } }), { status: 200 });
  };

  try {
    const { ServiceClient } = await import("./service-client");
    const client = new ServiceClient();
    const result = await client.call("inventory", "/api/stock/reserve", {
      method: "POST",
      tenantId: "tenant-a",
      userId: "user-a",
      role: "ADMIN",
      requestId: "request-a",
      body: { productId: "product-a", quantity: 2 },
    });

    assert.equal(result.status, 200);
    const headers = captured?.headers as Record<string, string>;
    assert.equal(headers["x-service-key"], "service-client-test-secret");
    assert.equal(headers["x-tenant-id"], "tenant-a");
    assert.equal(headers["x-user-id"], "user-a");
    assert.equal(headers["x-user-role"], "ADMIN");
    assert.equal(headers["x-request-id"], "request-a");
    assert.deepEqual(JSON.parse(String(captured?.body)), { productId: "product-a", quantity: 2 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("normalizes an unavailable downstream service to 503", async () => {
  globalThis.fetch = async () => {
    throw new Error("connection refused");
  };

  try {
    const { ServiceClient } = await import("./service-client");
    const result = await new ServiceClient().call("accounting", "/api/invoices");
    assert.deepEqual(result, { error: "Service accounting unavailable", status: 503 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

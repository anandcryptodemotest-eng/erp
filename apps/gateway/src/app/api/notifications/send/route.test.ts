import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "./route";

test("send requires auth context", async () => {
  const response = await POST(new NextRequest("http://localhost/api/notifications/send", { method: "POST" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Auth context required" });
});

test("send rejects invalid command for staff", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/notifications/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-a",
        "x-user-id": "user-a",
        "x-user-role": "ADMIN",
      },
      body: JSON.stringify({ type: "X" }),
    })
  );
  assert.equal(response.status, 400);
  const json = (await response.json()) as { error: string };
  assert.match(json.error, /title is required|Body must be a JSON object|recipients/i);
});

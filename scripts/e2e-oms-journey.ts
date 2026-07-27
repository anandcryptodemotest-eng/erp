/**
 * E2E OMS journey — Customer places order, then each internal persona advances to CLOSED.
 *
 *   pnpm reset:oms && pnpm e2e:oms
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const TENANT = process.env.TENANT_SLUG ?? "simhapuri-fresh";

type LoginResult = { token: string; tenantId: string; role: string; email: string };

const users = {
  customer: { email: "customer@oms.test", password: "Test@123" },
  admin: { email: "admin@simhapurifresh.com", password: "Admin@123" },
  sales: { email: "sales@oms.test", password: "Test@123" },
  pricing: { email: "pricing@oms.test", password: "Test@123" },
  dispatch: { email: "dispatch@oms.test", password: "Test@123" },
  delivery: { email: "delivery@oms.test", password: "Test@123" },
};

let pass = 0;
let fail = 0;

function ok(name: string) {
  pass++;
  console.log(`  [PASS] ${name}`);
}

function bad(name: string, detail?: string) {
  fail++;
  console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(
  method: string,
  path: string,
  opts: { token?: string; tenantId?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["x-tenant-id"] = opts.tenantId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: { data?: unknown; error?: string; meta?: unknown } = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function login(email: string, password: string): Promise<LoginResult> {
  const { status, json } = await api("POST", "/api/auth", {
    body: { action: "login", email, password, tenantSlug: TENANT },
  });
  if (status !== 200 || !json.data) {
    throw new Error(`Login failed for ${email}: ${status} ${json.error ?? ""}`);
  }
  const data = json.data as {
    accessToken: string;
    tenant: { id: string };
    user: { role: string; email: string };
  };
  return {
    token: data.accessToken,
    tenantId: data.tenant.id,
    role: data.user.role,
    email: data.user.email,
  };
}

async function expectStatus(
  name: string,
  method: string,
  path: string,
  auth: LoginResult,
  body: unknown | undefined,
  expectHttp: number | number[],
  assert?: (data: unknown) => void
) {
  const allowed = Array.isArray(expectHttp) ? expectHttp : [expectHttp];
  const { status, json } = await api(method, path, {
    token: auth.token,
    tenantId: auth.tenantId,
    body,
  });
  if (!allowed.includes(status)) {
    bad(name, `HTTP ${status} ${json.error ?? JSON.stringify(json).slice(0, 160)}`);
    return null;
  }
  try {
    assert?.(json.data);
    ok(name);
    return json.data;
  } catch (e) {
    bad(name, e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function main() {
  console.log("\n=== E2E OMS Journey (Customer → … → Closed) ===\n");
  console.log(`Base: ${BASE}\n`);

  console.log("TC1 — Login as each persona (incl. end customer)");
  const sessions: Record<string, LoginResult> = {};
  for (const [key, creds] of Object.entries(users)) {
    try {
      sessions[key] = await login(creds.email, creds.password);
      ok(`login ${key} (${sessions[key].role})`);
    } catch (e) {
      bad(`login ${key}`, e instanceof Error ? e.message : String(e));
    }
  }
  if (
    !sessions.customer ||
    !sessions.admin ||
    !sessions.sales ||
    !sessions.pricing ||
    !sessions.dispatch ||
    !sessions.delivery
  ) {
    console.log("\nAborting — missing logins. Run: pnpm reset:oms\n");
    process.exit(1);
  }

  console.log("\nTC2 — Customer portal profile + catalog");
  const me = (await expectStatus(
    "Customer GET /customers/me",
    "GET",
    "/api/customers/me",
    sessions.customer,
    undefined,
    200,
    (data) => {
      const c = data as { name?: string; portalUserId?: string; addresses?: unknown[] };
      if (c.name !== "BuildRight Contractors") throw new Error(`unexpected name ${c.name}`);
      if (!c.addresses?.length) throw new Error("expected delivery address");
    }
  )) as { id: string; addresses: { id: string }[] } | null;

  const products = (await expectStatus(
    "Customer lists products",
    "GET",
    "/api/products?limit=10",
    sessions.customer,
    undefined,
    200
  )) as { id: string; name: string; sellPrice: number; sku: string }[] | null;

  const product = products?.find((p) => p.sku === "PLY-BWR-18-8X4") ?? products?.[0];
  if (!me?.id || !product) {
    bad("missing customer profile or product");
    process.exit(1);
  }

  console.log("\nTC3 — Customer places order (auto-submit for sales review)");
  const order = (await expectStatus(
    "Customer places order → PENDING_SALES_REVIEW",
    "POST",
    "/api/orders",
    sessions.customer,
    {
      date: new Date().toISOString(),
      isOnlineOrder: true,
      submitForReview: true,
      deliveryAddressId: me.addresses[0]?.id,
      paymentMethod: "COD",
      items: [
        {
          productId: product.id,
          productName: product.name,
          quantity: 10,
          unitPrice: product.sellPrice,
        },
      ],
    },
    201,
    (data) => {
      const o = data as { status: string; isOnlineOrder: boolean };
      if (o.status !== "PENDING_SALES_REVIEW") throw new Error(`status ${o.status}`);
      if (!o.isOnlineOrder) throw new Error("expected isOnlineOrder");
    }
  )) as { id: string; items: { id: string; quantity: number }[] } | null;

  if (!order?.id) {
    console.log("\nAborting — no order\n");
    process.exit(1);
  }
  const orderId = order.id;

  // Customer cannot run sales actions
  {
    const { status } = await api("PATCH", `/api/orders/${orderId}?action=review`, {
      token: sessions.customer.token,
      tenantId: sessions.customer.tenantId,
      body: { remarks: "hack" },
    });
    if (status === 403) ok("Customer blocked from review action");
    else bad("Customer blocked from review action", `HTTP ${status}`);
  }

  async function patch(
    who: LoginResult,
    action: string,
    body: unknown,
    expect: string,
    label: string
  ) {
    return expectStatus(
      label,
      "PATCH",
      `/api/orders/${orderId}?action=${encodeURIComponent(action)}`,
      who,
      body ?? {},
      [200, 201],
      (data) => {
        const o = data as { status: string };
        if (o.status !== expect) throw new Error(`expected ${expect} got ${o.status}`);
      }
    );
  }

  console.log("\nTC4 — Sales: review → verify stock");
  const detail = (await expectStatus(
    "Sales opens customer order",
    "GET",
    `/api/orders/${orderId}`,
    sessions.sales,
    undefined,
    200
  )) as { items: { id: string; quantity: number }[]; status: string } | null;

  if (detail?.status !== "PENDING_SALES_REVIEW") {
    bad("order waiting for sales", `status ${detail?.status}`);
  } else {
    ok("order in sales review queue");
  }

  const lineId = detail?.items?.[0]?.id;
  if (!lineId) {
    bad("missing order line");
    process.exit(1);
  }

  await patch(sessions.sales, "review", { remarks: "E2E sales review" }, "REVIEWED", "Sales review");
  await patch(
    sessions.sales,
    "verify-stock",
    { items: [{ orderItemId: lineId, availableQty: 10 }], remarks: "Full stock" },
    "PRICING_PENDING",
    "Sales verify-stock → PRICING_PENDING"
  );

  console.log("\nTC5 — Pricing");
  await patch(
    sessions.pricing,
    "complete-pricing",
    {
      items: [{ orderItemId: lineId, purchasePrice: 1200, unitPrice: product.sellPrice }],
      transportationCharge: 500,
    },
    "PRICING_COMPLETED",
    "Pricing complete-pricing"
  );

  console.log("\nTC6 — Dispatch");
  await patch(sessions.dispatch, "ready-dispatch", {}, "READY_FOR_DISPATCH", "Dispatch ready-dispatch");
  await patch(
    sessions.dispatch,
    "dispatch",
    { vehicleInfo: "TN-01-AB-1234", assignedDriverId: "driver-1" },
    "DISPATCHED",
    "Dispatch dispatch"
  );

  console.log("\nTC7 — Delivery");
  await patch(sessions.delivery, "deliver-oms", {}, "DELIVERED", "Delivery deliver-oms");
  await patch(sessions.delivery, "close", {}, "CLOSED", "Delivery close");

  console.log("\nTC8 — Customer sees CLOSED on their order only");
  await expectStatus(
    "Customer GET own order CLOSED",
    "GET",
    `/api/orders/${orderId}`,
    sessions.customer,
    undefined,
    200,
    (data) => {
      const o = data as { status: string; nextActions?: unknown[] };
      if (o.status !== "CLOSED") throw new Error(`status ${o.status}`);
      if (o.nextActions && o.nextActions.length > 0) throw new Error("customer should not see nextActions");
    }
  );

  await expectStatus(
    "Customer order list includes CLOSED order",
    "GET",
    "/api/orders?limit=20",
    sessions.customer,
    undefined,
    200,
    (data) => {
      const list = data as { id: string; status: string }[];
      if (!list.some((o) => o.id === orderId && o.status === "CLOSED")) {
        throw new Error("order missing from customer list");
      }
    }
  );

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

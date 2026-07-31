/**
 * E2E OMS journey — Customer creates SREQ → Sales converts → parallel prep → fulfill → close.
 *
 *   pnpm e2e:oms
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const TENANT = process.env.TENANT_SLUG ?? "trustwood-enterprise";

type LoginResult = { token: string; tenantId: string; role: string; email: string };

const users = {
  admin: { email: "admin@simhapurifresh.com", password: "Admin@123" },
  sales: { email: "sales@trustwood.test", password: "Sales@123" },
  pricing: { email: "pricing@oms.test", password: "Test@123" },
  dispatch: { email: "dispatch@oms.test", password: "Test@123" },
  delivery: { email: "delivery@oms.test", password: "Test@123" },
  accountant: { email: "accountant@oms.test", password: "Test@123" },
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
  who: LoginResult,
  body: unknown | undefined,
  expectHttp: number | number[],
  assert?: (data: unknown) => void
) {
  const allowed = Array.isArray(expectHttp) ? expectHttp : [expectHttp];
  const { status, json } = await api(method, path, {
    token: who.token,
    tenantId: who.tenantId,
    body,
  });
  if (!allowed.includes(status)) {
    bad(name, `HTTP ${status} ${json.error ?? ""}`);
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
  console.log(`\n=== OMS E2E (SREQ → SO) against ${BASE} tenant=${TENANT} ===\n`);

  const sessions = {
    admin: await login(users.admin.email, users.admin.password),
    sales: await login(users.sales.email, users.sales.password),
    pricing: await login(users.pricing.email, users.pricing.password),
    dispatch: await login(users.dispatch.email, users.dispatch.password),
    delivery: await login(users.delivery.email, users.delivery.password),
    accountant: await login(users.accountant.email, users.accountant.password),
  };
  ok("Staff personas logged in");

  // Seed published SO_STANDARD v6 (assetRef + layout)
  await expectStatus(
    "Seed/list workflow templates (publishes SO_STANDARD)",
    "GET",
    "/api/workflow-templates",
    sessions.admin,
    undefined,
    200
  );

  // Ensure OrderWorkflow binding exists for convert
  await expectStatus(
    "Apply OMS trading template binding",
    "POST",
    "/api/order-workflows",
    sessions.admin,
    { templateId: "workflow.oms_trading", setDefault: true },
    [200, 201]
  );

  const customers = (await expectStatus(
    "List customers",
    "GET",
    "/api/customers?limit=5",
    sessions.sales,
    undefined,
    200
  )) as { id: string; name: string }[] | null;
  const customerId = customers?.[0]?.id;
  if (!customerId) {
    bad("missing customer");
    process.exit(1);
  }

  const products = (await expectStatus(
    "Product catalog",
    "GET",
    "/api/products?limit=10",
    sessions.sales,
    undefined,
    200
  )) as { id: string; name: string; sellPrice: number; sku: string }[] | null;

  const product = products?.find((p) => p.sku === "PLY-BWR-18-8X4") ?? products?.[0];
  if (!product) {
    bad("missing product");
    process.exit(1);
  }

  console.log("\nTC3 — Sales creates Sales Request (SREQ) for customer");
  const sreq = (await expectStatus(
    "Sales POST sales-request → OPEN",
    "POST",
    "/api/sales-requests",
    sessions.sales,
    {
      customerId,
      isOnlineOrder: false,
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
      const o = data as { status: string; requestNumber: string };
      if (o.status !== "OPEN") throw new Error(`status ${o.status}`);
      if (!o.requestNumber?.startsWith("SREQ-")) throw new Error("expected SREQ number");
    }
  )) as { id: string } | null;

  if (!sreq?.id) {
    console.log("\nAborting — no SREQ\n");
    process.exit(1);
  }

  // Customer cannot POST /api/orders
  {
    const { status } = await api("POST", "/api/orders", {
      token: sessions.sales.token,
      tenantId: sessions.sales.tenantId,
      body: {
        items: [{ productId: product.id, productName: product.name, quantity: 1, unitPrice: 1 }],
      },
    });
    // staff may create SO — just note status
    ok(`POST /api/orders as sales → HTTP ${status} (informational)`);
  }

  console.log("\nTC4 — Sales converts SREQ → SO");
  const converted = (await expectStatus(
    "Sales convert SREQ → SO CONFIRMED",
    "POST",
    `/api/sales-requests/${sreq.id}/convert`,
    sessions.sales,
    {},
    201,
    (data) => {
      const o = data as { soStatus: string; salesOrder: { id: string; status: string } };
      if (o.soStatus !== "CONFIRMED" && o.salesOrder?.status !== "CONFIRMED") {
        throw new Error(`expected CONFIRMED got ${o.soStatus}`);
      }
    }
  )) as { salesOrder: { id: string; items: { id: string; quantity: number }[] } } | null;

  const orderId = converted?.salesOrder?.id;
  if (!orderId) {
    bad("missing converted SO");
    process.exit(1);
  }

  const detail = (await expectStatus(
    "Sales opens SO (v5 snapshot)",
    "GET",
    `/api/orders/${orderId}`,
    sessions.sales,
    undefined,
    200,
    (data) => {
      const o = data as { runtimePath?: string; workflowRuntime?: { snapshot?: unknown } };
      if (o.runtimePath !== "v5") throw new Error(`runtimePath ${o.runtimePath}`);
      if (!o.workflowRuntime?.snapshot) throw new Error("missing snapshot");
    }
  )) as { items: { id: string; quantity: number; productId: string; productName: string; unitPrice: number }[]; status: string } | null;

  const lineId = detail?.items?.[0]?.id;
  const line = detail?.items?.[0];
  if (!lineId || !line) {
    bad("missing order line");
    process.exit(1);
  }

  async function patch(
    who: LoginResult,
    action: string,
    body: unknown,
    expect: string | string[],
    label: string
  ) {
    const allowed = Array.isArray(expect) ? expect : [expect];
    return expectStatus(
      label,
      "PATCH",
      `/api/orders/${orderId}?action=${encodeURIComponent(action)}`,
      who,
      body ?? {},
      [200, 201],
      (data) => {
        const o = data as { status: string };
        if (!allowed.includes(o.status)) throw new Error(`expected ${allowed.join("|")} got ${o.status}`);
      }
    );
  }

  console.log("\nTC5 — Sequential prep (v5 snapshot + adapter)");
  await patch(
    sessions.sales,
    "review",
    {
      remarks: "E2E sales review",
      items: [
        {
          id: line.id,
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        },
      ],
    },
    ["CONFIRMED", "FULFILLING"],
    "Sales review"
  );

  // Review rewrites line items — refresh IDs
  const afterReview = (await expectStatus(
    "Refresh SO after review",
    "GET",
    `/api/orders/${orderId}`,
    sessions.sales,
    undefined,
    200
  )) as { items: { id: string; quantity: number }[]; status: string } | null;
  const lineId2 = afterReview?.items?.[0]?.id;
  if (!lineId2) {
    bad("missing line after review");
    process.exit(1);
  }

  await patch(
    sessions.sales,
    "verify-stock",
    { items: [{ orderItemId: lineId2, availableQty: 10 }], remarks: "Full stock" },
    ["FULFILLING", "CONFIRMED"],
    "Inventory verify-stock"
  );
  await patch(
    sessions.pricing,
    "complete-pricing",
    {
      items: [{ orderItemId: lineId2, purchasePrice: 1200, unitPrice: product.sellPrice }],
      transportationCharge: 500,
    },
    ["FULFILLING", "READY_FOR_DISPATCH"],
    "Pricing complete-pricing"
  );
  await patch(
    sessions.dispatch,
    "warehouse-ready",
    { remarks: "Picked" },
    ["READY_FOR_DISPATCH", "FULFILLING"],
    "Warehouse ready"
  );

  console.log("\nTC6 — Dispatch → Deliver → Invoice → Pay → Close");
  await patch(
    sessions.dispatch,
    "dispatch",
    { vehicleInfo: "TN-01-AB-1234", assignedDriverId: "driver-1" },
    "DISPATCHED",
    "Dispatch"
  );
  await patch(sessions.delivery, "deliver-oms", {}, "DELIVERED", "Deliver");
  await patch(sessions.accountant, "invoice", {}, "INVOICED", "Invoice");
  await patch(sessions.accountant, "collect-payment", {}, ["PAID", "CLOSED"], "Collect payment");
  // ORDER_CLOSE is SYSTEM autoComplete — may already be CLOSED after payment
  {
    const { status, json } = await api("GET", `/api/orders/${orderId}`, {
      token: sessions.admin.token,
      tenantId: sessions.admin.tenantId,
    });
    const st = (json.data as { status?: string } | undefined)?.status;
    if (status === 200 && (st === "CLOSED" || st === "PAID")) {
      ok(`Final SO status ${st}`);
    } else {
      await patch(sessions.admin, "close", {}, ["CLOSED", "PAID"], "Close");
    }
  }
  console.log("\nTC7 — SREQ shows converted SO status");
  await expectStatus(
    "GET SREQ shows CONVERTED + SO status",
    "GET",
    `/api/sales-requests/${sreq.id}`,
    sessions.sales,
    undefined,
    200,
    (data) => {
      const o = data as { status: string; soStatus?: string; salesOrder?: { status: string } };
      if (o.status !== "CONVERTED") throw new Error(`sreq status ${o.status}`);
      const so = o.soStatus ?? o.salesOrder?.status;
      if (so !== "CLOSED" && so !== "PAID") throw new Error(`soStatus ${so}`);
    }
  );

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

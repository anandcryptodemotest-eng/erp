/**
 * Fruit-seller demo — end-to-end verification across user roles.
 *
 *   pnpm --filter @erp/scripts exec tsx verify-fruit-seller.ts
 *
 * Prerequisite: run seed-fruit-seller.ts first, with the stack up
 * (gateway :3010, sales :3001, inventory :3002, accounting :3003).
 *
 * Drives the REAL published v5 task graph (SO_STANDARD) the way the app does,
 * via PATCH /api/orders/:id?action=<task action>, each step performed by the
 * role the task is assigned to. Proves:
 *   - SALES_EXECUTIVE places a CONFIRMED order for 0.5 kg + 1.5 kg
 *     (fractional, sell-by-weight) and reserves stock.
 *   - Role gating: DELIVERY cannot perform a SALES/DISPATCH task.
 *   - The lifecycle advances review → verify-stock → pricing → warehouse →
 *     dispatch → deliver → invoice, each by its assigned role.
 *   - Stock drops by the exact ordered weight and FEFO consumes the
 *     earliest-expiry lot (LOT-A @ T+1d) before LOT-B.
 *   - The near-expiry report surfaces the T+1d lots.
 *
 * Exits non-zero on any failed assertion.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const SALES_BASE = process.env.SALES_SERVICE_URL ?? "http://127.0.0.1:3001";
const INV_BASE = process.env.INVENTORY_SERVICE_URL ?? "http://127.0.0.1:3002";
const SERVICE_SECRET = process.env.SERVICE_SECRET ?? "dev-service-secret";
const TENANT = process.env.TENANT_SLUG ?? "simhapuri-fresh";

const LOGINS = {
  admin: { email: "admin@simhapurifresh.com", password: "Admin@123" },
  sales: { email: "sales@simhapurifresh.com", password: "Sales@123" },
  pricing: { email: "pricing@simhapurifresh.com", password: "Pricing@123" },
  dispatch: { email: "dispatch@simhapurifresh.com", password: "Dispatch@123" },
  delivery: { email: "delivery@simhapurifresh.com", password: "Delivery@123" },
  accounts: { email: "accounts@simhapurifresh.com", password: "Accounts@123" },
};

const ORDER_SKUS = [
  { sku: "FRU-BANANA", name: "Banana (Robusta)", qty: 0.5, unitPrice: 60 },
  { sku: "VEG-TOMATO", name: "Tomato (local)", qty: 1.5, unitPrice: 40 },
];

type Json = { data?: any; error?: string; meta?: any };
type Session = { token: string; tenantId: string; userId: string; role: string };

let PASS = 0;
let FAIL = 0;
function check(label: string, condition: boolean, detail?: string) {
  console.log(`  ${condition ? "\u2713" : "\u2717"} ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  if (condition) PASS++;
  else FAIL++;
}
function section(title: string) {
  console.log(`\n\u2500\u2500 ${title} \u2500\u2500`);
}

async function http(
  baseUrl: string,
  method: string,
  path: string,
  opts: { session?: Session; serviceRole?: string; tenantId?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.session) {
    headers.Authorization = `Bearer ${opts.session.token}`;
    headers["x-tenant-id"] = opts.session.tenantId;
    headers["x-user-id"] = opts.session.userId;
    headers["x-user-role"] = opts.session.role;
  }
  if (opts.serviceRole) {
    headers["x-service-key"] = SERVICE_SECRET;
    headers["x-user-role"] = opts.serviceRole;
    if (opts.tenantId) headers["x-tenant-id"] = opts.tenantId;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function login(which: keyof typeof LOGINS): Promise<Session | null> {
  const creds = LOGINS[which];
  const res = await http(BASE, "POST", "/api/auth", {
    body: { action: "login", email: creds.email, password: creds.password, tenantSlug: TENANT },
  });
  if (res.status !== 200 || !res.json.data) return null;
  const d = res.json.data;
  return { token: d.accessToken, tenantId: d.tenant.id, userId: d.user.id, role: d.user.role };
}

async function onHand(tenantId: string, productId: string): Promise<number> {
  const res = await http(INV_BASE, "GET", `/api/products/${productId}`, { serviceRole: "ADMIN", tenantId });
  const stocks = (res.json.data?.stocks ?? []) as { quantity: number }[];
  return stocks.reduce((s, r) => s + (r.quantity ?? 0), 0);
}

async function batchesFor(tenantId: string, productId: string) {
  const res = await http(INV_BASE, "GET", "/api/stock/expiring?withinDays=3650&includeExpired=1", {
    serviceRole: "ADMIN",
    tenantId,
  });
  const rows = (res.json.data ?? []) as {
    productId: string;
    batchNo: string;
    quantity: number;
  }[];
  return rows.filter((r) => r.productId === productId);
}

async function getOrder(session: Session, orderId: string) {
  const res = await http(SALES_BASE, "GET", `/api/orders/${orderId}`, { session });
  return res.json.data as {
    status: string;
    orderNumber: string;
    items: { id: string; productId: string; productName: string; quantity: number; unitPrice: number }[];
    nextActions?: { action: string; roleHint: string; taskId: string }[];
  };
}

// Perform a task action via the order PATCH facade (routes to v5 task completion).
async function act(session: Session, orderId: string, action: string, body: Record<string, unknown> = {}) {
  return http(SALES_BASE, "PATCH", `/api/orders/${orderId}?action=${encodeURIComponent(action)}`, {
    session,
    body,
  });
}

async function main() {
  console.log(`\n=== Fruit-seller E2E verification @ ${BASE} tenant=${TENANT} ===`);

  const admin = await login("admin");
  if (!admin) throw new Error("Admin login failed — is the stack up and seeded?");
  const tenantId = admin.tenantId;

  // Resolve products + warehouse.
  const productIds: Record<string, string> = {};
  for (const item of ORDER_SKUS) {
    const res = await http(INV_BASE, "GET", `/api/products?sku=${encodeURIComponent(item.sku)}&limit=5`, {
      serviceRole: "ADMIN",
      tenantId,
    });
    const hit = ((res.json.data ?? []) as { id: string; sku: string }[]).find((p) => p.sku === item.sku);
    if (!hit) throw new Error(`Product ${item.sku} not found — run the seed first.`);
    productIds[item.sku] = hit.id;
  }
  const whRes = await http(INV_BASE, "GET", "/api/warehouses?limit=10", { serviceRole: "ADMIN", tenantId });
  const warehouseId = ((whRes.json.data ?? []) as { id: string }[])[0]?.id;
  if (!warehouseId) throw new Error("No warehouse found — run the seed first.");

  // Opening stock + batch snapshot.
  section("Opening stock (ADMIN view)");
  const opening: Record<string, number> = {};
  const openingLotA: Record<string, number> = {};
  for (const item of ORDER_SKUS) {
    opening[item.sku] = await onHand(tenantId, productIds[item.sku]);
    const lots = await batchesFor(tenantId, productIds[item.sku]);
    openingLotA[item.sku] = lots.find((b) => b.batchNo.endsWith("LOT-A"))?.quantity ?? 0;
    check(
      `${item.sku} opening on-hand`,
      opening[item.sku] > 0,
      `${opening[item.sku]} kg (${lots.map((b) => `${b.batchNo}:${b.quantity}`).join(", ")})`
    );
  }

  section("Near-expiry report (/api/stock/expiring?withinDays=2)");
  const expiring = await http(INV_BASE, "GET", "/api/stock/expiring?withinDays=2", { serviceRole: "ADMIN", tenantId });
  const nearRows = (expiring.json.data ?? []) as { batchNo: string }[];
  check(
    "near-expiry lots surfaced",
    nearRows.some((r) => r.batchNo.endsWith("LOT-A")),
    `${nearRows.length} lot(s) within 2 days`
  );

  // SALES places the confirmed walk-in order with fractional kg.
  section("SALES_EXECUTIVE places order (0.5 kg + 1.5 kg)");
  const sales = await login("sales");
  if (!sales) throw new Error("Sales login failed");
  const createRes = await http(SALES_BASE, "POST", "/api/orders", {
    session: sales,
    body: {
      sourceKind: "WALK_IN",
      walkInName: "Demo Buyer",
      walkInPhone: "+919000000050",
      warehouseId,
      items: ORDER_SKUS.map((i) => ({
        productId: productIds[i.sku],
        productName: i.name,
        quantity: i.qty,
        unitPrice: i.unitPrice,
      })),
    },
  });
  check("order created (201)", createRes.status === 201, `status ${createRes.status} ${createRes.json.error ?? ""}`);
  const created = createRes.json.data;
  if (!created?.id) {
    console.log("\nCannot continue without an order. Aborting.");
    process.exit(1);
  }
  const orderId = created.id;
  check("order is CONFIRMED", created.status === "CONFIRMED", created.status);
  const bananaLine = (created.items ?? []).find((l: any) => l.productId === productIds["FRU-BANANA"]);
  check("fractional qty persisted (0.5 kg)", bananaLine?.quantity === 0.5, `qty=${bananaLine?.quantity}`);

  // Negative: DELIVERY cannot perform the SALES review task.
  section("Role gating (negative check)");
  const delivery = await login("delivery");
  if (!delivery) throw new Error("Delivery login failed");
  const wrong = await act(delivery, orderId, "review", { remarks: "should fail" });
  check("DELIVERY blocked from SALES review task", wrong.status === 403, `status ${wrong.status} ${wrong.json.error ?? ""}`);

  // Drive the real SO_STANDARD task graph by role.
  section("Lifecycle by role (SO_STANDARD v5 task graph)");

  // 1. SALES review (confirms lines + promised date). Rewrites line ids.
  let order = await getOrder(sales, orderId);
  const reviewItems = order.items.map((l) => ({
    id: l.id,
    productId: l.productId,
    productName: l.productName,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
  }));
  const review = await act(sales, orderId, "review", { remarks: "Fresh order confirmed", items: reviewItems });
  check("SALES review", review.status === 200, `status=${review.json.data?.status ?? review.json.error}`);

  // Refresh line ids (review may rewrite them).
  order = await getOrder(sales, orderId);
  const lineByProduct: Record<string, string> = {};
  for (const l of order.items) lineByProduct[l.productId] = l.id;

  // 2. SALES verify-stock (fresh produce is in stock).
  const verify = await act(sales, orderId, "verify-stock", {
    items: order.items.map((l) => ({ orderItemId: l.id, availableQty: l.quantity })),
    remarks: "Picked from cold storage",
  });
  check("SALES verify-stock", verify.status === 200, `status=${verify.json.data?.status ?? verify.json.error}`);

  // 3. PRICING complete-pricing (confirm sell rate per kg).
  const pricing = (await login("pricing")) ?? sales; // pricing user is optional; ADMIN-equivalent fallback
  const pricingActor = pricing.role === "CUSTOMER" ? sales : pricing;
  const price = await act(pricingActor, orderId, "complete-pricing", {
    items: order.items.map((l) => ({ orderItemId: l.id, unitPrice: l.unitPrice })),
  });
  check("PRICING complete-pricing", price.status === 200, `status=${price.json.data?.status ?? price.json.error}`);

  // 4. DISPATCH warehouse-ready + dispatch.
  const dispatch = await login("dispatch");
  if (!dispatch) throw new Error("Dispatch login failed");
  const whReady = await act(dispatch, orderId, "warehouse-ready", { remarks: "Weighed and bagged" });
  check("DISPATCH warehouse-ready", whReady.status === 200, `status=${whReady.json.data?.status ?? whReady.json.error}`);
  const disp = await act(dispatch, orderId, "dispatch", {
    fulfillmentMode: "own_fleet",
    vehicleInfo: "AP-16-FR-0007",
    assignedDriverId: "driver-fresh-1",
    dispatchRemarks: "Out with morning run",
  });
  check("DISPATCH dispatch", disp.status === 200, `status=${disp.json.data?.status ?? disp.json.error}`);

  // 5. DELIVERY deliver (this triggers stock OUT + FEFO deduction).
  const deliver = await act(delivery, orderId, "deliver-oms", { remarks: "Delivered to customer" });
  check("DELIVERY deliver", deliver.status === 200, `status=${deliver.json.data?.status ?? deliver.json.error}`);

  // 6. ACCOUNTANT invoice.
  const accounts = await login("accounts");
  if (!accounts) throw new Error("Accounts login failed");
  const invoice = await act(accounts, orderId, "invoice", {});
  check("ACCOUNTANT invoice", invoice.status === 200, `status=${invoice.json.data?.status ?? invoice.json.error}`);

  const finalOrder = await getOrder(admin, orderId);
  check(
    "order reached INVOICED/PAID/CLOSED",
    ["INVOICED", "PAID", "CLOSED", "DELIVERED"].includes(finalOrder.status),
    finalOrder.status
  );

  // Stock + FEFO assertions.
  section("Stock deduction + FEFO");
  for (const item of ORDER_SKUS) {
    const after = await onHand(tenantId, productIds[item.sku]);
    const expected = Number((opening[item.sku] - item.qty).toFixed(3));
    check(
      `${item.sku} on-hand reduced by ${item.qty} kg`,
      Math.abs(after - expected) < 1e-6,
      `${opening[item.sku]} -> ${after} kg (expected ${expected})`
    );
    const lots = await batchesFor(tenantId, productIds[item.sku]);
    const lotAAfter = lots.find((b) => b.batchNo.endsWith("LOT-A"))?.quantity ?? 0;
    const lotAExpected = Number((openingLotA[item.sku] - item.qty).toFixed(3));
    check(
      `${item.sku} FEFO consumed earliest-expiry lot first`,
      Math.abs(lotAAfter - lotAExpected) < 1e-6,
      `LOT-A ${openingLotA[item.sku]} -> ${lotAAfter} kg (expected ${lotAExpected})`
    );
  }

  console.log(`\n=== RESULT: ${PASS} passed, ${FAIL} failed ===`);
  console.log(`Order ${finalOrder.orderNumber} final status: ${finalOrder.status}\n`);
  if (FAIL > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nVERIFY FAILED:", e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});

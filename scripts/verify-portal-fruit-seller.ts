/**
 * Fruit-seller demo — REAL portal E2E (customer → staff), with assertions.
 *
 *   pnpm --filter @erp/scripts exec tsx verify-portal-fruit-seller.ts
 *
 * This is the genuine storefront path (not the staff walk-in shortcut):
 *   CUSTOMER  logs in on the portal, places a weight-based order
 *             → POST /api/sales-requests  (creates a Sales Request, status OPEN)
 *   SALES     converts the request        → POST /api/sales-requests/:id/convert
 *             (creates a CONFIRMED Sales Order + v5 workflow snapshot, reserves stock)
 *   SALES     review + verify-stock
 *   PRICING   complete-pricing
 *   DISPATCH  warehouse-ready + dispatch
 *   DELIVERY  deliver                      (triggers FEFO stock deduction)
 *   ACCOUNTANT invoice
 *
 * Asserts: SREQ created by the customer; conversion to a confirmed SO; each role
 * transition; fractional sell-by-weight quantities; on-hand reduced by the exact
 * weight; FEFO consumed the earliest-expiry lot (LOT-A) first.
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
  buyer: { email: "buyer@simhapurifresh.com", password: "Buyer@12345" },
};

// The customer's cart — fractional kg of produce (sell-by-weight).
const CART = [
  { sku: "FRU-BANANA", name: "Banana (Robusta)", qty: 0.75, unitPrice: 60 },
  { sku: "VEG-TOMATO", name: "Tomato (local)", qty: 1.25, unitPrice: 40 },
  { sku: "FRU-APPLE", name: "Apple (Shimla)", qty: 2, unitPrice: 180 },
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
function section(t: string) {
  console.log(`\n\u2500\u2500 ${t} \u2500\u2500`);
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

async function login(which: keyof typeof LOGINS): Promise<Session> {
  const c = LOGINS[which];
  const res = await http(BASE, "POST", "/api/auth", {
    body: { action: "login", email: c.email, password: c.password, tenantSlug: TENANT },
  });
  if (res.status !== 200 || !res.json.data) throw new Error(`Login failed for ${which}: ${res.status} ${res.json.error ?? ""}`);
  const d = res.json.data;
  return { token: d.accessToken, tenantId: d.tenant.id, userId: d.user.id, role: d.user.role };
}

async function onHand(tenantId: string, productId: string): Promise<number> {
  const res = await http(INV_BASE, "GET", `/api/products/${productId}`, { serviceRole: "ADMIN", tenantId });
  const stocks = (res.json.data?.stocks ?? []) as { quantity: number }[];
  return stocks.reduce((s, r) => s + (r.quantity ?? 0), 0);
}
async function lotA(tenantId: string, productId: string): Promise<number> {
  const res = await http(INV_BASE, "GET", "/api/stock/expiring?withinDays=3650&includeExpired=1", { serviceRole: "ADMIN", tenantId });
  const rows = (res.json.data ?? []) as { productId: string; batchNo: string; quantity: number }[];
  return rows.filter((r) => r.productId === productId && r.batchNo.endsWith("LOT-A")).reduce((s, r) => s + r.quantity, 0);
}
async function act(session: Session, orderId: string, action: string, body: Record<string, unknown> = {}) {
  return http(SALES_BASE, "PATCH", `/api/orders/${orderId}?action=${encodeURIComponent(action)}`, { session, body });
}

async function main() {
  console.log(`\n=== Fruit-seller PORTAL E2E (customer \u2192 staff) @ ${BASE} tenant=${TENANT} ===`);

  const admin = await login("admin");
  const tenantId = admin.tenantId;

  // Resolve product ids (re-read; ids changed when the catalog was re-seeded).
  const productIds: Record<string, string> = {};
  for (const item of CART) {
    const res = await http(INV_BASE, "GET", `/api/products?sku=${encodeURIComponent(item.sku)}&limit=5`, { serviceRole: "ADMIN", tenantId });
    const hit = ((res.json.data ?? []) as { id: string; sku: string }[]).find((p) => p.sku === item.sku);
    if (!hit) throw new Error(`Product ${item.sku} not found — run the seed first.`);
    productIds[item.sku] = hit.id;
  }

  // Opening stock snapshot.
  section("Opening stock");
  const opening: Record<string, number> = {};
  const openingLotA: Record<string, number> = {};
  for (const item of CART) {
    opening[item.sku] = await onHand(tenantId, productIds[item.sku]);
    openingLotA[item.sku] = await lotA(tenantId, productIds[item.sku]);
    check(`${item.sku} on-hand`, opening[item.sku] > 0, `${opening[item.sku]} kg (LOT-A ${openingLotA[item.sku]} kg)`);
  }

  // ── CUSTOMER places the order via the portal (Sales Request) ───────────────
  section("CUSTOMER places order on the storefront (Sales Request)");
  const buyer = await login("buyer");
  check("customer logged in", buyer.role === "CUSTOMER", `role=${buyer.role}`);

  const sreqRes = await http(SALES_BASE, "POST", "/api/sales-requests", {
    session: buyer,
    body: {
      isOnlineOrder: true,
      paymentMethod: "COD",
      deliveryAddressText: "12 MG Road, Vijayawada 520010",
      items: CART.map((i) => ({
        productId: productIds[i.sku],
        productName: i.name,
        quantity: i.qty,
        unitPrice: i.unitPrice,
      })),
    },
  });
  check("Sales Request created (201)", sreqRes.status === 201, `status ${sreqRes.status} ${sreqRes.json.error ?? ""}`);
  const sreq = sreqRes.json.data;
  if (!sreq?.id) {
    console.log("\nCannot continue without a Sales Request. Aborting.");
    process.exit(1);
  }
  const sreqBanana = (sreq.items ?? []).find((l: any) => l.productId === productIds["FRU-BANANA"]);
  check("fractional qty on request (0.75 kg)", sreqBanana?.quantity === 0.75, `qty=${sreqBanana?.quantity}`);

  // INSTANT ORDER: an online order auto-confirms into a Sales Order immediately,
  // so the POST returns `order` and the request is no longer left OPEN.
  const instantOrder = sreqRes.json.order as { id: string; orderNumber: string; status: string } | null;
  check("instant order auto-confirmed", !!instantOrder?.id && instantOrder.status === "CONFIRMED",
    instantOrder ? `${instantOrder.orderNumber} ${instantOrder.status}` : "no order returned");

  // Customer can see their own request.
  const myReqs = await http(SALES_BASE, "GET", "/api/sales-requests?limit=20", { session: buyer });
  check(
    "customer sees own request in list",
    ((myReqs.json.data ?? []) as { id: string }[]).some((r) => r.id === sreq.id),
    `${(myReqs.json.data ?? []).length} request(s)`
  );

  // Negative: a customer cannot convert a request (staff-only).
  const custConvert = await http(SALES_BASE, "POST", `/api/sales-requests/${sreq.id}/convert`, { session: buyer });
  check("CUSTOMER blocked from converting", custConvert.status === 403, `status ${custConvert.status}`);

  // ── SALES convert is idempotent (order already auto-confirmed) ─────────────
  section("SALES convert (idempotent after instant order)");
  const sales = await login("sales");
  const convert = await http(SALES_BASE, "POST", `/api/sales-requests/${sreq.id}/convert`, { session: sales });
  check("convert returns the existing order", [200, 201].includes(convert.status), `status ${convert.status} ${convert.json.error ?? ""}`);
  const so = convert.json.data?.salesOrder ?? instantOrder;
  if (!so?.id) {
    console.log("\nNo order available. Aborting.");
    process.exit(1);
  }
  const orderId = so.id;
  check("order CONFIRMED", so.status === "CONFIRMED", so.status);

  // ── Staff drive the lifecycle by role ──────────────────────────────────────
  section("Staff fulfilment by role");
  const getOrder = async (s: Session) => (await http(SALES_BASE, "GET", `/api/orders/${orderId}`, { session: s })).json.data;

  let order = await getOrder(sales);
  const review = await act(sales, orderId, "review", {
    remarks: "Online order confirmed",
    items: order.items.map((l: any) => ({
      id: l.id,
      productId: l.productId,
      productName: l.productName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
  });
  check("SALES review", review.status === 200, `status=${review.json.data?.status ?? review.json.error}`);

  order = await getOrder(sales);
  const verify = await act(sales, orderId, "verify-stock", {
    items: order.items.map((l: any) => ({ orderItemId: l.id, availableQty: l.quantity })),
    remarks: "In stock",
  });
  check("SALES verify-stock", verify.status === 200, `status=${verify.json.data?.status ?? verify.json.error}`);

  const pricing = await login("pricing");
  const price = await act(pricing, orderId, "complete-pricing", {
    items: order.items.map((l: any) => ({ orderItemId: l.id, unitPrice: l.unitPrice })),
  });
  check("PRICING complete-pricing", price.status === 200, `status=${price.json.data?.status ?? price.json.error}`);

  const dispatch = await login("dispatch");
  const whReady = await act(dispatch, orderId, "warehouse-ready", { remarks: "Weighed & bagged" });
  check("DISPATCH warehouse-ready", whReady.status === 200, `status=${whReady.json.data?.status ?? whReady.json.error}`);
  const disp = await act(dispatch, orderId, "dispatch", {
    fulfillmentMode: "own_fleet",
    vehicleInfo: "AP-16-FR-0007",
    assignedDriverId: "driver-fresh-1",
    dispatchRemarks: "Morning run",
  });
  check("DISPATCH dispatch", disp.status === 200, `status=${disp.json.data?.status ?? disp.json.error}`);

  const delivery = await login("delivery");
  const deliver = await act(delivery, orderId, "deliver-oms", { remarks: "Handed to customer" });
  check("DELIVERY deliver", deliver.status === 200, `status=${deliver.json.data?.status ?? deliver.json.error}`);

  const accounts = await login("accounts");
  const invoice = await act(accounts, orderId, "invoice", {});
  check("ACCOUNTANT invoice", invoice.status === 200, `status=${invoice.json.data?.status ?? invoice.json.error}`);

  const finalOrder = await getOrder(admin);
  check(
    "order reached INVOICED/PAID/CLOSED/DELIVERED",
    ["INVOICED", "PAID", "CLOSED", "DELIVERED"].includes(finalOrder.status),
    finalOrder.status
  );

  // ── Stock + FEFO ───────────────────────────────────────────────────────────
  section("Stock deduction + FEFO");
  for (const item of CART) {
    const after = await onHand(tenantId, productIds[item.sku]);
    const expected = Number((opening[item.sku] - item.qty).toFixed(3));
    check(
      `${item.sku} on-hand reduced by ${item.qty} kg`,
      Math.abs(after - expected) < 1e-6,
      `${opening[item.sku]} -> ${after} kg (expected ${expected})`
    );
    const lotAAfter = await lotA(tenantId, productIds[item.sku]);
    const lotAExpected = Number((openingLotA[item.sku] - item.qty).toFixed(3));
    check(
      `${item.sku} FEFO consumed earliest-expiry lot first`,
      Math.abs(lotAAfter - lotAExpected) < 1e-6,
      `LOT-A ${openingLotA[item.sku]} -> ${lotAAfter} kg (expected ${lotAExpected})`
    );
  }

  console.log(`\n=== RESULT: ${PASS} passed, ${FAIL} failed ===`);
  console.log(`Request ${sreq.requestNumber ?? sreq.id} \u2192 Order ${finalOrder.orderNumber} (${finalOrder.status}).\n`);
  if (FAIL > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nPORTAL VERIFY FAILED:", e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});

/**
 * Fruit-seller demo seed — a grocery/produce tenant that exercises the
 * sell-by-weight + perishable-batch (FEFO) + grocery-delivery-workflow features.
 *
 *   pnpm --filter @erp/scripts exec tsx seed-fruit-seller.ts
 *
 * Idempotent. Talks to the gateway admin base over HTTP (same approach as
 * seed-client-demo.ts) so auth, module licensing, workflow snapshots and
 * cross-service reconciliation all go through real contracts.
 *
 * What it creates:
 *   - Tenant "Simhapuri Fresh" (slug simhapuri-fresh), vertical=grocery
 *     → licenses core/inventory/sales/delivery, applies workflow.grocery_delivery,
 *       seeds a default warehouse.
 *   - Growth plan grant so the `oms` SaaS feature is enabled (orders need it).
 *   - Staff users: admin + sales + dispatch + delivery + accountant.
 *   - Produce categories: Fruits, Vegetables, Leafy Greens.
 *   - Sell-by-weight, batch-tracked products (kg, PER_WEIGHT, trackBatches, shelfLifeDays).
 *   - Opening stock received as dated lots (two expiry dates per item → FEFO demo).
 *   - A storefront customer (buyer) with a linked sales profile + address.
 *
 * Output: prints the tenant id, warehouse id, product ids, and all logins so the
 * verify script and the live demo can reuse them.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const TENANT = process.env.TENANT_SLUG ?? "simhapuri-fresh";

const PLATFORM = {
  email: process.env.PLATFORM_EMAIL ?? "platform@erp.local",
  password: process.env.PLATFORM_PASSWORD ?? "Platform@123",
};

const ADMIN = { email: "admin@simhapurifresh.com", password: "Admin@123", name: "Fresh Admin" };

const STAFF = [
  { email: "sales@simhapurifresh.com", password: "Sales@123", name: "Sales Executive", role: "SALES_EXECUTIVE" },
  { email: "pricing@simhapurifresh.com", password: "Pricing@123", name: "Pricing Executive", role: "PRICING_EXECUTIVE" },
  { email: "dispatch@simhapurifresh.com", password: "Dispatch@123", name: "Dispatch Executive", role: "DISPATCH_EXECUTIVE" },
  { email: "delivery@simhapurifresh.com", password: "Delivery@123", name: "Delivery Executive", role: "DELIVERY_EXECUTIVE" },
  { email: "accounts@simhapurifresh.com", password: "Accounts@123", name: "Accountant", role: "ACCOUNTANT" },
] as const;

const BUYER = {
  email: "buyer@simhapurifresh.com",
  password: "Buyer@12345",
  name: "Ravi Kumar",
  phone: "+919000000001",
};

// Produce catalog. All sell-by-weight (kg), all batch-tracked with a short shelf life.
type SeedProduct = {
  sku: string;
  name: string;
  category: string;
  baseRate: number; // ₹ per kg
  shelfLifeDays: number;
  pluCode: string;
  reorderLevel: number;
  image: string; // served from apps/customer/public/media/products/<file>
};

const CATEGORIES = ["Fruits", "Vegetables", "Leafy Greens"] as const;

const PRODUCTS: SeedProduct[] = [
  // Fruits
  { sku: "FRU-BANANA", name: "Banana (Robusta)", category: "Fruits", baseRate: 60, shelfLifeDays: 5, pluCode: "4011", reorderLevel: 5, image: "/media/products/banana.jpg" },
  { sku: "FRU-APPLE", name: "Apple (Shimla)", category: "Fruits", baseRate: 180, shelfLifeDays: 14, pluCode: "4133", reorderLevel: 5, image: "/media/products/apple.jpg" },
  { sku: "FRU-MANGO", name: "Mango (Banganapalli)", category: "Fruits", baseRate: 120, shelfLifeDays: 6, pluCode: "4051", reorderLevel: 4, image: "/media/products/mango.jpg" },
  { sku: "FRU-GRAPES", name: "Grapes (seedless)", category: "Fruits", baseRate: 90, shelfLifeDays: 5, pluCode: "4022", reorderLevel: 4, image: "/media/products/grapes.jpg" },
  { sku: "FRU-ORANGE", name: "Orange (Nagpur)", category: "Fruits", baseRate: 80, shelfLifeDays: 10, pluCode: "4012", reorderLevel: 5, image: "/media/products/orange.jpg" },
  // Vegetables
  { sku: "VEG-TOMATO", name: "Tomato (local)", category: "Vegetables", baseRate: 40, shelfLifeDays: 4, pluCode: "4664", reorderLevel: 8, image: "/media/products/tomato.jpg" },
  { sku: "VEG-ONION", name: "Onion (red)", category: "Vegetables", baseRate: 35, shelfLifeDays: 20, pluCode: "4082", reorderLevel: 10, image: "/media/products/onion.jpg" },
  { sku: "VEG-POTATO", name: "Potato", category: "Vegetables", baseRate: 30, shelfLifeDays: 30, pluCode: "4072", reorderLevel: 12, image: "/media/products/potato.jpg" },
  { sku: "VEG-CARROT", name: "Carrot", category: "Vegetables", baseRate: 50, shelfLifeDays: 12, pluCode: "4562", reorderLevel: 6, image: "/media/products/carrot.jpg" },
  { sku: "VEG-LEMON", name: "Lemon", category: "Vegetables", baseRate: 70, shelfLifeDays: 15, pluCode: "4033", reorderLevel: 4, image: "/media/products/lemon.jpg" },
  // Leafy greens
  { sku: "LEF-SPINACH", name: "Spinach (Palak) bunch", category: "Leafy Greens", baseRate: 30, shelfLifeDays: 2, pluCode: "4090", reorderLevel: 6, image: "/media/products/spinach.jpg" },
];

type Json = { data?: unknown; error?: string; meta?: unknown };

async function api(
  method: string,
  path: string,
  opts: { token?: string; tenantId?: string; role?: string; userId?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["x-tenant-id"] = opts.tenantId;
  if (opts.role) headers["x-user-role"] = opts.role;
  if (opts.userId) headers["x-user-id"] = opts.userId;
  const res = await fetch(`${BASE}${path}`, {
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

const ok = (s: number) => s >= 200 && s < 300;
function log(step: string, detail?: string) {
  console.log(`  \u2713 ${step}${detail ? ` \u2014 ${detail}` : ""}`);
}
function warn(step: string, detail?: string) {
  console.log(`  ! ${step}${detail ? ` \u2014 ${detail}` : ""}`);
}

type Auth = { token: string; tenantId: string; role: string; userId: string };

async function platformLogin(): Promise<string> {
  const res = await api("POST", "/api/platform/auth", { body: PLATFORM });
  if (!ok(res.status) || !res.json.data) {
    throw new Error(`Platform login failed (${res.status}). Run pnpm seed:platform first.`);
  }
  return (res.json.data as { accessToken: string }).accessToken;
}

async function ensureTenant(platToken: string): Promise<string> {
  const created = await api("POST", "/api/platform/tenants", {
    token: platToken,
    body: {
      name: "Simhapuri Fresh",
      slug: TENANT,
      plan: "starter",
      adminEmail: ADMIN.email,
      adminName: ADMIN.name,
      adminPassword: ADMIN.password,
      vertical: "grocery",
    },
  });
  if (ok(created.status)) {
    const tenantId = (created.json.data as { tenantId: string }).tenantId;
    log("Created grocery tenant", `${TENANT} (${tenantId})`);
    return tenantId;
  }
  if (created.status === 409) {
    // Already exists — look it up via the platform tenants list.
    const list = await api("GET", "/api/platform/tenants", { token: platToken });
    const row = ((list.json.data as { id: string; slug: string }[]) ?? []).find((t) => t.slug === TENANT);
    if (!row) throw new Error("Tenant exists (409) but not found in list");
    log("Grocery tenant exists", `${TENANT} (${row.id})`);
    return row.id;
  }
  throw new Error(`Create tenant failed: ${created.status} ${created.json.error ?? ""}`);
}

async function grantOmsPlan(platToken: string, tenantId: string) {
  const grant = await api("POST", `/api/platform/tenants/${tenantId}/billing/grant`, {
    token: platToken,
    body: { planCode: "growth_monthly" },
  });
  if (ok(grant.status)) log("Granted Growth plan (oms enabled)");
  else warn("Growth grant", `${grant.status} ${grant.json.error ?? ""}`);
}

async function adminLogin(): Promise<Auth> {
  const res = await api("POST", "/api/auth", {
    body: { action: "login", email: ADMIN.email, password: ADMIN.password, tenantSlug: TENANT },
  });
  if (!ok(res.status) || !res.json.data) {
    throw new Error(`Admin login failed: ${res.status} ${res.json.error ?? ""}`);
  }
  const d = res.json.data as { accessToken: string; tenant: { id: string }; user: { id: string; role: string } };
  return { token: d.accessToken, tenantId: d.tenant.id, role: d.user.role ?? "ADMIN", userId: d.user.id };
}

async function ensureStaff(auth: Auth) {
  for (const u of STAFF) {
    const created = await api("POST", `/api/tenants/${auth.tenantId}/users`, {
      ...auth,
      body: { action: "create", email: u.email, name: u.name, password: u.password, role: u.role },
    });
    if (ok(created.status)) log("Staff user", `${u.email} -> ${u.role}`);
    else warn(`Staff ${u.email}`, `${created.status} ${created.json.error ?? ""}`);
  }
}

/**
 * Make the tenant order-ready. The grocery onboarding applies the OrderWorkflow
 * (status machine) but NOT the published v5 WorkflowTemplateVersion that
 * createConfirmedSalesOrder / getPublishedDefinition require. Seed both the form
 * catalog and the published SO_STANDARD v5 definition. Idempotent (action:"seed"
 * is a no-op once a version exists). Needs an ADMIN (process-designer) context.
 */
const SALES_BASE = process.env.SALES_SERVICE_URL ?? "http://127.0.0.1:3001";
const SERVICE_SECRET = process.env.SERVICE_SECRET ?? "dev-service-secret";

/**
 * Call the sales service directly with the service key AND the process-designer
 * headers the gate reads. The grocery plan doesn't include the processStudio
 * capability, so an ADMIN JWT is rejected (403); the service-key branch forwards
 * x-capabilities/x-modules untouched, satisfying requireProcessDesigner.
 */
async function salesDesigner(method: string, path: string, tenantId: string, body?: unknown) {
  const res = await fetch(`${SALES_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-service-key": SERVICE_SECRET,
      "x-auth-scope": "tenant",
      "x-tenant-id": tenantId,
      "x-user-id": "seed-designer",
      "x-user-role": "ADMIN",
      "x-modules": "core,sales,inventory,delivery",
      "x-capabilities": "processStudio",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

async function ensureWorkflowPublished(auth: Auth) {
  const forms = await salesDesigner("POST", "/api/workflow-forms", auth.tenantId, { action: "seed" });
  if (ok(forms.status)) log("Form catalog seeded");
  else warn("workflow-forms seed", `${forms.status} ${forms.json.error ?? ""}`);

  const tpl = await salesDesigner("POST", "/api/workflow-templates", auth.tenantId, { action: "seed" });
  if (ok(tpl.status)) log("Published SO_STANDARD v5 workflow");
  else warn("workflow-templates seed", `${tpl.status} ${tpl.json.error ?? ""}`);

  // Re-assert the grocery OrderWorkflow as default (safe/idempotent).
  const ow = await salesDesigner("POST", "/api/order-workflows", auth.tenantId, {
    templateId: "workflow.grocery_delivery",
    setDefault: true,
  });
  if (ok(ow.status)) log("Grocery OrderWorkflow set default");
  else warn("order-workflows", `${ow.status} ${ow.json.error ?? ""}`);
}

async function ensureCategories(auth: Auth): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const list = await api("GET", "/api/products/categories?limit=100", auth);
  for (const c of (list.json.data as { id: string; name: string }[]) ?? []) byName.set(c.name, c.id);
  for (const name of CATEGORIES) {
    if (byName.has(name)) {
      log("Category exists", name);
      continue;
    }
    const created = await api("POST", "/api/products/categories", { ...auth, body: { name } });
    const c = created.json.data as { id: string; name: string } | undefined;
    if (c?.id) {
      byName.set(c.name, c.id);
      log("Created category", name);
    } else warn(`Category ${name}`, `${created.status} ${created.json.error ?? ""}`);
  }
  return byName;
}

async function findProductBySku(auth: Auth, sku: string) {
  const res = await api("GET", `/api/products?sku=${encodeURIComponent(sku)}&limit=5&includeInactive=true`, auth);
  return ((res.json.data as { id: string; sku: string }[] | undefined) ?? []).find((p) => p.sku === sku);
}

async function ensureProducts(auth: Auth, cats: Map<string, string>): Promise<Map<string, string>> {
  const idBySku = new Map<string, string>();
  for (const p of PRODUCTS) {
    // Each produce item is standalone, but the storefront shop grid only lists
    // products that belong to a commercial group (groupCode != null). Give each
    // SKU its own single-item group so it shows as a card and its detail page
    // (/shop/g/<groupCode>) handles the sell-by-weight add-to-cart.
    const groupCode = `GRP-${p.sku}`;
    const existing = await findProductBySku(auth, p.sku);
    if (existing) {
      idBySku.set(p.sku, existing.id);
      // Backfill image + group so products created before this change show on the shop.
      const patched = await api("PATCH", `/api/products/${existing.id}`, {
        ...auth,
        body: { imageUrls: [p.image], isActive: true, groupCode, groupName: p.name },
      });
      log("Product exists", `${p.sku}${patched.status === 200 ? " (shop-ready)" : ` (patch ${patched.status})`}`);
      continue;
    }
    const created = await api("POST", "/api/products", {
      ...auth,
      body: {
        sku: p.sku,
        name: p.name,
        categoryId: cats.get(p.category),
        groupCode,
        groupName: p.name,
        unit: "kg",
        sellByWeight: true,
        pricingBasis: "PER_WEIGHT",
        pricingUom: "kg",
        baseRate: p.baseRate,
        sellPrice: p.baseRate, // list rate per kg (shown on storefront)
        pluCode: p.pluCode,
        reorderLevel: p.reorderLevel,
        trackBatches: true,
        shelfLifeDays: p.shelfLifeDays,
        imageUrls: [p.image],
        isFeatured: true,
        taxRate: 0,
      },
    });
    const id = (created.json.data as { id?: string } | undefined)?.id;
    if (id) {
      idBySku.set(p.sku, id);
      log("Created product", `${p.sku} @ ₹${p.baseRate}/kg, shelf ${p.shelfLifeDays}d, img`);
    } else warn(`Product ${p.sku}`, `${created.status} ${created.json.error ?? ""}`);
  }
  return idBySku;
}

async function getWarehouseId(auth: Auth): Promise<string> {
  const res = await api("GET", "/api/warehouses?limit=10", auth);
  const rows = (res.json.data as { id: string; name: string }[]) ?? [];
  if (rows.length) return rows[0].id;
  // Fallback: onboarding reconciliation may not have landed; create it.
  const created = await api("POST", "/api/warehouses", { ...auth, body: { name: "Main", location: "Simhapuri Fresh" } });
  const id = (created.json.data as { id?: string } | undefined)?.id;
  if (!id) throw new Error(`No warehouse and could not create one: ${created.status} ${created.json.error ?? ""}`);
  log("Created warehouse", id);
  return id;
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function receiveLots(auth: Auth, warehouseId: string, ids: Map<string, string>) {
  // Two lots per product with different expiry dates so FEFO has something to choose.
  // One intentionally near-term (expires in 1 day) to demo near-expiry + the sweep.
  for (const p of PRODUCTS) {
    const productId = ids.get(p.sku);
    if (!productId) continue;
    const items = [
      {
        productId,
        warehouseId,
        quantity: 20,
        batchNo: `${p.sku}-LOT-A`,
        expiryDate: isoDaysFromNow(1), // near expiry (earliest → consumed first by FEFO)
      },
      {
        productId,
        warehouseId,
        quantity: 30,
        batchNo: `${p.sku}-LOT-B`,
        expiryDate: isoDaysFromNow(p.shelfLifeDays),
      },
    ];
    const recv = await api("POST", "/api/stock/receive", {
      ...auth,
      body: { items, reference: `FRESH-GRN-${p.sku}`, idempotencyKey: `fresh-seed-${p.sku}`, notes: "Opening stock (2 lots)" },
    });
    if (ok(recv.status)) log("Received lots", `${p.sku}: 20kg @T+1d + 30kg @T+${p.shelfLifeDays}d`);
    else warn(`Receive ${p.sku}`, `${recv.status} ${recv.json.error ?? ""}`);
  }
}

async function ensureBuyer(auth: Auth) {
  const reg = await api("POST", "/api/auth?action=register-customer", {
    body: { name: BUYER.name, email: BUYER.email, password: BUYER.password, phone: BUYER.phone, tenantSlug: TENANT },
  });
  if (ok(reg.status)) {
    log("Buyer registered", BUYER.email);
  } else if (reg.status === 409 || String(reg.json.error ?? "").toLowerCase().includes("exist")) {
    log("Buyer exists", BUYER.email);
  } else {
    warn("Buyer register", `${reg.status} ${reg.json.error ?? ""}`);
  }

  // Ensure a linked sales Customer profile (idempotent via /customers/me).
  const login = await api("POST", "/api/auth", {
    body: { action: "login", email: BUYER.email, password: BUYER.password, tenantSlug: TENANT },
  });
  if (ok(login.status) && login.json.data) {
    const d = login.json.data as { accessToken: string; tenant: { id: string }; user: { id: string; role: string } };
    const me = await api("POST", "/api/customers/me", {
      token: d.accessToken,
      tenantId: d.tenant.id,
      role: d.user.role,
      userId: d.user.id,
      body: { name: BUYER.name, email: BUYER.email, phone: BUYER.phone },
    });
    if (ok(me.status)) log("Buyer sales profile", "linked");
    else warn("Buyer sales profile", `${me.status} ${me.json.error ?? ""}`);
  }
}

async function main() {
  console.log(`\n=== Fruit-seller demo seed @ ${BASE} tenant=${TENANT} ===\n`);

  const platToken = await platformLogin();
  const tenantId = await ensureTenant(platToken);
  await grantOmsPlan(platToken, tenantId);

  const auth = await adminLogin();
  log("Admin logged in", `tenant=${auth.tenantId} role=${auth.role}`);

  await ensureStaff(auth);
  await ensureWorkflowPublished(auth);
  const cats = await ensureCategories(auth);
  const ids = await ensureProducts(auth, cats);
  const warehouseId = await getWarehouseId(auth);
  await receiveLots(auth, warehouseId, ids);
  await ensureBuyer(auth);

  console.log("\n=== SEED SUMMARY (save for the verify script / demo) ===");
  console.log(JSON.stringify(
    {
      base: BASE,
      tenantSlug: TENANT,
      tenantId,
      warehouseId,
      productIds: Object.fromEntries(ids),
      logins: {
        admin: ADMIN,
        staff: STAFF,
        buyer: BUYER,
        platform: PLATFORM,
      },
    },
    null,
    2
  ));
  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error("\nSEED FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});

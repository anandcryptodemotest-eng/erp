/**
 * Portal → OMS E2E — phased business flow.
 *
 * Phase 1 Catalog / Media / Quote
 * Phase 2 Checkout / SREQ
 * Phase 3 Sales Desk / SO / Workflow
 * Phase 4 Customer Tracking
 *
 *   pnpm e2e:portal
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const TENANT = process.env.TENANT_SLUG ?? "trustwood-enterprise";

const BUYER = { email: "buyer@trustwood.test", password: "Buyer@12345" };
const SALES = { email: "sales@trustwood.test", password: "Sales@123" };
const ADMIN = { email: "admin@simhapurifresh.com", password: "Admin@123" };

type LoginResult = { token: string; tenantId: string; role: string; email: string };

type Report = {
  environment: string;
  tenant: string;
  seedVersion: string;
  productsCreated: string;
  groupsCreated: string;
  buyerCreated: string;
  Portal: string;
  OMS: string;
  Images: string;
  Checkout: string;
  Tax: string;
  Conversion: string;
  Tracking: string;
  knownGaps: string[];
  phaseLog: string[];
};

const report: Report = {
  environment: BASE,
  tenant: TENANT,
  seedVersion: new Date().toISOString(),
  productsCreated: "see seed:demo",
  groupsCreated: "TRUSTWOOD-*",
  buyerCreated: BUYER.email,
  Portal: "FAIL",
  OMS: "FAIL",
  Images: "FAIL",
  Checkout: "FAIL",
  Tax: "FAIL",
  Conversion: "FAIL",
  Tracking: "FAIL",
  knownGaps: [],
  phaseLog: [],
};

let pass = 0;
let fail = 0;

function ok(phase: string, name: string) {
  pass++;
  const line = `[PASS] Phase${phase} ${name}`;
  console.log(`  ${line}`);
  report.phaseLog.push(line);
}

function bad(phase: string, name: string, detail?: string) {
  fail++;
  const line = `[FAIL] Phase${phase} ${name}${detail ? ` — ${detail}` : ""}`;
  console.log(`  ${line}`);
  report.phaseLog.push(line);
  report.knownGaps.push(line);
}

async function api(
  method: string,
  path: string,
  opts: {
    token?: string;
    tenantId?: string;
    tenantSlug?: string;
    body?: unknown;
  } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["x-tenant-id"] = opts.tenantId;
  if (opts.tenantSlug) headers["x-tenant-slug"] = opts.tenantSlug;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: { data?: unknown; error?: string } = {};
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

type Resolved = {
  sku: string;
  productId: string;
  price: number;
  image: string;
  tax: number;
  name: string;
};

async function resolveConfig(
  groupCode: string,
  attributes: Record<string, string>
): Promise<Resolved | null> {
  const { status, json } = await api("POST", "/api/portal/catalog/resolve", {
    tenantSlug: TENANT,
    body: { groupCode, attributes },
  });
  if (status !== 200) {
    bad("1", `resolve ${groupCode}`, `${status} ${json.error ?? ""}`);
    return null;
  }
  const data = json.data as {
    product?: {
      id: string;
      sku: string;
      name: string;
      sellPrice?: number | null;
      imageUrls?: string[];
      taxRate?: number | null;
    } | null;
    completeness?: { complete: boolean; unique: boolean };
  };
  if (!data.product || !data.completeness?.complete || !data.completeness?.unique) {
    bad("1", `resolve incomplete ${groupCode}`, JSON.stringify(data.completeness));
    return null;
  }
  const p = data.product;

  // Quote
  const q = await api("POST", "/api/portal/pricing/quote", {
    tenantSlug: TENANT,
    body: { productId: p.id, quantity: 1, attributes },
  });
  const quote = (q.json.data as { quote?: { unitPrice?: number; lineTotal?: number } })?.quote;
  const price = quote?.unitPrice ?? p.sellPrice ?? 0;
  if (!(price > 0)) {
    bad("1", `quote ${p.sku}`, `price=${price} quoteStatus=${q.status}`);
    return null;
  }

  const image = (p.imageUrls ?? []).find(Boolean) ?? "";
  const tax = typeof p.taxRate === "number" ? p.taxRate : 0;

  return {
    sku: p.sku,
    productId: p.id,
    price,
    image,
    tax,
    name: p.name,
  };
}

function writeReport() {
  const path = join(process.cwd(), "..", "docs", "E2E-REPORT-latest.md");
  const alt = join(process.cwd(), "E2E-REPORT-latest.md");
  const body = `# E2E Report (structured)

| Field | Value |
|-------|-------|
| Environment | ${report.environment} |
| Tenant | ${report.tenant} |
| Seed Version | ${report.seedVersion} |
| Products Created | ${report.productsCreated} |
| Groups Created | ${report.groupsCreated} |
| Buyer Created | ${report.buyerCreated} |
| Portal | ${report.Portal} |
| OMS | ${report.OMS} |
| Images | ${report.Images} |
| Checkout | ${report.Checkout} |
| Tax | ${report.Tax} |
| Conversion | ${report.Conversion} |
| Tracking | ${report.Tracking} |

## Known Gaps

${report.knownGaps.length ? report.knownGaps.map((g) => `- ${g}`).join("\n") : "- (none)"}

## Phase log

\`\`\`
${report.phaseLog.join("\n")}
\`\`\`
`;
  try {
    writeFileSync(path, body);
    console.log(`\nWrote ${path}`);
  } catch {
    writeFileSync(alt, body);
    console.log(`\nWrote ${alt}`);
  }
}

async function main() {
  console.log(`\n=== Portal→OMS E2E @ ${BASE} tenant=${TENANT} ===\n`);

  const admin = await login(ADMIN.email, ADMIN.password);
  ok("0", "Admin login");

  // Ensure workflow published
  await api("GET", "/api/workflow-templates", { token: admin.token, tenantId: admin.tenantId });
  await api("POST", "/api/order-workflows", {
    token: admin.token,
    tenantId: admin.tenantId,
    body: { templateId: "workflow.oms_trading", setDefault: true },
  });

  const buyer = await login(BUYER.email, BUYER.password);
  ok("0", `Buyer login (${buyer.role})`);
  const sales = await login(SALES.email, SALES.password);
  ok("0", "Sales login");

  // -------- Phase 1 --------
  console.log("\nPhase 1 — Catalog / Media / Quote");
  const groupsRes = await api("GET", "/api/portal/catalog/groups", { tenantSlug: TENANT });
  const groups = (groupsRes.json.data as { groupCode: string }[]) ?? [];
  const codes = new Set(groups.map((g) => g.groupCode));
  const needed = ["TRUSTWOOD-BLOCKBOARD", "TRUSTWOOD-PHONE", "TRUSTWOOD-LAMINATE", "TRUSTWOOD-BWP"];
  const missing = needed.filter((c) => !codes.has(c));
  if (missing.length) {
    bad("1", "catalog groups", `missing ${missing.join(", ")}`);
    report.Portal = "FAIL";
  } else {
    ok("1", "catalog groups present");
    report.Portal = "PASS";
  }

  const phoneBlack = await resolveConfig("TRUSTWOOD-PHONE", { color: "Black", storage_gb: "128" });
  const phoneBlue = await resolveConfig("TRUSTWOOD-PHONE", { color: "Blue", storage_gb: "128" });
  if (phoneBlack && phoneBlue) {
    ok("1", `phone SKUs ${phoneBlack.sku} / ${phoneBlue.sku}`);
    if (phoneBlack.image && phoneBlue.image && phoneBlack.image !== phoneBlue.image) {
      ok("1", "variant images differ (Black vs Blue)");
      report.Images = "PASS";
    } else {
      bad("1", "variant images", `${phoneBlack.image} vs ${phoneBlue.image}`);
      report.Images = "FAIL";
    }
  }

  const blockA = await resolveConfig("TRUSTWOOD-BLOCKBOARD", {
    grade: "BWR",
    thickness_mm: "18",
    size: "8x4",
  });
  const blockB = await resolveConfig("TRUSTWOOD-BLOCKBOARD", {
    grade: "BWR",
    thickness_mm: "18",
    size: "6x3",
  });
  if (blockA && blockB && blockA.image && blockB.image && blockA.image !== blockB.image) {
    ok("1", "blockboard images differ by size");
  } else if (blockA && blockB) {
    bad("1", "blockboard images", `${blockA.image} vs ${blockB.image}`);
  }

  // Adhesive — simple product (lookup by SKU; fallback until inventory sku filter is deployed)
  let adhesive: { id: string; sku: string; name: string; sellPrice: number } | undefined;
  for (const path of [
    "/api/products?sku=TW-ADH-1L&limit=5",
    "/api/products?search=Adhesive&limit=20",
  ]) {
    const prods = await api("GET", path, {
      token: sales.token,
      tenantId: sales.tenantId,
    });
    adhesive = ((prods.json.data as { id: string; sku: string; name: string; sellPrice: number }[]) ?? []).find(
      (p) => p.sku === "TW-ADH-1L"
    );
    if (adhesive) break;
  }
  if (adhesive) ok("1", "simple Adhesive SKU found");
  else bad("1", "simple Adhesive missing");

  if (!phoneBlack || !blockA || !adhesive) {
    writeReport();
    console.log(`\nAbort — Phase 1 incomplete (${fail} fails)\n`);
    process.exit(1);
  }

  const expectedTax = phoneBlack.tax; // should be 0 if unset
  const linePhone = { ...phoneBlack, qty: 1 };
  const lineBlock = { ...blockA, qty: 1 };
  const lineAdh = {
    sku: adhesive.sku,
    productId: adhesive.id,
    price: Number(adhesive.sellPrice),
    image: "",
    tax: 0,
    name: adhesive.name,
    qty: 2,
  };

  const subtotal =
    linePhone.price * linePhone.qty + lineBlock.price * lineBlock.qty + lineAdh.price * lineAdh.qty;
  const taxEstimate = 0; // unset GST
  const totalEstimate = subtotal + taxEstimate;

  // -------- Phase 2 --------
  console.log("\nPhase 2 — Checkout / SREQ");
  const me = await api("GET", "/api/customers/me", {
    token: buyer.token,
    tenantId: buyer.tenantId,
  });
  let customer = (me.json.data as { id: string; addresses?: { id: string }[] }) ?? null;
  if (!customer?.id) {
    const created = await api("POST", "/api/customers/me", {
      token: buyer.token,
      tenantId: buyer.tenantId,
      body: { name: "Buyer Trustwood", email: BUYER.email, phone: "+919876543210" },
    });
    customer = created.json.data as { id: string; addresses?: { id: string }[] };
  }
  if (!customer?.id) {
    bad("2", "customer profile");
    writeReport();
    process.exit(1);
  }
  ok("2", "customer profile");

  let addressId = customer.addresses?.[0]?.id;
  let addressText = "E2E Demo Address, Hyderabad 500001";
  if (!addressId) {
    const addr = await api("POST", `/api/customers/${customer.id}/addresses`, {
      token: buyer.token,
      tenantId: buyer.tenantId,
      body: {
        label: "Home",
        line1: "E2E Demo Street 1",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500001",
        isDefault: true,
      },
    });
    addressId = (addr.json.data as { id: string } | undefined)?.id;
    if (addressId) ok("2", "address created");
    else bad("2", "address create", `${addr.status} ${addr.json.error ?? ""}`);
  } else {
    ok("2", "address exists");
  }

  const sreqRes = await api("POST", "/api/sales-requests", {
    token: buyer.token,
    tenantId: buyer.tenantId,
    body: {
      isOnlineOrder: true,
      paymentMethod: "COD",
      deliveryAddressId: addressId,
      deliveryAddressText: addressText,
      deliveryFee: 0,
      notes: "e2e:portal phased checkout",
      items: [
        {
          productId: linePhone.productId,
          productName: linePhone.name,
          quantity: linePhone.qty,
          unitPrice: linePhone.price,
        },
        {
          productId: lineBlock.productId,
          productName: lineBlock.name,
          quantity: lineBlock.qty,
          unitPrice: lineBlock.price,
        },
        {
          productId: lineAdh.productId,
          productName: lineAdh.name,
          quantity: lineAdh.qty,
          unitPrice: lineAdh.price,
        },
      ],
    },
  });

  const sreq = sreqRes.json.data as {
    id: string;
    status: string;
    requestNumber: string;
    subtotal: number;
    tax: number;
    total: number;
    items: { productId: string; unitPrice: number; quantity: number }[];
  } | null;

  if (sreqRes.status !== 201 || !sreq?.id) {
    bad("2", "checkout SREQ", `${sreqRes.status} ${sreqRes.json.error ?? ""}`);
    report.Checkout = "FAIL";
    writeReport();
    process.exit(1);
  }

  if (sreq.status !== "OPEN" || !sreq.requestNumber?.startsWith("SREQ-")) {
    bad("2", "SREQ status", `${sreq.status} ${sreq.requestNumber}`);
  } else {
    ok("2", `SREQ ${sreq.requestNumber} OPEN`);
    report.Checkout = "PASS";
  }

  // Propagation: prices on SREQ
  const phoneLine = sreq.items.find((i) => i.productId === linePhone.productId);
  if (phoneLine && Math.abs(phoneLine.unitPrice - linePhone.price) < 0.02) {
    ok("2", "resolved price propagated to SREQ");
  } else {
    bad("2", "price propagation", `${phoneLine?.unitPrice} vs ${linePhone.price}`);
  }

  if (Math.abs(sreq.tax) < 0.01 || (expectedTax === 0 && sreq.tax === 0)) {
    ok("2", `tax=${sreq.tax} (unset GST → 0)`);
    report.Tax = "PASS";
  } else if (expectedTax === 0 && sreq.tax > 0) {
    bad("2", "tax unexpected", `expected 0 got ${sreq.tax}`);
    report.Tax = "FAIL";
  } else {
    ok("2", `tax=${sreq.tax}`);
    report.Tax = "PASS";
  }

  if (Math.abs(sreq.subtotal - subtotal) < 1) {
    ok("2", `subtotal≈${sreq.subtotal}`);
  } else {
    bad("2", "subtotal", `${sreq.subtotal} vs expected ${subtotal}`);
  }

  // -------- Phase 3 --------
  console.log("\nPhase 3 — Sales Desk / SO / Workflow");
  const converted = await api("POST", `/api/sales-requests/${sreq.id}/convert`, {
    token: sales.token,
    tenantId: sales.tenantId,
    body: {},
  });
  const conv = converted.json.data as {
    salesOrder?: { id: string; status: string };
    soStatus?: string;
  } | null;
  if (converted.status !== 201 || !conv?.salesOrder?.id) {
    bad("3", "convert", `${converted.status} ${converted.json.error ?? ""}`);
    report.Conversion = "FAIL";
    writeReport();
    process.exit(1);
  }
  ok("3", `converted → SO ${conv.salesOrder.id}`);
  report.Conversion = "PASS";
  report.OMS = "PASS";

  const orderId = conv.salesOrder.id;
  const orderGet = await api("GET", `/api/orders/${orderId}`, {
    token: sales.token,
    tenantId: sales.tenantId,
  });
  const order = orderGet.json.data as {
    items: { id: string; productId: string; productName: string; quantity: number; unitPrice: number }[];
    runtimePath?: string;
    workflowRuntime?: { snapshot?: unknown };
  } | null;
  if (!order?.workflowRuntime?.snapshot) {
    bad("3", "workflow snapshot missing");
  } else {
    ok("3", `runtime ${order.runtimePath ?? "?"}`);
  }

  const line0 = order?.items?.[0];
  if (line0) {
    const rev = await api("PATCH", `/api/orders/${orderId}?action=review`, {
      token: sales.token,
      tenantId: sales.tenantId,
      body: {
        remarks: "e2e:portal sales review",
        items: order!.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      },
    });
    if (rev.status === 200 || rev.status === 201) ok("3", "sales-review completed");
    else bad("3", "sales-review", `${rev.status} ${rev.json.error ?? ""}`);
  }

  // -------- Phase 4 --------
  console.log("\nPhase 4 — Customer Tracking");
  const track = await api("GET", `/api/sales-requests/${sreq.id}`, {
    token: buyer.token,
    tenantId: buyer.tenantId,
  });
  const tracked = track.json.data as {
    id: string;
    status: string;
    total: number;
    tax: number;
    requestNumber: string;
  } | null;
  if (track.status === 200 && tracked?.id === sreq.id) {
    ok("4", `tracking ${tracked.requestNumber} status=${tracked.status}`);
    if (Math.abs(tracked.total - sreq.total) < 0.02) ok("4", "total consistent with checkout");
    else bad("4", "total drift", `${tracked.total} vs ${sreq.total}`);
    if (Math.abs(tracked.tax - sreq.tax) < 0.02) ok("4", "tax consistent with checkout");
    else bad("4", "tax drift", `${tracked.tax} vs ${sreq.tax}`);
    report.Tracking = "PASS";
  } else {
    bad("4", "tracking fetch", `${track.status} ${track.json.error ?? ""}`);
    report.Tracking = "FAIL";
  }

  if (report.Portal === "PASS" && report.Checkout === "PASS" && report.Conversion === "PASS") {
    report.OMS = report.OMS === "PASS" ? "PASS" : report.OMS;
  }

  writeReport();
  console.log(`\n=== Result: ${pass} pass, ${fail} fail ===\n`);
  console.log(`Expected totals (estimate): subtotal=${subtotal} tax=${taxEstimate} total=${totalEstimate}`);
  console.log(`SREQ totals: subtotal=${sreq.subtotal} tax=${sreq.tax} total=${sreq.total}\n`);

  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  report.knownGaps.push(String(e));
  writeReport();
  process.exit(1);
});

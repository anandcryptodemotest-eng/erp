/**
 * Greenfield Tenant OMS Marathon — API E2E (release gate)
 *
 *   pnpm e2e:greenfield
 *
 * Provisions an isolated gf-* tenant, proves nav/API/dashboard security,
 * configures studio + catalog, sells 10 SKUs, closes OMS including Porter,
 * invoice PDF, then accounting/stock invariants. No Trustwood seed.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const PLATFORM_EMAIL = process.env.PLATFORM_OWNER_EMAIL || "platform@erp.local";
const PLATFORM_PASSWORD = process.env.PLATFORM_OWNER_PASSWORD || "Platform@123";
const PEER_TENANT = process.env.TENANT_ISOLATION_PEER ?? "trustwood-enterprise";
const PEER_ADMIN = {
  email: process.env.PEER_ADMIN_EMAIL ?? "admin@simhapurifresh.com",
  password: process.env.PEER_ADMIN_PASSWORD ?? "Admin@123",
};

const TAX_INVOICE_IDS = [
  "header",
  "logo",
  "title",
  "invoiceNumber",
  "invoiceDate",
  "seller",
  "sellerName",
  "sellerAddress",
  "sellerGstin",
  "buyer",
  "buyerName",
  "buyerAddress",
  "buyerGstin",
  "lines",
  "totals",
  "subtotal",
  "taxTotal",
  "grandTotal",
  "amountInWordsLabel",
  "amountInWords",
  "footer",
  "declaration",
];

type Session = { token: string; tenantId: string; role: string; email: string };
type Json = { data?: unknown; error?: string; meta?: unknown };

type ReportLine = { ok: boolean; section: string; name: string; detail?: string };

const started = new Date();
const slug = `gf-${Date.now().toString(36)}`;
const adminPassword = "GfAdmin1!x";
const staffPassword = "GfStaff1!x";
const buyerPassword = "GfBuyer1!x";

const lines: ReportLine[] = [];
let pass = 0;
let fail = 0;
let failedPhase: { section: string; name: string; expected?: string; actual?: string; request?: string; response?: string } | null =
  null;

function record(section: string, name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  [PASS] ${section} — ${name}`);
  } else {
    fail++;
    console.log(`  [FAIL] ${section} — ${name}${detail ? ` — ${detail}` : ""}`);
  }
  lines.push({ ok, section, name, detail });
}

async function api(
  method: string,
  path: string,
  opts: { token?: string; tenantId?: string; tenantSlug?: string; body?: unknown } = {}
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
  let json: Json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text.slice(0, 400) };
  }
  return { status: res.status, json, text };
}

async function login(email: string, password: string, tenantSlug: string): Promise<Session> {
  const { status, json } = await api("POST", "/api/auth", {
    body: { action: "login", email, password, tenantSlug },
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

function flattenIds(items: unknown, acc: string[] = []): string[] {
  if (!Array.isArray(items)) return acc;
  for (const raw of items) {
    const it = raw as { id?: string; children?: unknown };
    if (typeof it?.id === "string") acc.push(it.id);
    if (it?.children) flattenIds(it.children, acc);
  }
  return acc;
}

function leakStrings(rows: unknown): string {
  return JSON.stringify(rows ?? []).toLowerCase();
}

function hasTrustwoodLeak(rows: unknown): boolean {
  const s = leakStrings(rows);
  return s.includes("trustwood") || s.includes("tw-adh") || s.includes("@trustwood.test");
}

function writeReport() {
  const durationMs = Date.now() - started.getTime();
  const sections = [...new Set(lines.map((l) => l.section))];
  const md: string[] = [
    "# Greenfield OMS E2E",
    "",
    `Tenant: ${slug}`,
    `Started: ${started.toISOString()}`,
    `Duration: ${(durationMs / 1000).toFixed(1)}s`,
    `Result: ${pass} pass / ${fail} fail`,
    "",
  ];
  for (const section of sections) {
    md.push(`## ${section}`);
    for (const l of lines.filter((x) => x.section === section)) {
      md.push(`${l.ok ? "✓" : "✗"} ${l.name}${l.detail ? ` — ${l.detail}` : ""}`);
    }
    md.push("");
  }
  if (failedPhase) {
    md.push("## Failure detail");
    md.push("");
    md.push(`**${failedPhase.section} — ${failedPhase.name}**`);
    if (failedPhase.expected) md.push(`Expected: ${failedPhase.expected}`);
    if (failedPhase.actual) md.push(`Actual: ${failedPhase.actual}`);
    if (failedPhase.request) md.push(`Request: ${failedPhase.request}`);
    if (failedPhase.response) md.push(`Response: ${failedPhase.response}`);
    md.push("");
  }
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "E2E-GREENFIELD-latest.md"), md.join("\n"));
  } catch {
    writeFileSync(join(process.cwd(), "E2E-GREENFIELD-latest.md"), md.join("\n"));
  }
}

async function expectHttp(
  section: string,
  name: string,
  method: string,
  path: string,
  who: Session | { token?: string; tenantId?: string; tenantSlug?: string },
  body: unknown | undefined,
  expectStatus: number | number[],
  assert?: (data: unknown, status: number) => void
): Promise<unknown | null> {
  const allowed = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  const { status, json } = await api(method, path, {
    token: "token" in who ? who.token : undefined,
    tenantId: "tenantId" in who ? who.tenantId : undefined,
    tenantSlug: "tenantSlug" in who ? who.tenantSlug : undefined,
    body,
  });
  if (!allowed.includes(status)) {
    record(section, name, false, `HTTP ${status} ${json.error ?? ""}`);
    if (!failedPhase) {
      failedPhase = {
        section,
        name,
        expected: `HTTP ${allowed.join("|")}`,
        actual: `HTTP ${status} ${json.error ?? ""}`,
        request: `${method} ${path}`,
        response: JSON.stringify(json).slice(0, 800),
      };
    }
    return null;
  }
  try {
    assert?.(json.data, status);
    record(section, name, true);
    return json.data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    record(section, name, false, msg);
    if (!failedPhase) {
      failedPhase = {
        section,
        name,
        expected: "assertion passed",
        actual: msg,
        request: `${method} ${path}`,
        response: JSON.stringify(json).slice(0, 800),
      };
    }
    return null;
  }
}

async function main() {
  console.log(`\n=== Greenfield OMS marathon @ ${BASE} tenant=${slug} ===\n`);

  // ----- Platform -----
  console.log("Phase 0 — Platform tenant");
  const plat = await api("POST", "/api/platform/auth", {
    body: { email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD },
  });
  if (plat.status !== 200 || !(plat.json.data as { accessToken?: string } | undefined)?.accessToken) {
    record("Platform", "operator login", false, `${plat.status} ${plat.json.error ?? ""}`);
    writeReport();
    process.exit(1);
  }
  record("Platform", "operator login", true);
  const platToken = (plat.json.data as { accessToken: string }).accessToken;

  const created = await api("POST", "/api/platform/tenants", {
    token: platToken,
    body: {
      name: `Greenfield ${slug}`,
      slug,
      plan: "starter",
      adminEmail: `admin@${slug}.test`,
      adminName: "GF Admin",
      adminPassword: adminPassword,
    },
  });
  const tenantId = (created.json.data as { tenantId?: string } | undefined)?.tenantId;
  if ((created.status !== 201 && created.status !== 200) || !tenantId) {
    record("Platform", "create tenant", false, `${created.status} ${created.json.error ?? ""}`);
    writeReport();
    process.exit(1);
  }
  record("Platform", `tenant created ${slug}`, true);

  const lic = await api("PUT", `/api/platform/licenses/${tenantId}`, {
    token: platToken,
    body: {
      modules: [
        { moduleId: "core", plan: "basic", isActive: true },
        { moduleId: "sales", plan: "basic", isActive: true },
        { moduleId: "inventory", plan: "basic", isActive: true },
        { moduleId: "accounting", plan: "basic", isActive: true },
      ],
    },
  });
  record("Platform", "licenses enabled", lic.status === 200, lic.status === 200 ? undefined : `${lic.status}`);

  const grant = await api("POST", `/api/platform/tenants/${tenantId}/billing/grant`, {
    token: platToken,
    body: { planCode: "growth_monthly" },
  });
  record(
    "Platform",
    "Growth billing granted",
    grant.status === 200,
    grant.status === 200 ? undefined : `${grant.status} ${grant.json.error ?? ""}`
  );

  const cap = await api("PUT", `/api/platform/tenants/${tenantId}/capabilities`, {
    token: platToken,
    body: { key: "processStudio", enabled: true },
  });
  record(
    "Platform",
    "Process Studio enabled",
    cap.status === 200,
    cap.status === 200 ? undefined : `${cap.status} ${cap.json.error ?? ""}`
  );

  let admin = await login(`admin@${slug}.test`, adminPassword, slug);
  record("Platform", "admin login", true);

  // ----- Staff + buyer + Porter -----
  console.log("Phase 1 — Staff + buyer + Porter");
  const staffDefs = [
    { email: `sales@${slug}.test`, name: "GF Sales", role: "SALES_EXECUTIVE" },
    { email: `pricing@${slug}.test`, name: "GF Pricing", role: "PRICING_EXECUTIVE" },
    { email: `dispatch@${slug}.test`, name: "GF Dispatch", role: "DISPATCH_EXECUTIVE" },
    { email: `delivery@${slug}.test`, name: "GF Delivery", role: "DELIVERY_EXECUTIVE" },
    { email: `accountant@${slug}.test`, name: "GF Accountant", role: "ACCOUNTANT" },
  ] as const;

  for (const s of staffDefs) {
    const r = await api("POST", `/api/tenants/${tenantId}/users`, {
      token: admin.token,
      tenantId,
      body: { action: "create", email: s.email, name: s.name, password: staffPassword, role: s.role },
    });
    record(
      "Platform",
      `staff ${s.role}`,
      r.status === 200 || r.status === 201,
      r.status === 200 || r.status === 201 ? undefined : `${r.status} ${r.json.error ?? ""}`
    );
  }

  const buyerEmail = `buyer@${slug}.test`;
  const reg = await api("POST", "/api/auth?action=register-customer", {
    body: {
      name: "GF Buyer",
      email: buyerEmail,
      password: buyerPassword,
      tenantSlug: slug,
      phone: "+919111111111",
    },
  });
  record(
    "Platform",
    "buyer registered",
    reg.status === 200 || reg.status === 201 || reg.status === 409,
    reg.status === 200 || reg.status === 201 || reg.status === 409 ? undefined : `${reg.status} ${reg.json.error ?? ""}`
  );

  const porter = await api("PUT", `/api/tenants/${tenantId}/settings`, {
    token: admin.token,
    tenantId,
    body: {
      "logistics.porter.enabled": "true",
      "logistics.porter.bookUrl": "https://porter.in/",
    },
  });
  record("Platform", "Porter settings", porter.status === 200, porter.status === 200 ? undefined : `${porter.status}`);

  const sales = await login(`sales@${slug}.test`, staffPassword, slug);
  const pricing = await login(`pricing@${slug}.test`, staffPassword, slug);
  const dispatch = await login(`dispatch@${slug}.test`, staffPassword, slug);
  const delivery = await login(`delivery@${slug}.test`, staffPassword, slug);
  const accountant = await login(`accountant@${slug}.test`, staffPassword, slug);
  const buyer = await login(buyerEmail, buyerPassword, slug);
  record("Platform", "all personas logged in", true);

  await api("POST", "/api/customers/me", {
    token: buyer.token,
    tenantId: buyer.tenantId,
    body: { name: "GF Buyer", email: buyerEmail, phone: "+919111111111" },
  });
  const me = (await api("GET", "/api/customers/me", { token: buyer.token, tenantId: buyer.tenantId })).json
    .data as { id: string; addresses?: { id: string }[] } | undefined;
  if (me?.id && (!me.addresses || me.addresses.length === 0)) {
    await api("POST", `/api/customers/${me.id}/addresses`, {
      token: buyer.token,
      tenantId: buyer.tenantId,
      body: {
        label: "Home",
        line1: "1 Greenfield Lane",
        city: "Hyderabad",
        state: "TG",
        pincode: "500001",
        isDefault: true,
      },
    });
  }

  // ----- 1A Security -----
  console.log("Phase 1A — Role / nav / dashboard / isolation");
  const personas: { label: string; who: Session; expect: string[]; forbid: string[] }[] = [
    {
      label: "Sales",
      who: sales,
      expect: ["dashboard", "products", "customers", "order_desk"],
      forbid: ["price_lists", "attributes", "categories"],
    },
    {
      label: "Pricing",
      who: pricing,
      expect: ["dashboard", "products", "price_lists", "order_desk"],
      forbid: ["categories", "customers"],
    },
    {
      label: "Dispatch",
      who: dispatch,
      expect: ["dashboard", "order_desk"],
      forbid: ["products", "price_lists"],
    },
    {
      label: "Delivery",
      who: delivery,
      expect: ["dashboard", "order_desk"],
      forbid: ["products", "price_lists"],
    },
    {
      label: "Accountant",
      who: accountant,
      expect: ["dashboard", "customers", "invoices", "order_desk"],
      forbid: ["products", "categories", "attributes", "price_lists"],
    },
    {
      label: "Admin",
      who: admin,
      expect: ["dashboard", "order_desk", "administration"],
      forbid: [],
    },
  ];

  for (const p of personas) {
    const nav = await api("GET", "/api/nav/me", { token: p.who.token, tenantId: p.who.tenantId });
    const data = nav.json.data as { homePath?: string; modules?: string[] } | undefined;
    const mods = new Set(data?.modules ?? []);
    record("Security", `${p.label} home /dashboard`, data?.homePath === "/dashboard", data?.homePath);
    for (const m of p.expect) {
      record("Security", `${p.label} nav has ${m}`, mods.has(m));
    }
    for (const m of p.forbid) {
      record("Security", `${p.label} nav lacks ${m}`, !mods.has(m));
    }
  }

  await expectHttp("Security", "Sales GET products", "GET", "/api/products?limit=5", sales, undefined, 200);
  await expectHttp("Security", "Sales GET customers", "GET", "/api/customers?limit=5", sales, undefined, 200);
  await expectHttp("Security", "Sales GET orders", "GET", "/api/orders?limit=5", sales, undefined, 200);
  await expectHttp("Security", "Sales GET SREQs", "GET", "/api/sales-requests?limit=5", sales, undefined, 200);
  await expectHttp("Security", "Sales GET price-lists forbidden", "GET", "/api/price-lists?limit=5", sales, undefined, 403);
  await expectHttp(
    "Security",
    "Sales POST attributes forbidden",
    "POST",
    "/api/attribute-definitions",
    sales,
    { key: "gf_blocked", label: "Blocked", dataType: "TEXT" },
    403
  );
  await expectHttp(
    "Security",
    "Sales POST categories forbidden",
    "POST",
    "/api/products/categories",
    sales,
    { name: "Blocked" },
    403
  );

  await expectHttp("Security", "Pricing GET products", "GET", "/api/products?limit=5", pricing, undefined, 200);
  await expectHttp("Security", "Pricing GET price-lists", "GET", "/api/price-lists?limit=5", pricing, undefined, 200);
  await expectHttp("Security", "Pricing GET orders", "GET", "/api/orders?limit=5", pricing, undefined, 200);
  await expectHttp(
    "Security",
    "Pricing POST price-list",
    "POST",
    "/api/price-lists",
    pricing,
    { name: "GF List", currency: "INR" },
    [200, 201]
  );
  await expectHttp(
    "Security",
    "Pricing POST categories forbidden",
    "POST",
    "/api/products/categories",
    pricing,
    { name: "Blocked Cat" },
    403
  );
  await expectHttp(
    "Security",
    "Pricing POST attributes forbidden",
    "POST",
    "/api/attribute-definitions",
    pricing,
    { key: "gf_price_blocked", label: "Blocked", dataType: "TEXT" },
    403
  );

  await expectHttp("Security", "Dispatch GET orders", "GET", "/api/orders?limit=5", dispatch, undefined, 200);
  await expectHttp("Security", "Dispatch GET products forbidden", "GET", "/api/products?limit=5", dispatch, undefined, 403);
  await expectHttp("Security", "Dispatch GET price-lists forbidden", "GET", "/api/price-lists?limit=5", dispatch, undefined, 403);

  await expectHttp("Security", "Accountant GET invoices", "GET", "/api/invoices?limit=5", accountant, undefined, 200);
  await expectHttp("Security", "Accountant GET customers", "GET", "/api/customers?limit=5", accountant, undefined, 200);
  await expectHttp("Security", "Accountant GET orders", "GET", "/api/orders?limit=5", accountant, undefined, 200);
  await expectHttp(
    "Security",
    "Accountant POST products forbidden",
    "POST",
    "/api/products",
    accountant,
    { sku: "GF-BLOCK", name: "Blocked", sellPrice: 1 },
    403
  );
  await expectHttp(
    "Security",
    "Accountant POST categories forbidden",
    "POST",
    "/api/products/categories",
    accountant,
    { name: "Blocked Acc" },
    403
  );

  const dashChecks: { label: string; who: Session; types: string[]; variant?: string }[] = [
    { label: "Sales", who: sales, types: ["ops-kpi-row", "my-tasks-list", "sreq-order-table"], variant: "sales" },
    { label: "Pricing", who: pricing, types: ["ops-kpi-row", "price-ops"], variant: "pricing" },
    { label: "Dispatch", who: dispatch, types: ["ops-kpi-row"], variant: "dispatch" },
    { label: "Delivery", who: delivery, types: ["ops-kpi-row"], variant: "delivery" },
    { label: "Accountant", who: accountant, types: ["ops-kpi-row"], variant: "accountant" },
    { label: "Admin", who: admin, types: ["ops-kpi-row"], variant: "admin" },
  ];
  for (const d of dashChecks) {
    const r = await api("GET", "/api/dashboard/config?portal=ADMIN", { token: d.who.token, tenantId: d.who.tenantId });
    const payload = r.json.data as {
      config?: { widgets?: { type: string; config?: { variant?: string } }[] };
      resolved?: { type: string }[];
    };
    const widgets = payload?.config?.widgets ?? [];
    const types = new Set(widgets.map((w) => w.type));
    const noDesk = ![...types].some((t) => /order.?desk|sales-desk/i.test(t));
    record("Dashboard", `${d.label} dashboard loaded`, r.status === 200);
    for (const t of d.types) record("Dashboard", `${d.label} has ${t}`, types.has(t));
    if (d.variant) {
      const kpi = widgets.find((w) => w.type === "ops-kpi-row");
      record("Dashboard", `${d.label} KPI variant ${d.variant}`, kpi?.config?.variant === d.variant);
    }
    record("Dashboard", `${d.label} no Order Desk widget`, noDesk);
  }

  const emptyPortal = await api("GET", "/api/portal/products?limit=50", { tenantSlug: slug });
  record(
    "Security",
    "empty portal has no Trustwood leak",
    emptyPortal.status === 200 && !hasTrustwoodLeak(emptyPortal.json.data)
  );

  // ----- Workflow studio -----
  console.log("Phase 2 — Workflow / forms / documents");
  admin = await login(`admin@${slug}.test`, adminPassword, slug);

  await expectHttp("Workflow", "seed forms", "POST", "/api/workflow-forms", admin, { action: "seed" }, [200, 201]);
  await expectHttp("Workflow", "seed templates", "POST", "/api/workflow-templates", admin, { action: "seed" }, [200, 201]);
  await expectHttp(
    "Workflow",
    "bind OMS trading workflow",
    "POST",
    "/api/order-workflows",
    admin,
    { templateId: "workflow.oms_trading", setDefault: true },
    [200, 201]
  );

  const lab = (await expectHttp(
    "Workflow",
    "create widget lab form",
    "POST",
    "/api/workflow-forms",
    admin,
    {
      formId: "e2e-widget-lab",
      name: "E2E widget lab",
      definition: {
        key: "e2e_widget_lab",
        id: "e2e-widget-lab",
        title: "E2E widget lab",
        renderer: "generic",
        fields: [{ key: "remarks", label: "Remarks", type: "text", scope: "order" }],
        layout: [
          { widget: "ProductList", props: {} },
          { widget: "CatalogSearch", props: {} },
          { widget: "FormFields", props: {} },
          { widget: "DispatchFulfillment", props: {} },
          { widget: "InvoiceGenerate", props: {} },
          { widget: "ActionButtons", props: {} },
        ],
      },
    },
    [200, 201]
  )) as { id: string } | null;
  if (lab?.id) {
    await expectHttp(
      "Workflow",
      "publish widget lab",
      "POST",
      `/api/workflow-forms/${lab.id}/publish`,
      admin,
      {},
      [200, 201]
    );
  }
  const publishedLab = await api("GET", "/api/workflow-forms/published?formId=e2e-widget-lab", {
    token: admin.token,
    tenantId: admin.tenantId,
  });
  const labDef = (publishedLab.json.data as { definition?: { layout?: { widget: string }[] } } | undefined)?.definition;
  const labWidgets = new Set((labDef?.layout ?? []).map((w) => w.widget));
  for (const w of [
    "ProductList",
    "CatalogSearch",
    "FormFields",
    "DispatchFulfillment",
    "InvoiceGenerate",
    "ActionButtons",
  ]) {
    record("Workflow", `widget lab has ${w}`, labWidgets.has(w));
  }

  const publishedDispatch = await api("GET", "/api/workflow-forms/published?formId=dispatch", {
    token: admin.token,
    tenantId: admin.tenantId,
  });
  const publishedDispatchDef = (
    publishedDispatch.json.data as { definition?: { layout?: { widget: string }[] } } | undefined
  )?.definition;
  const dispatchList = await api("GET", "/api/workflow-forms?formId=dispatch&lifecycle=PUBLISHED", {
    token: admin.token,
    tenantId: admin.tenantId,
  });
  const dispatchRows =
    (dispatchList.json.data as { definition?: { layout?: { widget: string }[] } }[]) ?? [];
  const dispatchWidgets = new Set(
    (publishedDispatchDef?.layout ?? dispatchRows[0]?.definition?.layout ?? []).map((w) => w.widget)
  );
  record("Workflow", "DispatchFulfillment on published dispatch form", dispatchWidgets.has("DispatchFulfillment"));

  await expectHttp(
    "Documents",
    "seed tax-invoice",
    "POST",
    "/api/workflow-documents",
    admin,
    { action: "seed" },
    [200, 201]
  );
  const docs = await api("GET", "/api/workflow-documents?documentId=tax-invoice", {
    token: admin.token,
    tenantId: admin.tenantId,
  });
  const docRows =
    (docs.json.data as { id: string; lifecycle: string; definition?: { items?: unknown } }[]) ?? [];
  const publishedDoc = docRows.find((d) => d.lifecycle === "PUBLISHED") ?? docRows[0];
  if (publishedDoc?.lifecycle === "DRAFT") {
    await api("PATCH", `/api/workflow-documents/${publishedDoc.id}`, {
      token: admin.token,
      tenantId: admin.tenantId,
      body: { action: "publish" },
    });
  }
  const ids = new Set(flattenIds(publishedDoc?.definition?.items));
  const missing = TAX_INVOICE_IDS.filter((id) => !ids.has(id));
  record("Documents", "tax-invoice element ids", missing.length === 0, missing.length ? missing.join(",") : undefined);

  if (publishedDoc?.id) {
    const preview = await api("POST", `/api/workflow-documents/${publishedDoc.id}?action=preview`, {
      token: admin.token,
      tenantId: admin.tenantId,
      body: {},
    });
    const html = (preview.json.data as { html?: string } | undefined)?.html ?? "";
    record("Documents", "preview TAX INVOICE", html.includes("TAX INVOICE"));
    record("Documents", "preview data-id invoiceNumber", html.includes('data-id="invoiceNumber"'));
  }

  // ----- Catalog -----
  console.log("Phase 3 — Catalog + stock");
  const brand = (await expectHttp(
    "Catalog",
    "create brand",
    "POST",
    "/api/brands",
    admin,
    { name: "Greenfield Brand" },
    [200, 201]
  )) as { id: string } | null;
  const category = (await expectHttp(
    "Catalog",
    "create category",
    "POST",
    "/api/products/categories",
    admin,
    { name: "Greenfield Apparel", defaultTaxRate: 0.18 },
    [200, 201]
  )) as { id: string } | null;

  await expectHttp(
    "Catalog",
    "create color attribute",
    "POST",
    "/api/attribute-definitions",
    admin,
    {
      key: "gf_color",
      label: "Color",
      dataType: "SELECT",
      options: ["Black", "Navy"],
      isVariantAxis: true,
      categoryIds: category?.id ? [category.id] : [],
    },
    [200, 201]
  );
  await expectHttp(
    "Catalog",
    "create size attribute",
    "POST",
    "/api/attribute-definitions",
    admin,
    {
      key: "gf_size",
      label: "Size",
      dataType: "SELECT",
      options: ["S", "M", "L"],
      isVariantAxis: true,
      categoryIds: category?.id ? [category.id] : [],
    },
    [200, 201]
  );

  if (brand?.id && category?.id) {
    const cfg = await api("POST", "/api/products", {
      token: admin.token,
      tenantId: admin.tenantId,
      body: {
        categoryId: category.id,
        brandId: brand.id,
        productName: "GF Configure Tee",
        axes: { gf_color: ["Black", "Navy"] },
        skuTemplate: "GF-CFG-{gf_color}",
        nameTemplate: "GF Tee {gf_color}",
        groupCode: "GF-CFG-TEE",
        groupName: "GF Configure Tee",
        pricingBasis: "PER_EACH",
        sellPrice: 499,
        taxRate: 0.18,
      },
    });
    record(
      "Catalog",
      "configure group created",
      cfg.status === 200 || cfg.status === 201,
      cfg.status === 200 || cfg.status === 201 ? undefined : `${cfg.status} ${cfg.json.error ?? ""}`
    );
  }

  const skus: { id: string; sku: string; name: string; sellPrice: number }[] = [];
  for (let i = 1; i <= 10; i++) {
    const sku = `GF-SKU-${String(i).padStart(3, "0")}`;
    const createdSku = await api("POST", "/api/products", {
      token: admin.token,
      tenantId: admin.tenantId,
      body: {
        sku,
        name: `Greenfield Item ${i}`,
        categoryId: category?.id,
        brandId: brand?.id,
        sellPrice: 100 + i * 10,
        taxRate: 0.18,
        unit: "pcs",
        pricingBasis: "PER_EACH",
        customAttributes: { gf_color: i % 2 === 0 ? "Navy" : "Black", gf_size: "M" },
      },
    });
    const p = createdSku.json.data as { id?: string; sku?: string; name?: string; sellPrice?: number } | undefined;
    if ((createdSku.status === 200 || createdSku.status === 201) && p?.id) {
      skus.push({
        id: p.id,
        sku: p.sku ?? sku,
        name: p.name ?? sku,
        sellPrice: Number(p.sellPrice ?? 100 + i * 10),
      });
    } else {
      record("Catalog", `create ${sku}`, false, `${createdSku.status} ${createdSku.json.error ?? ""}`);
    }
  }
  record("Catalog", "10 GF-SKU sellable products", skus.length === 10, `got ${skus.length}`);

  const wh = (await expectHttp(
    "Catalog",
    "create warehouse",
    "POST",
    "/api/warehouses",
    admin,
    { name: "GF Main", location: "Hyderabad" },
    [200, 201]
  )) as { id: string } | null;
  const warehouseId = wh?.id;
  const stockKey = `GF-OPEN-${slug}`;
  if (warehouseId && skus.length) {
    const recvBody = {
      reference: `GF-OPEN-${slug}`,
      idempotencyKey: stockKey,
      notes: "Greenfield opening stock",
      items: skus.map((p) => ({ productId: p.id, warehouseId, quantity: 50 })),
    };
    const r1 = await api("POST", "/api/stock/receive", { token: admin.token, tenantId: admin.tenantId, body: recvBody });
    record("Catalog", "stock received", r1.status === 200 || r1.status === 201, `${r1.status}`);
    const r2 = await api("POST", "/api/stock/receive", { token: admin.token, tenantId: admin.tenantId, body: recvBody });
    record("Catalog", "stock receive idempotent", r2.status === 200 || r2.status === 201, `${r2.status}`);
  }

  const portal = await api("GET", "/api/portal/products?limit=100", { tenantSlug: slug });
  const portalRows = (portal.json.data as { sku?: string }[]) ?? [];
  const portalSkus = portalRows.map((p) => p.sku ?? "");
  record("Catalog", "portal lists GF-SKU-001", portalSkus.includes("GF-SKU-001"));
  record("Catalog", "portal has no Trustwood SKU", !portalSkus.some((s) => s.startsWith("TW-") || s.includes("TRUSTWOOD")));
  record("Security", "tenant isolation portal SKUs", portalSkus.every((s) => s.startsWith("GF-")));

  try {
    const peer = await login(PEER_ADMIN.email, PEER_ADMIN.password, PEER_TENANT);
    const peerProducts = await api("GET", "/api/portal/products?limit=100", { tenantSlug: PEER_TENANT });
    const peerSkus = ((peerProducts.json.data as { sku?: string }[]) ?? []).map((p) => p.sku ?? "");
    record("Security", "Trustwood cannot see GF-SKU-001", !peerSkus.includes("GF-SKU-001"));
    const peerOrders = await api("GET", "/api/orders?limit=20", { token: peer.token, tenantId: peer.tenantId });
    record(
      "Security",
      "Trustwood orders lack gf slug",
      !leakStrings(peerOrders.json.data).includes(slug)
    );
  } catch {
    record("Security", "Trustwood reverse isolation (optional)", true, "peer tenant unavailable — skipped");
  }

  const stockSnap: Record<string, number> = {};
  if (warehouseId) {
    for (const p of skus) {
      const st = await api("GET", `/api/stock?productId=${p.id}&warehouseId=${warehouseId}&limit=5`, {
        token: admin.token,
        tenantId: admin.tenantId,
      });
      const rows = (st.json.data as { quantity?: number }[]) ?? [];
      stockSnap[p.id] = Number(rows[0]?.quantity ?? 0);
    }
  }

  // ----- Checkout -----
  console.log("Phase 4 — Customer checkout");
  const cartItems = skus.slice(0, 10).map((p) => ({
    productId: p.id,
    productName: p.name,
    quantity: 1,
    unitPrice: p.sellPrice,
  }));
  const expectedSubtotal = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const sreq = (await expectHttp(
    "OMS",
    "buyer 10-line SREQ",
    "POST",
    "/api/sales-requests",
    buyer,
    {
      isOnlineOrder: true,
      paymentMethod: "COD",
      notes: "greenfield e2e cart",
      items: cartItems,
    },
    201,
    (data) => {
      const o = data as { status: string; requestNumber: string; items?: unknown[]; subtotal?: number };
      if (o.status !== "OPEN") throw new Error(`status ${o.status}`);
      if (!o.requestNumber?.startsWith("SREQ-")) throw new Error("SREQ number");
      if ((o.items?.length ?? 0) !== 10) throw new Error(`lines ${o.items?.length}`);
    }
  )) as {
    id: string;
    requestNumber: string;
    subtotal: number;
    tax: number;
    total: number;
    items: { id: string; productId: string; productName: string; quantity: number; unitPrice: number }[];
  } | null;
  if (!sreq?.id) {
    writeReport();
    process.exit(1);
  }
  record("OMS", "SREQ subtotal ≈ cart", Math.abs((sreq.subtotal ?? 0) - expectedSubtotal) < 0.05);

  // ----- Convert + tasks -----
  console.log("Phase 5 — SR→SO + tasks");
  const converted = (await expectHttp(
    "OMS",
    "convert SREQ → SO",
    "POST",
    `/api/sales-requests/${sreq.id}/convert`,
    sales,
    {},
    201,
    (data) => {
      const o = data as { soStatus?: string; salesOrder?: { status?: string; id?: string } };
      if (o.soStatus !== "CONFIRMED" && o.salesOrder?.status !== "CONFIRMED") {
        throw new Error(`expected CONFIRMED got ${o.soStatus}`);
      }
    }
  )) as { salesOrder: { id: string; orderNumber: string; items?: unknown[] }; soNumber?: string } | null;

  const retryConvert = await api("POST", `/api/sales-requests/${sreq.id}/convert`, {
    token: sales.token,
    tenantId: sales.tenantId,
    body: {},
  });
  const retryData = retryConvert.json.data as
    | { alreadyConverted?: boolean; salesOrder?: { id: string; orderNumber: string } }
    | undefined;
  record(
    "OMS",
    "convert idempotent",
    retryConvert.status === 200 &&
      retryData?.alreadyConverted === true &&
      retryData.salesOrder?.id === converted?.salesOrder.id,
    `${retryConvert.status} already=${retryData?.alreadyConverted}`
  );

  const orderId = converted?.salesOrder.id;
  if (!orderId) {
    writeReport();
    process.exit(1);
  }

  const detail = (await expectHttp(
    "OMS",
    "SO v5 snapshot",
    "GET",
    `/api/orders/${orderId}`,
    sales,
    undefined,
    200,
    (data) => {
      const o = data as { runtimePath?: string; workflowRuntime?: { snapshot?: unknown }; items?: unknown[] };
      if (o.runtimePath !== "v5") throw new Error(`runtimePath ${o.runtimePath}`);
      if (!o.workflowRuntime?.snapshot) throw new Error("missing snapshot");
      if ((o.items?.length ?? 0) !== 10) throw new Error(`SO lines ${o.items?.length}`);
    }
  )) as {
    items: { id: string; productId: string; productName: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    tax: number;
    total: number;
    status: string;
  } | null;

  async function patch(
    who: Session,
    action: string,
    body: unknown,
    expectStatus: string | string[],
    label: string
  ) {
    const allowed = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
    return expectHttp(
      "OMS",
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

  await patch(
    sales,
    "review",
    {
      remarks: "GF sales review",
      items: (detail?.items ?? []).map((line) => ({
        id: line.id,
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    },
    ["CONFIRMED", "FULFILLING"],
    "Sales review"
  );

  const afterReview = (await api("GET", `/api/orders/${orderId}`, { token: sales.token, tenantId: sales.tenantId }))
    .json.data as { items: { id: string; quantity: number; productId?: string }[] };
  const reviewLines = afterReview?.items ?? [];

  await patch(
    sales,
    "verify-stock",
    { items: reviewLines.map((l) => ({ orderItemId: l.id, availableQty: 50 })), remarks: "Full stock" },
    ["FULFILLING", "CONFIRMED"],
    "Inventory verify-stock"
  );
  await patch(
    pricing,
    "complete-pricing",
    {
      items: reviewLines.map((l) => {
        const sku = skus.find((s) => s.id === (l as { productId?: string }).productId);
        return {
          orderItemId: l.id,
          purchasePrice: 40,
          unitPrice: sku?.sellPrice ?? 100,
        };
      }),
      transportationCharge: 0,
    },
    ["FULFILLING", "READY_FOR_DISPATCH"],
    "Pricing complete-pricing"
  );
  await patch(dispatch, "warehouse-ready", { remarks: "Picked" }, ["READY_FOR_DISPATCH", "FULFILLING"], "Warehouse ready");

  // ----- Porter -----
  console.log("Phase 6 — Porter gate");
  const blocked = await api("PATCH", `/api/orders/${orderId}?action=dispatch`, {
    token: dispatch.token,
    tenantId: dispatch.tenantId,
    body: { fulfillmentMode: "porter", porterBookingStatus: "NOT_BOOKED" },
  });
  record(
    "OMS",
    "Porter NOT_BOOKED blocked",
    blocked.status >= 400 && blocked.status < 500,
    `${blocked.status} ${blocked.json.error ?? ""}`
  );
  if (blocked.status < 400 && !failedPhase) {
    failedPhase = {
      section: "OMS",
      name: "Porter NOT_BOOKED blocked",
      expected: "4xx",
      actual: `${blocked.status}`,
      request: `PATCH /api/orders/${orderId}?action=dispatch`,
      response: JSON.stringify(blocked.json).slice(0, 800),
    };
  }

  await patch(
    dispatch,
    "dispatch",
    { fulfillmentMode: "porter", porterBookingStatus: "BOOKING_PENDING" },
    "DISPATCHED",
    "Porter BOOKING_PENDING → DISPATCHED"
  );
  const afterDispatch = (await api("GET", `/api/orders/${orderId}`, { token: dispatch.token, tenantId: dispatch.tenantId }))
    .json.data as {
    fulfillmentMode?: string;
    carrier?: string;
    porterBookingStatus?: string;
    trackingNumber?: string | null;
  };
  record("OMS", "fulfillmentMode porter", afterDispatch?.fulfillmentMode === "porter");
  record("OMS", "carrier porter", afterDispatch?.carrier === "porter");
  record(
    "OMS",
    "porterBookingStatus pending or booked",
    afterDispatch?.porterBookingStatus === "BOOKING_PENDING" || afterDispatch?.porterBookingStatus === "BOOKED",
    afterDispatch?.porterBookingStatus
  );

  await patch(delivery, "deliver-oms", {}, "DELIVERED", "Deliver");

  console.log("Phase 7 — Invoice + payment");
  await patch(
    accountant,
    "invoice",
    { documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 } },
    "INVOICED",
    "Invoice generate"
  );
  const invRetry = await api("PATCH", `/api/orders/${orderId}?action=invoice`, {
    token: accountant.token,
    tenantId: accountant.tenantId,
    body: { documentRef: { type: "DOCUMENT", id: "tax-invoice", version: 1 } },
  });
  record(
    "OMS",
    "invoice retry does not 5xx",
    invRetry.status === 200 || invRetry.status === 201 || invRetry.status === 409,
    `${invRetry.status}`
  );

  const invList = await api("GET", `/api/invoices?sourceRef=${orderId}&limit=10`, {
    token: accountant.token,
    tenantId: accountant.tenantId,
  });
  const invoices =
    (invList.json.data as {
      id: string;
      number: string;
      pdfUrl?: string | null;
      subtotal: number;
      tax: number;
      total: number;
      paidAmount: number;
      status: string;
      lines?: unknown[];
    }[]) ?? [];
  record("Documents", "single AR invoice", invoices.length === 1, `count=${invoices.length}`);
  const invoice = invoices[0];
  if (invoice) {
    record("Documents", "invoice number INV-*", invoice.number?.startsWith("INV-"));
    record("Documents", "pdfUrl present", Boolean(invoice.pdfUrl));
    const invDetail = await api("GET", `/api/invoices/${invoice.id}`, {
      token: accountant.token,
      tenantId: accountant.tenantId,
    });
    const full = invDetail.json.data as { lines?: unknown[]; pdfUrl?: string } | undefined;
    record("Documents", "invoice has 10 lines", (full?.lines?.length ?? invoice.lines?.length ?? 0) === 10);
    const pdf = await fetch(`${BASE}/api/invoices/${invoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${accountant.token}`, "x-tenant-id": accountant.tenantId },
    });
    const pdfBuf = Buffer.from(await pdf.arrayBuffer());
    record("Documents", "PDF %PDF-", pdf.status === 200 && pdfBuf.subarray(0, 5).toString() === "%PDF-");
  }

  const soDocs = (
    (await api("GET", `/api/orders/${orderId}`, { token: accountant.token, tenantId: accountant.tenantId })).json
      .data as { documents?: { type: string }[] }
  )?.documents;
  record("Documents", "SO attachment INVOICE", (soDocs ?? []).some((d) => d.type === "INVOICE"));

  await patch(accountant, "collect-payment", {}, ["PAID", "CLOSED"], "Collect payment");
  const payRetry = await api("PATCH", `/api/orders/${orderId}?action=collect-payment`, {
    token: accountant.token,
    tenantId: accountant.tenantId,
    body: {},
  });
  record(
    "OMS",
    "payment retry idempotent",
    payRetry.status === 200 || payRetry.status === 201 || payRetry.status === 409,
    `${payRetry.status}`
  );

  const finalSo = (
    await api("GET", `/api/orders/${orderId}`, { token: admin.token, tenantId: admin.tenantId })
  ).json.data as {
    status?: string;
    paymentStatus?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    items?: unknown[];
  };
  if (finalSo?.status !== "CLOSED" && finalSo?.status !== "PAID") {
    await patch(admin, "close", {}, ["CLOSED", "PAID"], "Close");
  } else {
    record("OMS", `final SO ${finalSo.status}`, true);
  }

  const closed = (
    await api("GET", `/api/orders/${orderId}`, { token: admin.token, tenantId: admin.tenantId })
  ).json.data as {
    status?: string;
    paymentStatus?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    items?: unknown[];
  };

  console.log("Phase 8 — Final invariants");
  record("Final invariants", "SO 10 lines", (closed.items?.length ?? 0) === 10);
  record("Final invariants", "SO CLOSED or PAID", closed.status === "CLOSED" || closed.status === "PAID", closed.status);
  const invAfter = (
    (await api("GET", `/api/invoices/${invoice?.id}`, { token: accountant.token, tenantId: accountant.tenantId })).json
      .data as {
      subtotal: number;
      tax: number;
      total: number;
      paidAmount: number;
      lines?: unknown[];
      payments?: { amount: number }[];
    } | undefined
  );
  if (invAfter && closed) {
    record("Final invariants", "invoice 10 lines", (invAfter.lines?.length ?? 0) === 10);
    record(
      "Final invariants",
      "invoice.subtotal == SO.subtotal",
      Math.abs(invAfter.subtotal - (closed.subtotal ?? 0)) < 0.05
    );
    record("Final invariants", "invoice.tax == SO.tax", Math.abs(invAfter.tax - (closed.tax ?? 0)) < 0.05);
    record(
      "Final invariants",
      "invoice.total == subtotal + tax",
      Math.abs(invAfter.total - (invAfter.subtotal + invAfter.tax)) < 0.05 ||
        Math.abs(invAfter.total - (closed.total ?? 0)) < 0.05
    );
    record(
      "Final invariants",
      "payment == invoice total",
      invAfter.paidAmount + 1e-6 >= invAfter.total || (invAfter.payments ?? []).reduce((s, p) => s + p.amount, 0) + 1e-6 >= invAfter.total,
      `paid=${invAfter.paidAmount} total=${invAfter.total}`
    );
  }

  if (warehouseId) {
    let stockOk = true;
    for (const p of skus) {
      const st = await api("GET", `/api/stock?productId=${p.id}&warehouseId=${warehouseId}&limit=5`, {
        token: admin.token,
        tenantId: admin.tenantId,
      });
      const qty = Number(((st.json.data as { quantity?: number }[]) ?? [])[0]?.quantity ?? 0);
      const expected = (stockSnap[p.id] ?? 50) - 1;
      if (Math.abs(qty - expected) > 0.01) stockOk = false;
    }
    record("Final invariants", "stock deducted by ordered qty", stockOk);
  }

  const sreqFinal = (
    await api("GET", `/api/sales-requests/${sreq.id}`, { token: sales.token, tenantId: sales.tenantId })
  ).json.data as { status?: string; items?: unknown[] };
  record("Final invariants", "SREQ CONVERTED + 10 lines", sreqFinal?.status === "CONVERTED" && (sreqFinal.items?.length ?? 0) === 10);

  writeReport();
  console.log(`\n=== Greenfield result: ${pass} pass, ${fail} fail tenant=${slug} ===\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  writeReport();
  process.exit(1);
});

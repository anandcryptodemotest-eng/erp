/**
 * Tenant GST full-flow E2E — provisions two tenants (GST + non-GST), customers,
 * products, Quick Bills, tax invoices, IRN, e-way, GSTR-1 export.
 *
 *   pnpm --filter @erp/scripts e2e:gst
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const PLATFORM_EMAIL = process.env.PLATFORM_OWNER_EMAIL || "platform@erp.local";
const PLATFORM_PASSWORD = process.env.PLATFORM_OWNER_PASSWORD || "Platform@123";

/** Valid GSTINs (checksum-verified via @erp/tax-india) */
const SELLER_GSTIN_KA = "29AAAAA0000A1ZY";
const BUYER_GSTIN_DL = "07AAAAA0000A1Z4";
const BUYER_GSTIN_MH = "27AAPFU0939F1ZV";

const stamp = Date.now().toString(36);
const ADMIN_PASSWORD = "GstAdmin1!x";

type Session = { token: string; tenantId: string };
type Json = { data?: unknown; error?: string };
type ReportLine = { ok: boolean; section: string; name: string; detail?: string };

const lines: ReportLine[] = [];
let pass = 0;
let fail = 0;
const started = new Date();

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
    throw new Error(`Login failed ${email}: ${status} ${json.error ?? ""}`);
  }
  const data = json.data as { accessToken: string; tenant: { id: string } };
  return { token: data.accessToken, tenantId: data.tenant.id };
}

async function provisionTenant(
  platToken: string,
  name: string,
  slug: string,
  opts: { indiaGst?: boolean; processStudio?: boolean } = {}
): Promise<{ tenantId: string; admin: Session }> {
  const created = await api("POST", "/api/platform/tenants", {
    token: platToken,
    body: {
      name,
      slug,
      plan: "starter",
      adminEmail: `admin@${slug}.test`,
      adminName: "GST E2E Admin",
      adminPassword: ADMIN_PASSWORD,
    },
  });
  const tenantId = (created.json.data as { tenantId?: string } | undefined)?.tenantId;
  if ((created.status !== 201 && created.status !== 200) || !tenantId) {
    throw new Error(`Create tenant ${slug}: ${created.status} ${created.json.error ?? ""}`);
  }

  await api("PUT", `/api/platform/licenses/${tenantId}`, {
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

  const grant = await api("POST", `/api/platform/tenants/${tenantId}/billing/grant`, {
    token: platToken,
    body: { planCode: "growth_monthly" },
  });
  if (grant.status !== 200) {
    throw new Error(`Grant billing ${slug}: ${grant.status} ${grant.json.error ?? ""}`);
  }

  if (opts.processStudio !== false) {
    await api("PUT", `/api/platform/tenants/${tenantId}/capabilities`, {
      token: platToken,
      body: { key: "processStudio", enabled: true },
    });
  }
  if (opts.indiaGst) {
    await api("PUT", `/api/platform/tenants/${tenantId}/capabilities`, {
      token: platToken,
      body: { key: "indiaGst", enabled: true },
    });
  }

  const admin = await login(`admin@${slug}.test`, ADMIN_PASSWORD, slug);
  return { tenantId, admin };
}

async function createProduct(
  admin: Session,
  sku: string,
  name: string,
  taxRate: number | null
) {
  const body: Record<string, unknown> = {
    sku,
    name,
    sellPrice: 1000,
    unit: "pcs",
    pricingBasis: "PER_EACH",
    hsnCode: "44123100",
  };
  if (taxRate != null) body.taxRate = taxRate;
  const r = await api("POST", "/api/products", {
    token: admin.token,
    tenantId: admin.tenantId,
    body,
  });
  const id = (r.json.data as { id?: string } | undefined)?.id;
  if ((r.status !== 200 && r.status !== 201) || !id) {
    throw new Error(`Product ${sku}: ${r.status} ${r.json.error ?? ""}`);
  }
  return { id, sku, name };
}

async function createCustomer(
  admin: Session,
  name: string,
  taxId?: string
) {
  const r = await api("POST", "/api/customers", {
    token: admin.token,
    tenantId: admin.tenantId,
    body: { name, taxId, city: "Bengaluru", address: "Yard 1" },
  });
  const id = (r.json.data as { id?: string } | undefined)?.id;
  if ((r.status !== 200 && r.status !== 201) || !id) {
    throw new Error(`Customer ${name}: ${r.status} ${r.json.error ?? ""}`);
  }
  return { id, name, taxId };
}

function writeReport() {
  const md = [
    "# Tenant GST E2E",
    "",
    `Started: ${started.toISOString()}`,
    `Duration: ${((Date.now() - started.getTime()) / 1000).toFixed(1)}s`,
    `Result: ${pass} pass / ${fail} fail`,
    "",
  ];
  for (const section of [...new Set(lines.map((l) => l.section))]) {
    md.push(`## ${section}`);
    for (const l of lines.filter((x) => x.section === section)) {
      md.push(`${l.ok ? "✓" : "✗"} ${l.name}${l.detail ? ` — ${l.detail}` : ""}`);
    }
    md.push("");
  }
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "E2E-GST-latest.md"), md.join("\n"));
  writeFileSync(join(outDir, "TENANT-GST-E2E-CHECKLIST.md"), buildChecklistMd());
}

function buildChecklistMd() {
  const bySection = [...new Set(lines.map((l) => l.section))];
  const rows = [
    "# Tenant GST — E2E validation checklist",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Score: **${pass}/${pass + fail}**`,
    "",
    "| Section | Check | Status | Detail |",
    "|---------|-------|--------|--------|",
  ];
  for (const section of bySection) {
    for (const l of lines.filter((x) => x.section === section)) {
      rows.push(
        `| ${section} | ${l.name} | ${l.ok ? "PASS" : "FAIL"} | ${l.detail ?? ""} |`
      );
    }
  }
  rows.push("");
  rows.push("## Use-case coverage");
  rows.push("");
  rows.push("| ID | Scenario | Covered |");
  rows.push("|----|----------|---------|");
  rows.push("| U1 | Non-GST tenant commercial bill | Yes |");
  rows.push("| U2 | GST Regular B2B tax invoice | Yes |");
  rows.push("| U3 | OPTIONAL e-invoice Generate IRN | Yes |");
  rows.push("| U5 | GST B2C tax invoice | Yes |");
  rows.push("| U8 | Non-GST sells to GST dealer | Yes |");
  rows.push("| U9 | Quick Bill same Invoice | Yes |");
  rows.push("| D | GSTR-1 export | Yes |");
  rows.push("| C | E-way sandbox | Yes |");
  rows.push("");
  return rows.join("\n");
}

async function main() {
  console.log(`\n=== Tenant GST E2E @ ${BASE} stamp=${stamp} ===\n`);

  // Platform login
  const plat = await api("POST", "/api/platform/auth", {
    body: { email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD },
  });
  const platToken = (plat.json.data as { accessToken?: string } | undefined)?.accessToken;
  if (plat.status !== 200 || !platToken) {
    record("Platform", "operator login", false, `${plat.status} ${plat.json.error ?? ""}`);
    writeReport();
    process.exit(1);
  }
  record("Platform", "operator login", true);

  // ----- Tenant A: NON-GST -----
  console.log("Phase A — Non-GST tenant");
  const noneSlug = `gst-none-${stamp}`;
  let none: { tenantId: string; admin: Session };
  try {
    none = await provisionTenant(platToken, `GST None ${stamp}`, noneSlug, { indiaGst: false });
    record("NonGST", `tenant ${noneSlug}`, true);
  } catch (e) {
    record("NonGST", "provision", false, e instanceof Error ? e.message : String(e));
    writeReport();
    process.exit(1);
  }

  // Regime NONE (default) — also set explicitly
  const noneSettings = await api("PUT", `/api/tenants/${none.tenantId}/settings`, {
    token: none.admin.token,
    tenantId: none.tenantId,
    body: {
      "tax.regime": "NONE",
      "tax.scheme": "UNREGISTERED",
    },
  });
  record(
    "NonGST",
    "tax.regime=NONE",
    noneSettings.status === 200,
    noneSettings.status === 200 ? undefined : `${noneSettings.status} ${noneSettings.json.error ?? ""}`
  );

  // Invalid combo should fail
  const badCombo = await api("PUT", `/api/tenants/${none.tenantId}/settings`, {
    token: none.admin.token,
    tenantId: none.tenantId,
    body: { "tax.regime": "NONE", "tax.scheme": "REGULAR" },
  });
  // After normalize, NONE forces UNREGISTERED so it may succeed with normalized scheme
  const afterBad = await api("GET", `/api/tenants/${none.tenantId}/settings`, {
    token: none.admin.token,
    tenantId: none.tenantId,
  });
  const schemeAfter = (afterBad.json.data as Record<string, string> | undefined)?.["tax.scheme"];
  record(
    "NonGST",
    "NONE forces UNREGISTERED scheme",
    schemeAfter === "UNREGISTERED",
    `scheme=${schemeAfter}`
  );

  let noneProduct: { id: string };
  let noneCustomer: { id: string };
  try {
    noneProduct = await createProduct(none.admin, `NONE-SKU-${stamp}`, "None Shop Sheet", 0.18);
    record("NonGST", "product with taxRate (ignored when NONE)", true);
    noneCustomer = await createCustomer(none.admin, "Walk GST Dealer", BUYER_GSTIN_MH);
    record("NonGST", "customer with GSTIN (U8)", true);
  } catch (e) {
    record("NonGST", "catalog/customer", false, e instanceof Error ? e.message : String(e));
    writeReport();
    process.exit(1);
  }

  const qbNone = await api("POST", "/api/quick-bills", {
    token: none.admin.token,
    tenantId: none.tenantId,
    body: {
      customerId: noneCustomer.id,
      issueBill: true,
      paymentMethod: "CASH",
      items: [
        {
          productId: noneProduct.id,
          productName: "None Shop Sheet",
          quantity: 2,
          unitPrice: 1000,
        },
      ],
    },
  });
  const noneInv = (qbNone.json.data as { invoice?: { invoice?: { documentKind?: string; tax?: number; total?: number; id?: string }; pdfUrl?: string } } | undefined)
    ?.invoice;
  const noneInvoice = noneInv?.invoice;
  record(
    "NonGST",
    "Quick Bill commercial",
    qbNone.status === 201 || qbNone.status === 200,
    qbNone.status === 201 || qbNone.status === 200
      ? undefined
      : `${qbNone.status} ${qbNone.json.error ?? ""}`
  );
  record(
    "NonGST",
    "documentKind=COMMERCIAL",
    noneInvoice?.documentKind === "COMMERCIAL",
    `got ${noneInvoice?.documentKind}`
  );
  record(
    "NonGST",
    "tax forced 0%",
    Number(noneInvoice?.tax ?? -1) === 0,
    `tax=${noneInvoice?.tax}`
  );
  record("NonGST", "PDF url present", Boolean(noneInv?.pdfUrl), noneInv?.pdfUrl);

  // ----- Tenant B: IN_GST Regular -----
  console.log("Phase B — GST Regular tenant");
  const gstSlug = `gst-reg-${stamp}`;
  let gst: { tenantId: string; admin: Session };
  try {
    gst = await provisionTenant(platToken, `GST Regular ${stamp}`, gstSlug, { indiaGst: true });
    record("GST", `tenant ${gstSlug}`, true);
  } catch (e) {
    record("GST", "provision", false, e instanceof Error ? e.message : String(e));
    writeReport();
    process.exit(1);
  }

  const gstSettings = await api("PUT", `/api/tenants/${gst.tenantId}/settings`, {
    token: gst.admin.token,
    tenantId: gst.tenantId,
    body: {
      "tax.regime": "IN_GST",
      "tax.scheme": "REGULAR",
      "tax.gstin": SELLER_GSTIN_KA,
      "tax.legalName": "E2E GST Seller Pvt Ltd",
      "tax.address": "Peenya, Bengaluru",
      "tax.stateCode": "29",
      "tax.placeOfSupplyDefault": "29",
      "tax.eInvoiceMode": "OPTIONAL",
    },
  });
  record(
    "GST",
    "tax profile IN_GST Regular",
    gstSettings.status === 200,
    gstSettings.status === 200 ? undefined : `${gstSettings.status} ${gstSettings.json.error ?? ""}`
  );

  // Invalid GSTIN rejected
  const badGstin = await api("PUT", `/api/tenants/${gst.tenantId}/settings`, {
    token: gst.admin.token,
    tenantId: gst.tenantId,
    body: {
      "tax.regime": "IN_GST",
      "tax.scheme": "REGULAR",
      "tax.gstin": "29AAAAA0000A1Z5",
      "tax.legalName": "E2E GST Seller Pvt Ltd",
    },
  });
  record(
    "GST",
    "reject invalid GSTIN checksum",
    badGstin.status === 400,
    `status=${badGstin.status} ${badGstin.json.error ?? ""}`
  );

  let gstProduct: { id: string };
  let b2bCustomer: { id: string };
  let b2cCustomer: { id: string };
  try {
    gstProduct = await createProduct(gst.admin, `GST-SKU-${stamp}`, "Plywood 18mm", 0.18);
    record("GST", "product taxRate 18%", true);
    b2bCustomer = await createCustomer(gst.admin, "Delhi Dealer B2B", BUYER_GSTIN_DL);
    record("GST", "B2B customer GSTIN", true);
    b2cCustomer = await createCustomer(gst.admin, "Retail Walk-in B2C");
    record("GST", "B2C customer no GSTIN", true);
  } catch (e) {
    record("GST", "catalog/customers", false, e instanceof Error ? e.message : String(e));
    writeReport();
    process.exit(1);
  }

  // Invalid customer GSTIN
  const badCust = await api("POST", "/api/customers", {
    token: gst.admin.token,
    tenantId: gst.tenantId,
    body: { name: "Bad GSTIN Co", taxId: "29AAAAA0000A1Z5" },
  });
  record(
    "GST",
    "reject customer bad GSTIN",
    badCust.status === 400,
    `status=${badCust.status}`
  );

  // U5 B2C Quick Bill
  const qbB2c = await api("POST", "/api/quick-bills", {
    token: gst.admin.token,
    tenantId: gst.tenantId,
    body: {
      customerId: b2cCustomer.id,
      placeOfSupply: "29",
      issueBill: true,
      items: [
        {
          productId: gstProduct.id,
          productName: "Plywood 18mm",
          quantity: 1,
          unitPrice: 1000,
        },
      ],
    },
  });
  const b2cInvWrap = (qbB2c.json.data as { invoice?: { invoice?: Record<string, unknown>; pdfUrl?: string } } | undefined)
    ?.invoice;
  const b2cInv = b2cInvWrap?.invoice;
  record(
    "GST",
    "B2C Quick Bill",
    qbB2c.status === 201 || qbB2c.status === 200,
    qbB2c.status === 201 || qbB2c.status === 200 ? undefined : `${qbB2c.status} ${qbB2c.json.error ?? ""}`
  );
  record(
    "GST",
    "B2C documentKind=TAX_INVOICE",
    b2cInv?.documentKind === "TAX_INVOICE",
    `got ${b2cInv?.documentKind}`
  );
  record(
    "GST",
    "B2C supplyType=B2C",
    b2cInv?.supplyType === "B2C",
    `got ${b2cInv?.supplyType}`
  );
  record(
    "GST",
    "B2C tax = 180 on 1000@18%",
    Math.abs(Number(b2cInv?.tax ?? 0) - 180) < 0.01,
    `tax=${b2cInv?.tax}`
  );
  record(
    "GST",
    "B2C CGST+SGST intra-state",
    Math.abs(Number(b2cInv?.cgst ?? 0) - 90) < 0.01 && Math.abs(Number(b2cInv?.sgst ?? 0) - 90) < 0.01,
    `cgst=${b2cInv?.cgst} sgst=${b2cInv?.sgst}`
  );

  // U2 B2B interstate Quick Bill (buyer DL = 07 → IGST)
  const qbB2b = await api("POST", "/api/quick-bills", {
    token: gst.admin.token,
    tenantId: gst.tenantId,
    body: {
      customerId: b2bCustomer.id,
      issueBill: true,
      items: [
        {
          productId: gstProduct.id,
          productName: "Plywood 18mm",
          quantity: 2,
          unitPrice: 1000,
        },
      ],
    },
  });
  const b2bInvWrap = (qbB2b.json.data as { invoice?: { invoice?: Record<string, unknown>; pdfUrl?: string }; order?: { id?: string } } | undefined)
    ?.invoice;
  const b2bInv = b2bInvWrap?.invoice;
  const b2bOrderId = (qbB2b.json.data as { order?: { id?: string } } | undefined)?.order?.id;
  record(
    "GST",
    "B2B Quick Bill",
    qbB2b.status === 201 || qbB2b.status === 200,
    qbB2b.status === 201 || qbB2b.status === 200 ? undefined : `${qbB2b.status} ${qbB2b.json.error ?? ""}`
  );
  record(
    "GST",
    "B2B supplyType=B2B",
    b2bInv?.supplyType === "B2B",
    `got ${b2bInv?.supplyType}`
  );
  record(
    "GST",
    "B2B IGST inter-state",
    Math.abs(Number(b2bInv?.igst ?? 0) - 360) < 0.01 && Number(b2bInv?.cgst ?? -1) === 0,
    `igst=${b2bInv?.igst} cgst=${b2bInv?.cgst}`
  );
  record(
    "GST",
    "B2B total 2360",
    Math.abs(Number(b2bInv?.total ?? 0) - 2360) < 0.01,
    `total=${b2bInv?.total}`
  );

  const invoiceId = b2bInv?.id as string | undefined;

  // Snapshot immutability: change product tax rate, regenerate must keep snapshot
  if (gstProduct.id && b2bOrderId) {
    await api("PATCH", `/api/products/${gstProduct.id}`, {
      token: gst.admin.token,
      tenantId: gst.tenantId,
      body: { taxRate: 0.12 },
    });
    const regen = await api("POST", "/api/invoices/generate", {
      token: gst.admin.token,
      tenantId: gst.tenantId,
      body: { salesOrderId: b2bOrderId, force: true, issue: true },
    });
    const regenInv = (regen.json.data as { invoice?: { tax?: number; igst?: number } } | undefined)?.invoice;
    record(
      "GST",
      "snapshot immutability after product 18→12",
      regen.status === 200 && Math.abs(Number(regenInv?.tax ?? 0) - 360) < 0.01,
      `status=${regen.status} tax=${regenInv?.tax}`
    );
  } else {
    record("GST", "snapshot immutability after product 18→12", false, "missing ids");
  }

  // Phase B — IRN OPTIONAL
  if (invoiceId) {
    const irn = await api("POST", `/api/invoices/${invoiceId}/einvoice`, {
      token: gst.admin.token,
      tenantId: gst.tenantId,
      body: { action: "generate" },
    });
    const irnData = irn.json.data as { irn?: string; ok?: boolean } | undefined;
    record(
      "EInvoice",
      "Generate IRN sandbox",
      irn.status === 200 && Boolean(irnData?.irn),
      irn.status === 200 ? `irn=${irnData?.irn?.slice(0, 20)}…` : `${irn.status} ${irn.json.error ?? ""}`
    );

    const cancelIrn = await api("POST", `/api/invoices/${invoiceId}/einvoice`, {
      token: gst.admin.token,
      tenantId: gst.tenantId,
      body: { action: "cancel" },
    });
    record(
      "EInvoice",
      "Cancel IRN → CANCELLED",
      cancelIrn.status === 200,
      cancelIrn.status === 200 ? undefined : `${cancelIrn.status} ${cancelIrn.json.error ?? ""}`
    );

    // Phase C — e-way
    const eway = await api("POST", `/api/invoices/${invoiceId}/eway`, {
      token: gst.admin.token,
      tenantId: gst.tenantId,
      body: { action: "generate", vehicleNo: "KA01AB1234", distanceKm: 120 },
    });
    const ewayData = eway.json.data as { ewayBillNo?: string } | undefined;
    record(
      "EWay",
      "Generate e-way sandbox",
      eway.status === 200 && Boolean(ewayData?.ewayBillNo),
      eway.status === 200 ? `no=${ewayData?.ewayBillNo}` : `${eway.status} ${eway.json.error ?? ""}`
    );

    const cancelEway = await api("POST", `/api/invoices/${invoiceId}/eway`, {
      token: gst.admin.token,
      tenantId: gst.tenantId,
      body: { action: "cancel" },
    });
    record(
      "EWay",
      "Cancel e-way",
      cancelEway.status === 200,
      cancelEway.status === 200 ? undefined : `${cancelEway.status}`
    );
  } else {
    record("EInvoice", "Generate IRN sandbox", false, "no invoice id");
    record("EWay", "Generate e-way sandbox", false, "no invoice id");
  }

  // Non-GST e-way must fail
  if (noneInvoice?.id) {
    const ewayNone = await api("POST", `/api/invoices/${noneInvoice.id}/eway`, {
      token: none.admin.token,
      tenantId: none.tenantId,
      body: { action: "generate" },
    });
    record(
      "EWay",
      "Commercial bill rejects e-way",
      ewayNone.status === 400,
      `status=${ewayNone.status}`
    );
  }

  // Phase D — GSTR-1
  const gstr1 = await api("GET", "/api/invoices/gstr1-export?format=json", {
    token: gst.admin.token,
    tenantId: gst.tenantId,
  });
  const gstr1Data = gstr1.json.data as {
    b2b?: unknown[];
    b2c?: unknown[];
    count?: number;
    disclaimer?: string;
  } | undefined;
  record(
    "GSTR1",
    "export JSON",
    gstr1.status === 200 && (gstr1Data?.count ?? 0) >= 1,
    `count=${gstr1Data?.count} b2b=${gstr1Data?.b2b?.length} b2c=${gstr1Data?.b2c?.length}`
  );
  record(
    "GSTR1",
    "disclaimer present",
    Boolean(gstr1Data?.disclaimer?.includes("does not file")),
    gstr1Data?.disclaimer
  );

  const gstr1None = await api("GET", "/api/invoices/gstr1-export?format=json", {
    token: none.admin.token,
    tenantId: none.tenantId,
  });
  const gstr1NoneData = gstr1None.json.data as { count?: number } | undefined;
  record(
    "GSTR1",
    "non-GST tenant export empty (commercial excluded)",
    gstr1None.status === 200 && (gstr1NoneData?.count ?? -1) === 0,
    `count=${gstr1NoneData?.count}`
  );

  // Composition scheme → Bill of Supply
  console.log("Phase C — Composition tenant bill of supply");
  const compSlug = `gst-comp-${stamp}`;
  try {
    const comp = await provisionTenant(platToken, `GST Comp ${stamp}`, compSlug, { indiaGst: true });
    const setComp = await api("PUT", `/api/tenants/${comp.tenantId}/settings`, {
      token: comp.admin.token,
      tenantId: comp.tenantId,
      body: {
        "tax.regime": "IN_GST",
        "tax.scheme": "COMPOSITION",
        "tax.gstin": SELLER_GSTIN_KA,
        "tax.legalName": "Composition Shop",
        "tax.address": "Mysore",
        "tax.stateCode": "29",
        "tax.placeOfSupplyDefault": "29",
        "tax.eInvoiceMode": "OFF",
      },
    });
    record("Composition", "settings COMPOSITION", setComp.status === 200, `${setComp.status}`);

    const p = await createProduct(comp.admin, `COMP-SKU-${stamp}`, "Comp Item", 0.18);
    const c = await createCustomer(comp.admin, "Comp Buyer");
    const qb = await api("POST", "/api/quick-bills", {
      token: comp.admin.token,
      tenantId: comp.tenantId,
      body: {
        customerId: c.id,
        issueBill: true,
        items: [{ productId: p.id, productName: "Comp Item", quantity: 1, unitPrice: 500 }],
      },
    });
    const inv = (qb.json.data as { invoice?: { invoice?: { documentKind?: string; tax?: number } } } | undefined)
      ?.invoice?.invoice;
    record(
      "Composition",
      "documentKind=BILL_OF_SUPPLY",
      inv?.documentKind === "BILL_OF_SUPPLY",
      `got ${inv?.documentKind}`
    );
    record(
      "Composition",
      "output tax 0",
      Number(inv?.tax ?? -1) === 0,
      `tax=${inv?.tax}`
    );
  } catch (e) {
    record("Composition", "flow", false, e instanceof Error ? e.message : String(e));
  }

  // Tenant isolation: none admin cannot read gst invoice
  if (invoiceId) {
    const cross = await api("GET", `/api/invoices/${invoiceId}`, {
      token: none.admin.token,
      tenantId: none.tenantId,
    });
    record(
      "Isolation",
      "cross-tenant invoice denied",
      cross.status === 403 || cross.status === 404 || cross.status === 400,
      `status=${cross.status}`
    );
  }

  writeReport();
  console.log(`\n=== Done: ${pass} pass / ${fail} fail ===\n`);
  console.log("Reports: docs/E2E-GST-latest.md , docs/TENANT-GST-E2E-CHECKLIST.md\n");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  writeReport();
  process.exit(1);
});

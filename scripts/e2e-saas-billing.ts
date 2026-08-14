/**
 * Sankalp SaaS billing E2E (DEMO) — internal BillingInvoice ledger, not dealer AR.
 *
 *   pnpm e2e:saas
 *
 * HTTP only. No Prisma. No Razorpay. DEMO asOf time-travels POST /api/billing/run.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const PLATFORM_EMAIL = process.env.PLATFORM_OWNER_EMAIL || "platform@erp.local";
const PLATFORM_PASSWORD = process.env.PLATFORM_OWNER_PASSWORD || "Platform@123";
const ADMIN_PASSWORD = "SaasAdmin1!x";
const STAFF_PASSWORD = "SaasStaff1!x";

type Session = { token: string; tenantId: string };
type Json = { data?: unknown; error?: string; code?: string; reason?: string };
type ReportLine = { ok: boolean; section: string; name: string; detail?: string };
type Plan = { id: string; code: string; includedSeats?: number };
type Invoice = { id: string; status: string; billingPeriodKey: string; invoiceNumber?: string };
type SubRow = {
  status?: string;
  currentPeriodEnd?: string | null;
  nextBillingDate?: string | null;
  seatLimit?: number;
  featureCodes?: string[];
  plan?: { code?: string; name?: string };
  invoices?: Invoice[];
};
type Entitlement = { licensed?: boolean; reason?: string; status?: string; features?: string[] };

const started = new Date();
const stamp = Date.now().toString(36);
const lines: ReportLine[] = [];
let pass = 0;
let fail = 0;

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

function writeReport() {
  const md = [
    "# Sankalp SaaS billing E2E",
    "",
    `Stamp: ${stamp}`,
    `Started: ${started.toISOString()}`,
    `Duration: ${((Date.now() - started.getTime()) / 1000).toFixed(1)}s`,
    `Result: ${pass} pass / ${fail} fail`,
    "",
    "Provider: DEMO only (no Razorpay HTTP).",
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
  writeFileSync(join(outDir, "E2E-SAAS-BILLING-latest.md"), md.join("\n"));
}

async function provision(
  platToken: string,
  label: string
): Promise<{ slug: string; tenantId: string; admin: Session }> {
  const slug = `saas-${stamp}-${label}`;
  const created = await api("POST", "/api/platform/tenants", {
    token: platToken,
    body: {
      name: `SaaS ${label} ${stamp}`,
      slug,
      plan: "starter",
      adminEmail: `admin-${label}@${slug}.test`,
      adminName: "SaaS E2E Admin",
      adminPassword: ADMIN_PASSWORD,
    },
  });
  const tenantId = (created.json.data as { tenantId?: string } | undefined)?.tenantId;
  if ((created.status !== 201 && created.status !== 200) || !tenantId) {
    throw new Error(`Create tenant ${label}: ${created.status} ${created.json.error ?? ""}`);
  }
  await api("PUT", `/api/platform/licenses/${tenantId}`, {
    token: platToken,
    body: {
      modules: [
        { moduleId: "core", plan: "basic", isActive: true },
        { moduleId: "sales", plan: "basic", isActive: true },
        { moduleId: "inventory", plan: "basic", isActive: true },
      ],
    },
  });
  const admin = await login(`admin-${label}@${slug}.test`, ADMIN_PASSWORD, slug);
  return { slug, tenantId, admin };
}

async function catalog(admin: Session) {
  const product = await api("POST", "/api/products", {
    token: admin.token,
    tenantId: admin.tenantId,
    body: { sku: "SAAS-SKU", name: "SaaS widget", sellPrice: 100, unit: "pcs", pricingBasis: "PER_EACH" },
  });
  const customer = await api("POST", "/api/customers", {
    token: admin.token,
    tenantId: admin.tenantId,
    body: { name: "SaaS Buyer" },
  });
  return {
    productId: (product.json.data as { id?: string } | undefined)?.id,
    customerId: (customer.json.data as { id?: string } | undefined)?.id,
    productStatus: product.status,
    customerStatus: customer.status,
  };
}

async function getSub(admin: Session) {
  const res = await api("GET", "/api/billing/subscription", {
    token: admin.token,
    tenantId: admin.tenantId,
  });
  const data = res.json.data as { entitlement?: Entitlement; subscription?: SubRow | null; mode?: string } | undefined;
  return { status: res.status, entitlement: data?.entitlement, subscription: data?.subscription ?? null, mode: data?.mode };
}

async function sreq(admin: Session, customerId?: string, productId?: string) {
  return api("POST", "/api/sales-requests", {
    token: admin.token,
    tenantId: admin.tenantId,
    body:
      customerId && productId
        ? {
            customerId,
            items: [{ productId, productName: "SaaS widget", quantity: 1, unitPrice: 100 }],
          }
        : {},
  });
}

async function main() {
  console.log(`SaaS billing E2E stamp ${stamp}`);

  const plat = await api("POST", "/api/platform/auth", {
    body: { email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD },
  });
  const platToken = (plat.json.data as { accessToken?: string } | undefined)?.accessToken;
  if (plat.status !== 200 || !platToken) {
    throw new Error(`Platform login: ${plat.status} ${plat.json.error ?? ""}`);
  }
  record("Setup", "platform login", true);

  const growth = await provision(platToken, "growth");
  const starter = await provision(platToken, "starter");
  const lifetime = await provision(platToken, "once");
  record("Setup", "provision growth/starter/lifetime tenants", true);

  const plansRes = await api("GET", "/api/billing/plans", {
    token: growth.admin.token,
    tenantId: growth.admin.tenantId,
  });
  const planList = (plansRes.json.data as Plan[] | undefined) ?? [];
  const growthPlan = planList.find((p) => p.code === "growth_monthly");
  const starterPlan = planList.find((p) => p.code === "starter_monthly");
  const oncePlan = planList.find((p) => p.code === "lifetime_once");
  record("Plans", "growth/starter/lifetime listed", !!growthPlan && !!starterPlan && !!oncePlan, `${plansRes.status}`);

  const customCode = `pro_q_${stamp}`;
  const createBody = {
    code: customCode,
    name: "Pro Quarterly",
    billingInterval: "QUARTERLY",
    amountPaise: 150_000,
    currency: "INR",
    includedSeats: 10,
    isActive: true,
    featureCodes: ["oms", "inventory"],
  };
  const created = await api("POST", "/api/billing/plans", { token: platToken, body: createBody });
  const createdPlan = created.json.data as
    | { id?: string; code?: string; billingInterval?: string; featureCodes?: string[] }
    | undefined;
  record(
    "Plans",
    "platform creates quarterly plan",
    created.status === 201 &&
      createdPlan?.code === customCode &&
      createdPlan.billingInterval === "QUARTERLY" &&
      (createdPlan.featureCodes ?? []).includes("dashboard") &&
      (createdPlan.featureCodes ?? []).includes("oms"),
    `${created.status} ${created.json.error ?? createdPlan?.code ?? ""}`
  );

  const dupPlan = await api("POST", "/api/billing/plans", { token: platToken, body: createBody });
  record("Plans", "duplicate plan code 409", dupPlan.status === 409, `${dupPlan.status} ${dupPlan.json.error ?? ""}`);

  const tenantPlans = await api("GET", "/api/billing/plans", {
    token: growth.admin.token,
    tenantId: growth.admin.tenantId,
  });
  const listedCustom = ((tenantPlans.json.data as Plan[] | undefined) ?? []).some((p) => p.code === customCode);
  record("Plans", "tenant catalog includes new plan", listedCustom, `${tenantPlans.status}`);

  // ── Growth: Free → upgrade invoice → pay → renewal lead ─────────────────
  const before = await getSub(growth.admin);
  record(
    "Free",
    "new tenant is Free (no OMS)",
    before.status === 200 &&
      before.entitlement?.licensed === true &&
      (before.entitlement.reason === "free" || before.entitlement.reason === "free_fallback") &&
      !(before.entitlement.features ?? []).includes("oms"),
    `${before.status} ${before.entitlement?.reason ?? ""} feats=${(before.entitlement?.features ?? []).join(",")}`
  );

  const sub = await api("POST", "/api/billing/subscribe", {
    token: growth.admin.token,
    tenantId: growth.admin.tenantId,
    body: { planId: growthPlan?.id },
  });
  const subData = sub.json.data as { status?: string; invoiceId?: string } | undefined;
  const afterPick = await getSub(growth.admin);
  record(
    "Subscribe",
    "OPEN Growth invoice; still Free until paid",
    sub.status === 200 &&
      !!subData?.invoiceId &&
      afterPick.entitlement?.licensed === true &&
      !(afterPick.entitlement.features ?? []).includes("oms"),
    `${sub.status} ${sub.json.error ?? subData?.status ?? ""} feats=${(afterPick.entitlement?.features ?? []).join(",")}`
  );

  const blocked = await sreq(growth.admin);
  record(
    "Entitlement",
    "Free blocks new SREQ",
    blocked.status === 403 && (blocked.json.code === "SAAS_FEATURE" || blocked.json.code === "SAAS_UNLICENSED"),
    `${blocked.status} ${blocked.json.code ?? blocked.json.error ?? ""}`
  );

  const pay1 = await api("POST", "/api/billing/demo-pay", {
    token: growth.admin.token,
    tenantId: growth.admin.tenantId,
    body: { invoiceId: subData?.invoiceId },
  });
  const pay1Data = pay1.json.data as {
    duplicate?: boolean;
    fullyPaid?: boolean;
    subscription?: { status?: string };
    invoice?: { status?: string };
  } | undefined;
  record(
    "Capture",
    "demo-pay → PAID + ACTIVE",
    pay1.status === 200 &&
      pay1Data?.fullyPaid === true &&
      !pay1Data.duplicate &&
      pay1Data.subscription?.status === "ACTIVE" &&
      pay1Data.invoice?.status === "PAID",
    `${pay1.status} ${JSON.stringify({ status: pay1Data?.subscription?.status, invoice: pay1Data?.invoice?.status, dup: pay1Data?.duplicate })}`
  );

  const cat = await catalog(growth.admin);
  record("OMS", "catalog + customer", !!cat.productId && !!cat.customerId, `${cat.productStatus}/${cat.customerStatus}`);

  const allowed = await sreq(growth.admin, cat.customerId, cat.productId);
  record("Entitlement", "ACTIVE allows SREQ", allowed.status === 201, `${allowed.status} ${allowed.json.error ?? ""}`);

  const dup = await api("POST", "/api/billing/demo-pay", {
    token: growth.admin.token,
    tenantId: growth.admin.tenantId,
    body: { invoiceId: subData?.invoiceId },
  });
  const dupData = dup.json.data as { duplicate?: boolean } | undefined;
  record(
    "Idempotency",
    "duplicate demo-pay no-op",
    dup.status === 200 && dupData?.duplicate === true,
    `${dup.status} ${JSON.stringify(dupData)}`
  );

  const paidSub = await getSub(growth.admin);
  const periodEndBefore = paidSub.subscription?.currentPeriodEnd ?? null;
  const nextBill = paidSub.subscription?.nextBillingDate;
  record(
    "Period",
    "ACTIVE has period end + next billing date",
    paidSub.subscription?.status === "ACTIVE" && !!periodEndBefore && !!nextBill,
    `${paidSub.subscription?.status} end=${periodEndBefore} next=${nextBill}`
  );

  const leadAt = periodEndBefore
    ? new Date(new Date(periodEndBefore).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    : nextBill;
  const run1 = await api("POST", "/api/billing/run", {
    token: platToken,
    body: { asOf: leadAt },
  });
  const run2 = await api("POST", "/api/billing/run", {
    token: platToken,
    body: { asOf: leadAt },
  });
  record("Billing run", "lead-window run accepted twice", run1.status === 200 && run2.status === 200, `${run1.status}/${run2.status}`);

  const afterRun = await getSub(growth.admin);
  const openAfter = (afterRun.subscription?.invoices ?? []).filter((i) => i.status === "OPEN");
  const periodUnchanged = afterRun.subscription?.currentPeriodEnd === periodEndBefore;
  record(
    "Billing run",
    "one OPEN renewal invoice; period not extended",
    openAfter.length === 1 && openAfter[0]!.id !== subData?.invoiceId && periodUnchanged,
    `open=${openAfter.length} ids=${openAfter.map((i) => i.id).join(",")} periodEnd=${afterRun.subscription?.currentPeriodEnd}`
  );

  const stillLicensed = await sreq(growth.admin, cat.customerId, cat.productId);
  record(
    "Entitlement",
    "unpaid renewal still licensed",
    stillLicensed.status === 201,
    `${stillLicensed.status} ${stillLicensed.json.error ?? afterRun.entitlement?.reason ?? ""}`
  );

  const payRenew = await api("POST", "/api/billing/demo-pay", {
    token: growth.admin.token,
    tenantId: growth.admin.tenantId,
    body: { invoiceId: openAfter[0]?.id },
  });
  const afterPay = await getSub(growth.admin);
  record(
    "Renewal pay",
    "PAID extends period",
    payRenew.status === 200 &&
      afterPay.subscription?.status === "ACTIVE" &&
      afterPay.subscription.currentPeriodEnd !== periodEndBefore &&
      !!afterPay.subscription.currentPeriodEnd,
    `${payRenew.status} ${afterPay.subscription?.status} ${afterPay.subscription?.currentPeriodEnd}`
  );

  // ── Starter: feature + seat cap ─────────────────────────────────────────
  const starterSub = await api("POST", "/api/billing/subscribe", {
    token: starter.admin.token,
    tenantId: starter.admin.tenantId,
    body: { planId: starterPlan?.id },
  });
  const starterInv = (starterSub.json.data as { invoiceId?: string } | undefined)?.invoiceId;
  await api("POST", "/api/billing/demo-pay", {
    token: starter.admin.token,
    tenantId: starter.admin.tenantId,
    body: { invoiceId: starterInv },
  });
  const starterCat = await catalog(starter.admin);
  const starterSreq = await sreq(starter.admin, starterCat.customerId, starterCat.productId);
  record(
    "Starter",
    "oms SREQ allowed",
    starterSreq.status === 201,
    `${starterSreq.status} ${starterSreq.json.error ?? ""}`
  );

  const qb = await api("POST", "/api/quick-bills", {
    token: starter.admin.token,
    tenantId: starter.admin.tenantId,
    body: {
      customerId: starterCat.customerId,
      issueBill: true,
      paymentMethod: "CASH",
      items: [{ productId: starterCat.productId, productName: "SaaS widget", quantity: 1, unitPrice: 100 }],
    },
  });
  record(
    "Starter",
    "quick_bill blocked",
    qb.status === 403 && qb.json.code === "SAAS_FEATURE",
    `${qb.status} ${qb.json.code ?? qb.json.error ?? ""}`
  );

  let seatFail: { status: number; code?: string } = { status: 0 };
  for (let i = 0; i < 6; i++) {
    const u = await api("POST", `/api/tenants/${starter.tenantId}/users`, {
      token: starter.admin.token,
      tenantId: starter.tenantId,
      body: {
        action: "create",
        email: `staff${i}@${starter.slug}.test`,
        name: `Staff ${i}`,
        password: STAFF_PASSWORD,
        role: "USER",
      },
    });
    if (u.status === 403) {
      seatFail = { status: u.status, code: u.json.code };
      break;
    }
  }
  record(
    "Starter",
    "seat limit 403",
    seatFail.status === 403 && seatFail.code === "SAAS_SEAT_LIMIT",
    `${seatFail.status} ${seatFail.code ?? ""}`
  );

  const starterPaid = await getSub(starter.admin);
  const starterEnd = starterPaid.subscription?.currentPeriodEnd;
  if (starterEnd) {
    const pastGrace = new Date(new Date(starterEnd).getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
    await api("POST", "/api/billing/run", { token: platToken, body: { asOf: pastGrace } });
  }
  const afterGrace = await getSub(starter.admin);
  const graceSreq = await sreq(starter.admin, starterCat.customerId, starterCat.productId);
  record(
    "Starter",
    "unpaid after grace downgrades to Free",
    !(afterGrace.entitlement?.features ?? []).includes("oms") &&
      (graceSreq.status === 403) &&
      afterGrace.subscription?.plan?.code === "free_once",
    `feats=${(afterGrace.entitlement?.features ?? []).join(",")} sreq=${graceSreq.status} plan=${afterGrace.subscription?.plan?.code ?? ""}`
  );

  // ── Lifetime ONCE ───────────────────────────────────────────────────────
  const onceSub = await api("POST", "/api/billing/subscribe", {
    token: lifetime.admin.token,
    tenantId: lifetime.admin.tenantId,
    body: { planId: oncePlan?.id },
  });
  const onceInv = (onceSub.json.data as { invoiceId?: string } | undefined)?.invoiceId;
  const oncePay = await api("POST", "/api/billing/demo-pay", {
    token: lifetime.admin.token,
    tenantId: lifetime.admin.tenantId,
    body: { invoiceId: onceInv },
  });
  const onceState = await getSub(lifetime.admin);
  record(
    "Lifetime",
    "ONCE → perpetual ACTIVE",
    oncePay.status === 200 &&
      onceState.subscription?.status === "ACTIVE" &&
      onceState.subscription.currentPeriodEnd == null,
    `${oncePay.status} ${onceState.subscription?.status} end=${onceState.subscription?.currentPeriodEnd}`
  );

  const onceRun = await api("POST", "/api/billing/run", {
    token: platToken,
    body: { asOf: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString() },
  });
  const onceAfter = await getSub(lifetime.admin);
  const onceOpen = (onceAfter.subscription?.invoices ?? []).filter((i) => i.status === "OPEN");
  record(
    "Lifetime",
    "billing run does not open another invoice",
    onceRun.status === 200 && onceOpen.length === 0 && onceAfter.subscription?.status === "ACTIVE",
    `${onceRun.status} open=${onceOpen.length} ${onceAfter.subscription?.status}`
  );

  record("Provider", "DEMO path only (no Razorpay HTTP)", true);

  writeReport();
  console.log(`\nResult: ${pass} pass / ${fail} fail`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  record("Fatal", err instanceof Error ? err.message : String(err), false);
  writeReport();
  process.exit(1);
});

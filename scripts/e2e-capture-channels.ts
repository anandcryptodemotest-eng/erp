/**
 * E2E — capture channels converge on one OMS.
 * Walk-in SO + Lead-to-Cash (Quote convert idempotent) + sourceKind guards.
 *
 *   pnpm e2e:capture
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const TENANT = process.env.TENANT_SLUG ?? "trustwood-enterprise";

type LoginResult = { token: string; tenantId: string; role: string };

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
  const data = json.data as { accessToken: string; tenant: { id: string }; user: { role: string } };
  return { token: data.accessToken, tenantId: data.tenant.id, role: data.user.role };
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

function assertTaskSnapshot(data: unknown) {
  const o = data as {
    status?: string;
    sourceKind?: string;
    workflowRuntime?: { tasks?: { action?: string; title?: string; status?: string }[] };
  };
  if (o.status !== "CONFIRMED") throw new Error(`status ${o.status}`);
  const tasks = o.workflowRuntime?.tasks ?? [];
  if (tasks.length < 2) throw new Error(`expected workflow tasks, got ${tasks.length}`);
  const review = tasks.find((t) => t.action === "review" || /sales_review|sales review/i.test(`${t.action} ${t.title}`));
  if (!review) throw new Error("missing sales_review task");
  if (review.status !== "READY") throw new Error(`sales_review ${review.status}`);
  const waiting = tasks.filter((t) => t.status === "WAITING");
  if (waiting.length < 1) throw new Error("expected remaining WAITING tasks");
}

async function main() {
  console.log(`\n=== Capture channels E2E against ${BASE} tenant=${TENANT} ===\n`);

  const admin = await login("admin@simhapurifresh.com", "Admin@123");
  const sales = await login("sales@trustwood.test", "Sales@123");
  ok("Staff personas logged in");

  const plat = await api("POST", "/api/platform/auth", {
    body: { email: "platform@erp.local", password: "Platform@123" },
  });
  if (plat.status === 200 && plat.json.data) {
    const platToken = (plat.json.data as { accessToken: string }).accessToken;
    const grant = await api("POST", `/api/platform/tenants/${admin.tenantId}/billing/grant`, {
      token: platToken,
      body: { planCode: "growth_monthly" },
    });
    if (grant.status === 200) ok("Growth plan granted (oms)");
    else bad("Growth plan granted (oms)", `HTTP ${grant.status} ${grant.json.error ?? ""}`);
  } else {
    bad("Platform login for Growth grant", `${plat.status}`);
  }

  await expectStatus("Seed workflow templates", "GET", "/api/workflow-templates", admin, undefined, 200);
  await expectStatus(
    "Apply OMS trading template",
    "POST",
    "/api/order-workflows",
    admin,
    { templateId: "workflow.oms_trading", setDefault: true },
    [200, 201]
  );

  const products = (await expectStatus(
    "Product catalog",
    "GET",
    "/api/products?limit=10",
    sales,
    undefined,
    200
  )) as { id: string; name: string; sellPrice: number; sku: string }[] | null;
  const product =
    products?.find((p) => p.sku === "TW-ADH-1L") ??
    products?.find((p) => p.sku?.startsWith("TW-")) ??
    products?.[0];
  if (!product) {
    bad("missing product");
    process.exit(1);
  }
  const unitPrice = Number(product.sellPrice) > 0 ? Number(product.sellPrice) : 350;
  const line = {
    productId: product.id,
    productName: product.name,
    quantity: 2,
    unitPrice,
  };

  console.log("\nTC1 — Walk-in SO (CONFIRMED + SO_STANDARD)");
  const mixed = await api("POST", "/api/orders", {
    token: sales.token,
    tenantId: sales.tenantId,
    body: { sourceKind: "WALK_IN", quoteId: "q-illegal", walkInName: "Guard", items: [line] },
  });
  if (mixed.status === 400) ok("WALK_IN rejects quoteId");
  else bad("WALK_IN rejects quoteId", `HTTP ${mixed.status} ${mixed.json.error ?? ""}`);

  const sreqMix = await api("POST", "/api/orders", {
    token: sales.token,
    tenantId: sales.tenantId,
    body: { sourceKind: "WALK_IN", salesRequestId: "s-illegal", walkInName: "Guard", items: [line] },
  });
  if (sreqMix.status === 400) ok("WALK_IN rejects salesRequestId");
  else bad("WALK_IN rejects salesRequestId", `HTTP ${sreqMix.status}`);

  const missing = await api("POST", "/api/orders", {
    token: sales.token,
    tenantId: sales.tenantId,
    body: { sourceKind: "WALK_IN", items: [line] },
  });
  if (missing.status === 400) ok("WALK_IN requires customer or name");
  else bad("WALK_IN requires customer or name", `HTTP ${missing.status}`);

  const walkIn = (await expectStatus(
    "POST walk-in SO CONFIRMED",
    "POST",
    "/api/orders",
    sales,
    {
      sourceKind: "WALK_IN",
      walkInName: "Counter Walk-in",
      walkInPhone: "9876500123",
      items: [line],
    },
    201,
    (data) => {
      const o = data as { status: string; sourceKind: string; quoteId?: string | null };
      if (o.status !== "CONFIRMED") throw new Error(`status ${o.status}`);
      if (o.sourceKind !== "WALK_IN") throw new Error(`sourceKind ${o.sourceKind}`);
      if (o.quoteId) throw new Error("walk-in must not have quoteId");
    }
  )) as { id: string } | null;
  if (!walkIn?.id) {
    console.log("\nAborting — no walk-in SO\n");
    process.exit(1);
  }
  await expectStatus("Walk-in task snapshot", "GET", `/api/orders/${walkIn.id}`, sales, undefined, 200, (data) => {
    const o = data as { sourceKind?: string };
    if (o.sourceKind !== "WALK_IN") throw new Error(`sourceKind ${o.sourceKind}`);
    assertTaskSnapshot(data);
  });

  console.log("\nTC2 — Lead → Opportunity → Quote → SO");
  const stamp = Date.now();
  const lead = (await expectStatus(
    "Create lead",
    "POST",
    "/api/leads",
    sales,
    { name: `L2C ${stamp}`, phone: `98${String(stamp).slice(-8)}`, company: "L2C Co" },
    201
  )) as { id: string } | null;
  if (!lead?.id) process.exit(1);

  await expectStatus("Lead CONTACTED", "PATCH", `/api/leads/${lead.id}`, sales, { status: "CONTACTED" }, 200);
  await expectStatus("Lead QUALIFIED", "PATCH", `/api/leads/${lead.id}`, sales, { status: "QUALIFIED" }, 200);

  const convertedLead = (await expectStatus(
    "Lead → Opportunity",
    "PATCH",
    `/api/leads/${lead.id}?action=convert`,
    sales,
    { title: `Opp ${stamp}`, value: unitPrice * 2, createOrLinkCustomer: true },
    200,
    (data) => {
      const o = data as { opportunity?: { id?: string; customerId?: string } };
      if (!o.opportunity?.id) throw new Error("missing opportunity");
      if (!o.opportunity.customerId) throw new Error("missing customer on opportunity");
    }
  )) as { opportunity: { id: string; customerId: string } } | null;
  if (!convertedLead?.opportunity.id) process.exit(1);

  const oppId = convertedLead.opportunity.id;
  await expectStatus(
    "Opportunity GET includes customer",
    "GET",
    `/api/opportunities/${oppId}`,
    sales,
    undefined,
    200,
    (data) => {
      const o = data as { customer?: { id: string } };
      if (!o.customer?.id) throw new Error("customer missing on GET");
    }
  );
  await expectStatus("Stage QUALIFICATION", "PATCH", `/api/opportunities/${oppId}`, sales, { stage: "QUALIFICATION" }, 200);
  await expectStatus("Stage PROPOSAL", "PATCH", `/api/opportunities/${oppId}`, sales, { stage: "PROPOSAL" }, 200);

  const quote = (await expectStatus(
    "Opportunity → Quote",
    "POST",
    "/api/quotes",
    sales,
    {
      opportunityId: oppId,
      customerId: convertedLead.opportunity.customerId,
      date: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
      items: [line],
    },
    201,
    (data) => {
      const o = data as { opportunityId?: string; status?: string };
      if (o.opportunityId !== oppId) throw new Error("opportunityId not persisted");
      if (o.status !== "DRAFT") throw new Error(`status ${o.status}`);
    }
  )) as { id: string } | null;
  if (!quote?.id) process.exit(1);

  const draftConvert = await api("POST", `/api/quotes/${quote.id}/convert`, {
    token: sales.token,
    tenantId: sales.tenantId,
    body: {},
  });
  if (draftConvert.status === 409) ok("DRAFT quote cannot convert");
  else bad("DRAFT quote cannot convert", `HTTP ${draftConvert.status}`);

  await expectStatus("Quote SENT", "PATCH", `/api/quotes/${quote.id}?action=status`, sales, { status: "SENT" }, 200);
  await expectStatus("Quote ACCEPTED", "PATCH", `/api/quotes/${quote.id}?action=status`, sales, { status: "ACCEPTED" }, 200);

  const fromQuote = (await expectStatus(
    "Quote → SO CONFIRMED",
    "POST",
    `/api/quotes/${quote.id}/convert`,
    sales,
    {},
    201,
    (data) => {
      const o = data as { soStatus?: string; salesOrder?: { status?: string; sourceKind?: string } };
      if (o.soStatus !== "CONFIRMED" && o.salesOrder?.status !== "CONFIRMED") {
        throw new Error(`expected CONFIRMED got ${o.soStatus}`);
      }
      if (o.salesOrder?.sourceKind && o.salesOrder.sourceKind !== "QUOTE") {
        throw new Error(`sourceKind ${o.salesOrder.sourceKind}`);
      }
    }
  )) as { salesOrder: { id: string; orderNumber: string } } | null;
  if (!fromQuote?.salesOrder.id) process.exit(1);

  await expectStatus(
    "Quote SO task snapshot",
    "GET",
    `/api/orders/${fromQuote.salesOrder.id}`,
    sales,
    undefined,
    200,
    (data) => {
      const o = data as { sourceKind?: string; quoteId?: string };
      if (o.sourceKind !== "QUOTE") throw new Error(`sourceKind ${o.sourceKind}`);
      if (o.quoteId !== quote.id) throw new Error("quoteId not linked");
      assertTaskSnapshot(data);
    }
  );

  const retry = await api("POST", `/api/quotes/${quote.id}/convert`, {
    token: sales.token,
    tenantId: sales.tenantId,
    body: {},
  });
  const retryData = retry.json.data as { alreadyConverted?: boolean; salesOrder?: { id: string } } | undefined;
  if (
    retry.status === 200 &&
    retryData?.alreadyConverted === true &&
    retryData.salesOrder?.id === fromQuote.salesOrder.id
  ) {
    ok("Quote convert idempotent");
  } else {
    bad("Quote convert idempotent", `HTTP ${retry.status} already=${retryData?.alreadyConverted}`);
  }

  console.log(`\n=== Capture channels E2E ${fail === 0 ? "PASSED" : "FAILED"} pass=${pass} fail=${fail} ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

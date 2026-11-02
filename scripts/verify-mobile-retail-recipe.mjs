// P4 verify — the mobile_retail vertical recipe provisions a usable cart business:
// core/inventory/sales/accounting/delivery modules, an order workflow, a seed
// warehouse, and retail.* tenant settings. Uses self-serve register (gateway has
// ALLOW_SELF_SERVE_TENANT=true in dev).
const BASE = "http://localhost:3010/admin";

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => { console.log(`  ${ok ? "\u2713" : "\u2717"} ${label}${detail ? " \u2014 " + detail : ""}`); ok ? pass++ : fail++; };

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const t = await res.text();
  let body = {}; try { body = t ? JSON.parse(t) : {}; } catch { body = { error: t.slice(0, 200) }; }
  return { status: res.status, body };
}

async function main() {
  const stamp = Date.now();
  const slug = `zz-cartco-${stamp}`;
  const email = `owner-${stamp}@cartco.test`;

  // Self-serve register a mobile_retail tenant.
  // action is read from the QUERY STRING, not the body.
  const reg = await j(`${BASE}/api/auth?action=register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Owner", email, password: "Owner@12345", vertical: "mobile_retail" }),
  });
  check("mobile_retail tenant registered (201)", reg.status === 201, `${reg.status} ${reg.body?.error ?? ""}`);
  const tid = reg.body?.data?.tenantId;
  const tslug = reg.body?.data?.slug;
  check("got new tenant id", !!tid, `tid=${tid} slug=${tslug}`);

  // Register returns no session — log in to get an admin token for the new tenant.
  const login = await j(`${BASE}/api/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Owner@12345", tenantSlug: tslug }) });
  const data = login.body?.data ?? {};
  const token = data.accessToken;
  const hdr = { Authorization: `Bearer ${token}`, "x-tenant-id": tid, "x-user-id": data.user?.id, "x-user-role": "ADMIN", "Content-Type": "application/json" };
  check("admin login to new tenant", !!token, login.status === 200 ? "ok" : `${login.status} ${login.body?.error ?? ""}`);

  // Give onboarding reconciliation (workflow + warehouse) a moment to drain.
  await new Promise((r) => setTimeout(r, 2500));

  // Modules licensed (GET /api/tenants/:id returns data.modules as string[]).
  const tdetail = await j(`${BASE}/api/tenants/${tid}`, { headers: hdr });
  const licensed = new Set((tdetail.body?.data?.modules ?? []).map((m) => (typeof m === "string" ? m : m.moduleId)));
  const want = ["core", "inventory", "sales", "accounting", "delivery"];
  check("modules licensed (core/inventory/sales/accounting/delivery)", want.every((m) => licensed.has(m)), [...licensed].join(",") || "none");

  // Order workflow present + default (sales service).
  const wf = await j(`http://127.0.0.1:3001/api/order-workflows`, { headers: { "x-tenant-id": tid, "x-user-role": "ADMIN", "x-service-key": "dev-service-secret" } });
  const workflows = wf.body?.data ?? [];
  check("default order workflow applied", workflows.some((w) => w.isDefault), `${workflows.length} workflow(s)`);

  // Seed warehouse present (inventory service).
  const whs = await j(`http://127.0.0.1:3002/api/warehouses?limit=10`, { headers: { "x-tenant-id": tid, "x-user-role": "ADMIN", "x-service-key": "dev-service-secret" } });
  check("seed warehouse created", (whs.body?.data ?? []).length >= 1, `${(whs.body?.data ?? []).length} warehouse(s)`);

  // retail.* tenant settings seeded.
  const settings = await j(`${BASE}/api/tenants/${tid}/settings`, { headers: hdr });
  const s = settings.body?.data ?? settings.body?.settings ?? {};
  const map = Array.isArray(s) ? Object.fromEntries(s.map((x) => [x.key, x.value])) : s;
  check("retail.locationLabel setting present", map["retail.locationLabel"] === "Cart", `label=${map["retail.locationLabel"]}`);
  check("retail.cashHandoverRequired setting present", map["retail.cashHandoverRequired"] === "true", `val=${map["retail.cashHandoverRequired"]}`);
  check("onboarding.vertical = mobile_retail", map["onboarding.vertical"] === "mobile_retail", map["onboarding.vertical"]);

  console.log(`\n=== MOBILE RETAIL RECIPE: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

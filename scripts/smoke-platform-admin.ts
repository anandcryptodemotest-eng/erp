/**
 * Smoke: platform operator login → create tenant → licenses → services → audit.
 *   pnpm smoke:platform-admin
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3010/admin";
const EMAIL = process.env.PLATFORM_OWNER_EMAIL || "platform@erp.local";
const PASSWORD = process.env.PLATFORM_OWNER_PASSWORD || "Platform@123";

async function api(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function ok(name: string) {
  console.log(`  [PASS] ${name}`);
}
function bad(name: string, detail?: string): never {
  console.error(`  [FAIL] ${name}${detail ? ` — ${detail}` : ""}`);
  process.exit(1);
}

async function main() {
  console.log(`\n=== Platform Admin smoke @ ${BASE} ===\n`);

  const login = await api("POST", "/api/platform/auth", {
    body: { email: EMAIL, password: PASSWORD },
  });
  if (login.status !== 200 || !login.json.data?.accessToken) {
    bad("operator login", `${login.status} ${login.json.error}`);
  }
  ok("operator login");
  const token = login.json.data.accessToken as string;

  const slug = `smoke-${Date.now().toString(36)}`;
  const created = await api("POST", "/api/platform/tenants", {
    token,
    body: {
      name: `Smoke ${slug}`,
      slug,
      plan: "starter",
      adminEmail: `${slug}@example.com`,
      adminPassword: "SmokeAdmin1!",
    },
  });
  if (created.status !== 201 || !created.json.data?.tenantId) {
    bad("create tenant", `${created.status} ${created.json.error}`);
  }
  ok(`create tenant ${created.json.data.slug}`);
  const tenantId = created.json.data.tenantId as string;

  const licenses = await api("GET", `/api/platform/licenses?tenantId=${tenantId}`, { token });
  if (licenses.status !== 200) bad("licenses", `${licenses.status}`);
  ok("licenses GET");

  const services = await api("GET", "/api/platform/services", { token });
  if (services.status !== 200 || !Array.isArray(services.json.data)) {
    bad("services", `${services.status}`);
  }
  const withChecked = services.json.data.every((s: { checkedAt?: string }) => !!s.checkedAt);
  if (!withChecked) bad("services checkedAt missing");
  ok(`services (${services.json.data.length} rows)`);

  const audit = await api("GET", "/api/platform/audit?limit=20", { token });
  if (audit.status !== 200) bad("audit", `${audit.status}`);
  const hasCreate = (audit.json.data as { action: string }[]).some((a) => a.action === "TENANT_CREATED");
  if (!hasCreate) bad("audit missing TENANT_CREATED");
  ok("audit contains TENANT_CREATED");

  console.log("\n=== Platform Admin smoke passed ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

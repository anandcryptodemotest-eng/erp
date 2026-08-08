/**
 * Soft-delete all active products for the demo tenant (idempotent).
 *
 *   pnpm clear:catalog
 *
 * Summary: scanned | deleted | alreadyDeleted | failures
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3010/admin";
const TENANT = process.env.TENANT_SLUG ?? "trustwood-enterprise";
const ADMIN = { email: "admin@simhapurifresh.com", password: "Admin@123" };

type Json = { data?: unknown; error?: string; meta?: { total?: number } };

async function api(
  method: string,
  path: string,
  opts: { token?: string; tenantId?: string; role?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["x-tenant-id"] = opts.tenantId;
  if (opts.role) headers["x-user-role"] = opts.role;
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

async function main() {
  console.log(`\n=== clear:catalog @ ${BASE} tenant=${TENANT} ===\n`);

  const login = await api("POST", "/api/auth", {
    body: { action: "login", email: ADMIN.email, password: ADMIN.password, tenantSlug: TENANT },
  });
  if (login.status !== 200 || !login.json.data) {
    throw new Error(`Admin login failed: ${login.status} ${login.json.error ?? ""}`);
  }
  const data = login.json.data as {
    accessToken: string;
    tenant: { id: string };
    user: { role: string };
  };
  const auth = {
    token: data.accessToken,
    tenantId: data.tenant.id,
    role: data.user.role ?? "ADMIN",
  };

  let scanned = 0;
  let deleted = 0;
  let alreadyDeleted = 0;
  let failures = 0;
  const pageSize = 100;

  const first = await api("GET", `/api/products?limit=${pageSize}&page=1`, auth);
  if (first.status !== 200) {
    throw new Error(`List products failed: ${first.status} ${first.json.error ?? ""}`);
  }
  scanned = first.json.meta?.total ?? ((first.json.data as unknown[]) ?? []).length;

  if (scanned === 0) {
    alreadyDeleted = 1;
    console.log("  · No active products — catalog already clear");
  } else {
    // Keep deleting page 1 until empty (list only returns active)
    let guard = 0;
    while (guard < 500) {
      guard++;
      const list = await api("GET", `/api/products?limit=${pageSize}&page=1`, auth);
      const rows = (list.json.data as { id: string; sku: string; isActive?: boolean }[]) ?? [];
      if (rows.length === 0) break;

      for (const p of rows) {
        if (p.isActive === false) {
          alreadyDeleted++;
          continue;
        }
        const del = await api("DELETE", `/api/products/${p.id}`, auth);
        if (del.status === 200 || del.status === 204) {
          deleted++;
          console.log(`  ✓ soft-deleted ${p.sku}`);
        } else {
          failures++;
          console.log(`  ✗ ${p.sku} — ${del.status} ${del.json.error ?? ""}`);
        }
      }
      if (failures > 0 && deleted === 0) break;
    }
  }

  const finalList = await api("GET", `/api/products?limit=1`, auth);
  const remaining = finalList.json.meta?.total ?? 0;

  console.log(`\n--- clear:catalog summary ---`);
  console.log(`Products scanned:     ${scanned}`);
  console.log(`Products deleted:     ${deleted}`);
  console.log(
    `Already deleted/skip: ${alreadyDeleted}${scanned === 0 ? " (catalog already clear)" : ""}`
  );
  console.log(`Failures:             ${failures}`);
  console.log(`Active remaining:     ${remaining}\n`);

  if (failures > 0 || remaining > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

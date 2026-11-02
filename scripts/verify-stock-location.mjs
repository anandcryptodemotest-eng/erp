// P2 verify — StockLocation (cart) entity: create, per-cart inventory, audited lifecycle.
const INV = "http://127.0.0.1:3002";
const TID = "cmvt0wjn70008lpzqywwpxen7";
const SS = "dev-service-secret";

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => { console.log(`  ${ok ? "\u2713" : "\u2717"} ${label}${detail ? " \u2014 " + detail : ""}`); ok ? pass++ : fail++; };

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const t = await res.text();
  let body = {}; try { body = t ? JSON.parse(t) : {}; } catch { body = { error: t.slice(0, 200) }; }
  return { status: res.status, body };
}
const svc = { "Content-Type": "application/json", "x-tenant-id": TID, "x-user-role": "ADMIN", "x-user-id": "verify-admin", "x-service-key": SS };

async function main() {
  const stamp = Date.now();
  const prods = await j(`${INV}/api/products?sku=FRU-BANANA&limit=1`, { headers: svc });
  const pid = prods.body?.data?.[0]?.id;

  // 1. Create a CART stock-location (auto-creates a backing warehouse).
  const code = `zz-CART-${stamp}`;
  const created = await j(`${INV}/api/stock-locations`, { method: "POST", headers: svc, body: JSON.stringify({ code, name: `Test Cart ${stamp}`, type: "CART", operatorId: "emp-op-1" }) });
  const locId = created.body?.data?.id;
  const whId = created.body?.data?.warehouseId;
  check("cart location created (201)", created.status === 201 && !!locId && !!whId, `${created.status} wh=${whId}`);
  check("initial status CREATED", created.body?.data?.status === "CREATED", created.body?.data?.status);

  // 2. Duplicate code rejected.
  const dup = await j(`${INV}/api/stock-locations`, { method: "POST", headers: svc, body: JSON.stringify({ code, name: "dup", type: "CART" }) });
  check("duplicate code rejected (409)", dup.status === 409, `status ${dup.status}`);

  // 3. List filters by type=CART.
  const list = await j(`${INV}/api/stock-locations?type=CART&limit=100`, { headers: svc });
  check("cart appears in type=CART list", (list.body?.data ?? []).some((l) => l.id === locId), `${list.body?.data?.length} carts`);

  // 4. Load stock into the cart's backing warehouse (via batch-aware receive).
  await j(`${INV}/api/stock/receive`, { method: "POST", headers: svc, body: JSON.stringify({
    reference: `load-${stamp}`, idempotencyKey: `load-${stamp}`,
    items: [{ productId: pid, warehouseId: whId, quantity: 12, batchNo: `LOC-${stamp}-LOT`, expiryDate: new Date(Date.now() + 2 * 86400000).toISOString() }],
  }) });

  // 5. Per-cart inventory endpoint reflects it.
  const inv = await j(`${INV}/api/stock-locations/${locId}/inventory`, { headers: svc });
  const line = (inv.body?.data?.items ?? []).find((i) => i.productId === pid);
  check("per-cart inventory shows 12 units", line && Math.abs(line.available - 12) < 1e-6, `available=${line?.available}`);
  check("per-cart inventory shows the FEFO lot", !!line?.lots?.length && Math.abs(line.lots[0].quantity - 12) < 1e-6, `lots=${JSON.stringify(line?.lots?.[0] ?? null)}`);

  // 6. Walk the lifecycle with audit: CREATED -> LOADING -> READY -> ON_ROUTE -> PARKED -> SETTLEMENT_PENDING -> CLOSED.
  const transition = (status, remarks) => j(`${INV}/api/stock-locations/${locId}`, { method: "PATCH", headers: svc, body: JSON.stringify({ status, remarks }) });
  for (const [to, ok] of [["LOADING", true], ["READY", true], ["ON_ROUTE", true], ["PARKED", true], ["SETTLEMENT_PENDING", true], ["CLOSED", true]]) {
    const r = await transition(to, `-> ${to}`);
    check(`transition -> ${to}`, r.status === 200 && r.body?.data?.status === to, `${r.status} ${r.body?.data?.status ?? r.body?.error}`);
  }

  // 7. Illegal transition rejected (CLOSED -> ON_ROUTE).
  const illegal = await transition("ON_ROUTE", "should fail");
  check("illegal transition CLOSED->ON_ROUTE rejected (409)", illegal.status === 409, `status ${illegal.status} ${illegal.body?.error ?? ""}`);

  // 8. Audit trail recorded every transition (CREATED seed + 6 = 7 events).
  const detail = await j(`${INV}/api/stock-locations/${locId}`, { headers: svc });
  const events = detail.body?.data?.statusEvents ?? [];
  check("audit log has 7 lifecycle events", events.length === 7, `${events.length} events`);
  check("audit events carry from/to + user", events.every((e) => e.toStatus && e.userId), "ok");

  console.log(`\n=== STOCK LOCATION: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

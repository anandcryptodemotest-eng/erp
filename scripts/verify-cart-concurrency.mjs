// P0 verify — concurrency-safe + idempotent stock deduction (G6).
// Two overlapping deducts that together exceed on-hand: exactly one wins, stock
// never goes negative. A retried deduct with the same idempotencyKey is a no-op.
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
const svc = { "Content-Type": "application/json", "x-tenant-id": TID, "x-user-role": "ADMIN", "x-service-key": SS };

async function onHand(productId, warehouseId) {
  const rep = await j(`${INV}/api/reports/stock?warehouseId=${warehouseId}`, { headers: svc });
  const row = (rep.body?.data?.topByValue ?? []).find((e) => e.productId === productId);
  return row ? row.quantity : 0;
}

async function main() {
  // Name sorts AFTER "Main" so it never wins the OMS default-warehouse resolution.
  const code = `zz-cart-conc-${Date.now()}`;
  const wh = await j(`${INV}/api/warehouses`, { method: "POST", headers: svc, body: JSON.stringify({ name: code, location: "Concurrency test cart" }) });
  const cartId = wh.body?.data?.id;
  check("cart warehouse created", !!cartId, code);

  const prods = await j(`${INV}/api/products?sku=FRU-BANANA&limit=1`, { headers: svc });
  const pid = prods.body?.data?.[0]?.id;

  // Load exactly 10 kg.
  await j(`${INV}/api/stock/receive`, { method: "POST", headers: svc, body: JSON.stringify({
    reference: `LOAD-${code}`, idempotencyKey: `load-${code}`,
    items: [{ productId: pid, warehouseId: cartId, quantity: 10, batchNo: `${code}-LOT`, expiryDate: new Date(Date.now() + 2 * 86400000).toISOString() }],
  }) });
  check("loaded 10kg", Math.abs((await onHand(pid, cartId)) - 10) < 1e-6);

  // --- Race: two concurrent deducts of 7kg each (total 14 > 10 on-hand). ---
  const deduct = (ref) => j(`${INV}/api/stock/deduct`, { method: "POST", headers: svc, body: JSON.stringify({
    items: [{ productId: pid, warehouseId: cartId, quantity: 7 }], reference: ref,
  }) });
  const [a, b] = await Promise.all([deduct(`RACE-A-${code}`), deduct(`RACE-B-${code}`)]);
  const statuses = [a.status, b.status].sort();
  const successes = [a, b].filter((r) => r.status >= 200 && r.status < 300).length;
  const conflicts = [a, b].filter((r) => r.status === 409).length;
  check("exactly one deduct succeeded", successes === 1, `statuses ${statuses.join("/")}`);
  check("the other was rejected 409 (insufficient)", conflicts === 1, `statuses ${statuses.join("/")}`);

  const afterRace = await onHand(pid, cartId);
  check("stock never negative, = 3kg after one 7kg sale", Math.abs(afterRace - 3) < 1e-6, `${afterRace} kg`);

  // --- Idempotency: same key twice must deduct only once. ---
  const key = `IDEMP-${code}`;
  const first = await j(`${INV}/api/stock/deduct`, { method: "POST", headers: svc, body: JSON.stringify({
    items: [{ productId: pid, warehouseId: cartId, quantity: 2 }], reference: `IDEM-${code}`, idempotencyKey: key,
  }) });
  check("idempotent deduct first call 201", first.status === 201, `status ${first.status}`);
  const afterFirst = await onHand(pid, cartId);
  check("on-hand = 1kg after 2kg deduct", Math.abs(afterFirst - 1) < 1e-6, `${afterFirst} kg`);

  const retry = await j(`${INV}/api/stock/deduct`, { method: "POST", headers: svc, body: JSON.stringify({
    items: [{ productId: pid, warehouseId: cartId, quantity: 2 }], reference: `IDEM-${code}`, idempotencyKey: key,
  }) });
  check("idempotent retry returns 200 (no-op)", retry.status === 200, `status ${retry.status}`);
  const afterRetry = await onHand(pid, cartId);
  check("on-hand still 1kg (not double-deducted)", Math.abs(afterRetry - 1) < 1e-6, `${afterRetry} kg`);

  console.log(`\n=== CART CONCURRENCY: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

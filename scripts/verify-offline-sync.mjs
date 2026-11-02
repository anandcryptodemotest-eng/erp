// P5 verify — offline POS sync: queued offline bills sync idempotently; a replay is
// a no-op (duplicate); an oversell on sync is a reported conflict, not silent.
const BASE = "http://localhost:3010/admin";
const INV = "http://127.0.0.1:3002";
const ACC = "http://127.0.0.1:3003";
const TENANT = "simhapuri-fresh";
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
async function loginData(email, password) {
  const r = await j(`${BASE}/api/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", email, password, tenantSlug: TENANT }) });
  return r.body?.data;
}
const svc = { "Content-Type": "application/json", "x-tenant-id": TID, "x-user-role": "ADMIN", "x-user-id": "verify-admin", "x-service-key": SS };
async function onHand(productId, warehouseId) {
  const rep = await j(`${INV}/api/reports/stock?warehouseId=${warehouseId}`, { headers: svc });
  const row = (rep.body?.data?.topByValue ?? []).find((e) => e.productId === productId);
  return row ? row.quantity : 0;
}

async function main() {
  const admin = await loginData("admin@simhapurifresh.com", "Admin@123");
  const adminHdr = { "Content-Type": "application/json", Authorization: `Bearer ${admin.accessToken}`, "x-tenant-id": admin.tenant.id, "x-user-id": admin.user.id, "x-user-role": "ADMIN" };
  const stamp = Date.now();

  const prods = await j(`${INV}/api/products?sku=FRU-BANANA&limit=1`, { headers: svc });
  const product = prods.body?.data?.[0];
  const pid = product?.id;
  await j(`${INV}/api/products/${pid}`, { method: "PATCH", headers: adminHdr, body: JSON.stringify({ hsnCode: "0803", taxRate: 0 }) });

  const loc = await j(`${INV}/api/stock-locations`, { method: "POST", headers: svc, body: JSON.stringify({ code: `zz-OFF-${stamp}`, name: `Offline Cart ${stamp}`, type: "CART" }) });
  const locId = loc.body?.data?.id;
  const whId = loc.body?.data?.warehouseId;
  // Load 5 kg only — enough for the two valid offline bills (2+2) but NOT the oversell (10).
  await j(`${INV}/api/stock/receive`, { method: "POST", headers: svc, body: JSON.stringify({ reference: `load-${stamp}`, idempotencyKey: `load-${stamp}`, items: [{ productId: pid, warehouseId: whId, quantity: 5, batchNo: `OFF-${stamp}-LOT`, expiryDate: new Date(Date.now() + 2 * 86400000).toISOString() }] }) });

  let shiftId;
  const openShift = await j(`${ACC}/api/shifts?status=OPEN&cashierId=${admin.user.id}&limit=1`, { headers: adminHdr });
  shiftId = openShift.body?.data?.length ? openShift.body.data[0].id : (await j(`${ACC}/api/shifts`, { method: "POST", headers: adminHdr, body: JSON.stringify({ openingBalance: 0 }) })).body?.data?.id;

  const line = (qty) => [{ productId: pid, productName: product.name, sku: product.sku, quantity: qty, unitPrice: 100, discount: 0 }];
  const batch = {
    bills: [
      { offlineId: `off-${stamp}-A`, warehouseId: whId, stockLocationId: locId, shiftId, paymentMethod: "CASH", items: line(2) },
      { offlineId: `off-${stamp}-B`, warehouseId: whId, stockLocationId: locId, shiftId, paymentMethod: "UPI", items: line(2) },
      { offlineId: `off-${stamp}-C`, warehouseId: whId, stockLocationId: locId, shiftId, paymentMethod: "CASH", items: line(10) }, // oversell (only 1kg left after A+B)
    ],
  };

  // First sync.
  const sync1 = await j(`${ACC}/api/bills/sync`, { method: "POST", headers: adminHdr, body: JSON.stringify(batch) });
  check("sync accepted (200)", sync1.status === 200, `status ${sync1.status}`);
  const r1 = Object.fromEntries((sync1.body?.data?.results ?? []).map((x) => [x.offlineId, x.result]));
  check("bill A synced", r1[`off-${stamp}-A`] === "synced", r1[`off-${stamp}-A`]);
  check("bill B synced", r1[`off-${stamp}-B`] === "synced", r1[`off-${stamp}-B`]);
  check("bill C oversell -> conflict (not silent)", r1[`off-${stamp}-C`] === "conflict", r1[`off-${stamp}-C`]);
  check("stock decremented only for A+B (5 - 4 = 1)", Math.abs((await onHand(pid, whId)) - 1) < 1e-6, `${await onHand(pid, whId)} kg`);

  // Replay the same batch — idempotent: A/B duplicate, C still conflict, no extra deduction.
  const sync2 = await j(`${ACC}/api/bills/sync`, { method: "POST", headers: adminHdr, body: JSON.stringify(batch) });
  const r2 = Object.fromEntries((sync2.body?.data?.results ?? []).map((x) => [x.offlineId, x.result]));
  check("replay A -> duplicate", r2[`off-${stamp}-A`] === "duplicate", r2[`off-${stamp}-A`]);
  check("replay B -> duplicate", r2[`off-${stamp}-B`] === "duplicate", r2[`off-${stamp}-B`]);
  check("stock unchanged after replay (still 1)", Math.abs((await onHand(pid, whId)) - 1) < 1e-6, `${await onHand(pid, whId)} kg`);

  // Per-cart report sees the 2 live synced bills (CASH 200 + UPI 200 = 400).
  const rep = await j(`${ACC}/api/reports/sales?stockLocationId=${locId}`, { headers: adminHdr });
  check("report net revenue = 400 (2 synced bills)", Math.abs((rep.body?.data?.summary?.netRevenue ?? 0) - 400) < 1e-6, `net=${rep.body?.data?.summary?.netRevenue}`);

  console.log(`\n=== OFFLINE SYNC: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

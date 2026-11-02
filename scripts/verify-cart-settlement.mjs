// P3 verify — per-cart sales report (G3), cash/UPI reconciliation (G9), refund reversal (G11).
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
  // Ensure POS-billable (HSN + 0% GST auto-approves).
  await j(`${INV}/api/products/${pid}`, { method: "PATCH", headers: adminHdr, body: JSON.stringify({ hsnCode: "0803", taxRate: 0 }) });

  // Cart (StockLocation) with a backing warehouse.
  const loc = await j(`${INV}/api/stock-locations`, { method: "POST", headers: svc, body: JSON.stringify({ code: `zz-SETTLE-${stamp}`, name: `Settle Cart ${stamp}`, type: "CART" }) });
  const locId = loc.body?.data?.id;
  const whId = loc.body?.data?.warehouseId;
  check("cart created", !!locId && !!whId);

  // Load 20 kg.
  await j(`${INV}/api/stock/receive`, { method: "POST", headers: svc, body: JSON.stringify({
    reference: `load-${stamp}`, idempotencyKey: `load-${stamp}`,
    items: [{ productId: pid, warehouseId: whId, quantity: 20, batchNo: `SET-${stamp}-LOT`, expiryDate: new Date(Date.now() + 2 * 86400000).toISOString() }],
  }) });

  // Open a shift.
  let shiftId;
  const openShift = await j(`${ACC}/api/shifts?status=OPEN&cashierId=${admin.user.id}&limit=1`, { headers: adminHdr });
  shiftId = openShift.body?.data?.length ? openShift.body.data[0].id : (await j(`${ACC}/api/shifts`, { method: "POST", headers: adminHdr, body: JSON.stringify({ openingBalance: 0 }) })).body?.data?.id;
  check("shift open", !!shiftId);

  const bill = (method, qty) => j(`${ACC}/api/bills`, { method: "POST", headers: adminHdr, body: JSON.stringify({
    shiftId, warehouseId: whId, stockLocationId: locId, paymentMethod: method, status: "COMPLETED",
    items: [{ productId: pid, productName: product.name, sku: product.sku, quantity: qty, unitPrice: 100, discount: 0 }],
  }) });

  // Sale 1: CASH 5 kg = ₹500. Sale 2: UPI 3 kg = ₹300.
  const cashBill = await bill("CASH", 5);
  const upiBill = await bill("UPI", 3);
  check("CASH bill created", cashBill.status === 201, `${cashBill.status} ${cashBill.body?.error ?? cashBill.body?.data?.billNumber}`);
  check("UPI bill created", upiBill.status === 201, `${upiBill.status} ${upiBill.body?.data?.billNumber ?? upiBill.body?.error}`);
  check("stock after 2 sales = 12", Math.abs((await onHand(pid, whId)) - 12) < 1e-6, `${await onHand(pid, whId)} kg`);

  // Per-cart report: CASH 500, UPI 300, net 800, 8 units.
  const rep1 = await j(`${ACC}/api/reports/sales?stockLocationId=${locId}`, { headers: adminHdr });
  const t1 = Object.fromEntries((rep1.body?.data?.tenders ?? []).map((x) => [x.tender, x]));
  check("report CASH net = 500", t1.CASH && Math.abs(t1.CASH.net - 500) < 1e-6, `CASH=${t1.CASH?.net}`);
  check("report UPI net = 300", t1.UPI && Math.abs(t1.UPI.net - 300) < 1e-6, `UPI=${t1.UPI?.net}`);
  check("report net revenue = 800", Math.abs((rep1.body?.data?.summary?.netRevenue ?? 0) - 800) < 1e-6, `net=${rep1.body?.data?.summary?.netRevenue}`);
  check("report units sold = 8", Math.abs((rep1.body?.data?.summary?.unitsSold ?? 0) - 8) < 1e-6, `units=${rep1.body?.data?.summary?.unitsSold}`);

  // Refund the UPI bill (3 kg) -> stock returns to 15, report nets the refund.
  const refund = await j(`${ACC}/api/bills/${upiBill.body.data.id}`, { method: "PATCH", headers: adminHdr, body: JSON.stringify({ action: "refund", reason: "customer return", refundMethod: "UPI" }) });
  check("refund accepted", refund.status === 200 && refund.body?.data?.paymentStatus === "REFUNDED", `${refund.status} ${refund.body?.data?.paymentStatus ?? refund.body?.error}`);
  check("stock returned to 15 after refund", Math.abs((await onHand(pid, whId)) - 15) < 1e-6, `${await onHand(pid, whId)} kg`);

  // Refund is idempotent at the stock layer: a second refund attempt is blocked (not reversible twice).
  const refund2 = await j(`${ACC}/api/bills/${upiBill.body.data.id}`, { method: "PATCH", headers: adminHdr, body: JSON.stringify({ action: "refund" }) });
  check("double refund blocked (409)", refund2.status === 409, `status ${refund2.status}`);

  // Report now: CASH 500 live, UPI net 0 (300 gross - 300 refund), net revenue 500.
  const rep2 = await j(`${ACC}/api/reports/sales?stockLocationId=${locId}`, { headers: adminHdr });
  const t2 = Object.fromEntries((rep2.body?.data?.tenders ?? []).map((x) => [x.tender, x]));
  check("report UPI net = 0 after refund", t2.UPI && Math.abs(t2.UPI.net - 0) < 1e-6, `UPI net=${t2.UPI?.net} refunds=${t2.UPI?.refunds}`);
  check("report net revenue = 500 after refund", Math.abs((rep2.body?.data?.summary?.netRevenue ?? 0) - 500) < 1e-6, `net=${rep2.body?.data?.summary?.netRevenue}`);
  check("report refundedTotal = 300", Math.abs((rep2.body?.data?.summary?.refundedTotal ?? 0) - 300) < 1e-6, `refunded=${rep2.body?.data?.summary?.refundedTotal}`);

  console.log(`\n=== CART SETTLEMENT: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

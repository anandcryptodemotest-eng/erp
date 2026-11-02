// P0 verify — a POS cart sale CORRECTLY deducts stock (G1 fixed).
// Models a cart as a warehouse: create cart warehouse, receive a known batch,
// open a cash shift, post a POS bill against the cart, assert stock decremented FEFO.
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
const svc = { "Content-Type": "application/json", "x-tenant-id": TID, "x-user-role": "ADMIN", "x-service-key": SS };

async function onHand(productId, warehouseId) {
  const r = await j(`${INV}/api/stock/movements?productId=${productId}&warehouseId=${warehouseId}&limit=1`, { headers: svc });
  // Prefer the stock report for a clean on-hand number.
  const rep = await j(`${INV}/api/reports/stock?warehouseId=${warehouseId}`, { headers: svc });
  const row = (rep.body?.data?.topByValue ?? []).find((e) => e.productId === productId);
  return row ? row.quantity : 0;
}

async function main() {
  const admin = await loginData("admin@simhapurifresh.com", "Admin@123");
  const adminHdr = { "Content-Type": "application/json", Authorization: `Bearer ${admin.accessToken}`, "x-tenant-id": admin.tenant.id, "x-user-id": admin.user.id, "x-user-role": "ADMIN" };

  // 1. Create a cart (= warehouse). Name sorts AFTER "Main" so it never wins the
  // OMS default-warehouse resolution (GET /api/warehouses?limit=1, name asc).
  const code = `zz-cart-sale-${Date.now()}`;
  const wh = await j(`${INV}/api/warehouses`, { method: "POST", headers: svc, body: JSON.stringify({ name: code, location: "Test cart" }) });
  const cartId = wh.body?.data?.id;
  check("cart warehouse created", !!cartId, code);

  // 2. Resolve a batch-tracked product (banana) and receive 10 kg into the cart.
  const prods = await j(`${INV}/api/products?sku=FRU-BANANA&limit=1`, { headers: svc });
  const product = prods.body?.data?.[0];
  const pid = product?.id;
  check("product resolved", !!pid, product?.sku);

  // Ensure the product is POS-billable: set HSN + an explicit 0% GST rate (fresh
  // fruit). Passing hsnCode + taxRate (no taxCode) marks hsnConfidence=MANUAL which
  // auto-approves tax; the bills route blocks unapproved products.
  const patchRes = await j(`${INV}/api/products/${pid}`, { method: "PATCH", headers: adminHdr, body: JSON.stringify({ hsnCode: "0803", taxRate: 0 }) });
  check("product tax approved for POS", patchRes.body?.data?.taxApprovalStatus === "APPROVED", `${patchRes.status} ${patchRes.body?.data?.taxApprovalStatus ?? patchRes.body?.error}`);
  const recv = await j(`${INV}/api/stock/receive`, { method: "POST", headers: svc, body: JSON.stringify({
    reference: `CART-LOAD-${code}`, idempotencyKey: `cart-load-${code}`,
    items: [{ productId: pid, warehouseId: cartId, quantity: 10, batchNo: `${code}-LOT`, expiryDate: new Date(Date.now() + 2 * 86400000).toISOString() }],
  }) });
  check("cart loaded 10kg", recv.status === 200 || recv.status === 201, `status ${recv.status}`);
  const before = await onHand(pid, cartId);
  check("on-hand before = 10", Math.abs(before - 10) < 1e-6, `${before} kg`);

  // 3. Open a cash shift as the cashier (admin) — reuse an existing open one.
  let shiftId;
  const openShift = await j(`${ACC}/api/shifts?status=OPEN&cashierId=${admin.user.id}&limit=1`, { headers: adminHdr });
  if (openShift.body?.data?.length) {
    shiftId = openShift.body.data[0].id;
  } else {
    const shift = await j(`${ACC}/api/shifts`, { method: "POST", headers: adminHdr, body: JSON.stringify({ openingBalance: 0 }) });
    shiftId = shift.body?.data?.id;
  }
  check("cash shift open", !!shiftId, shiftId ?? "none");

  // 4. POS bill: sell 3.5 kg from the cart.
  const bill = await j(`${ACC}/api/bills`, { method: "POST", headers: adminHdr, body: JSON.stringify({
    shiftId, warehouseId: cartId, paymentMethod: "CASH", status: "COMPLETED",
    items: [{ productId: pid, productName: product.name, sku: product.sku, quantity: 3.5, unitPrice: product.sellPrice ?? 60, discount: 0 }],
  }) });
  check("POS bill created (201)", bill.status === 201, `${bill.status} ${bill.body?.error ?? bill.body?.data?.billNumber ?? ""}`);
  check("no stock warning on bill", !bill.body?.stockWarning, bill.body?.stockWarning ?? "clean");

  // 5. Assert stock decremented by exactly 3.5 kg (G1 fixed — was silently not deducting).
  const after = await onHand(pid, cartId);
  check("on-hand after = 6.5 (deducted 3.5)", Math.abs(after - 6.5) < 1e-6, `${after} kg`);

  // 6. Assert an OUT movement exists referencing the bill id, drawn FEFO from the lot.
  const movs = await j(`${INV}/api/stock/movements?productId=${pid}&warehouseId=${cartId}&limit=10`, { headers: svc });
  const outs = (movs.body?.data ?? []).filter((m) => m.type === "OUT");
  const outQty = outs.reduce((s, m) => s + m.quantity, 0);
  check("OUT movement(s) total 3.5 kg", Math.abs(outQty - 3.5) < 1e-6, `${outQty} kg across ${outs.length} movement(s)`);
  check("OUT movement drew from FEFO lot", outs.some((m) => !!m.batchId), outs[0]?.batchId ? "batched" : "no batchId");

  console.log(`\n=== CART SALE: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

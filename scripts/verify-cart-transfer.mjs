// P1 verify — batch/expiry-aware transfer (G2). Central has two lots with different
// expiry; transferring a partial amount to a cart must consume source lots FEFO and
// recreate matching lots (batchNo + expiry) at the cart, keeping aggregates in sync.
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
async function lots(productId, warehouseId, batchPrefix) {
  const r = await j(`${INV}/api/stock/expiring?withinDays=3650&includeExpired=1`, { headers: svc });
  return (r.body?.data ?? [])
    .filter((b) => b.productId === productId && b.warehouseId === warehouseId && b.batchNo.startsWith(batchPrefix))
    .map((b) => ({ batchNo: b.batchNo, quantity: b.quantity, expiryDate: b.expiryDate }));
}

async function main() {
  const prods = await j(`${INV}/api/products?sku=FRU-BANANA&limit=1`, { headers: svc });
  const pid = prods.body?.data?.[0]?.id;
  check("product resolved", !!pid, "FRU-BANANA");

  // Central = a fresh dedicated warehouse so this test is isolated from the shared Main pool.
  const stamp = Date.now();
  const centralName = `zz-central-${stamp}`;
  const cartName = `zz-cart-xfer-${stamp}`;
  const central = (await j(`${INV}/api/warehouses`, { method: "POST", headers: svc, body: JSON.stringify({ name: centralName, location: "Central (test)" }) })).body?.data?.id;
  const cart = (await j(`${INV}/api/warehouses`, { method: "POST", headers: svc, body: JSON.stringify({ name: cartName, location: "Cart (test)" }) })).body?.data?.id;
  check("central + cart warehouses created", !!central && !!cart);

  // Receive two lots into Central: LOT-EARLY (T+1d, 6kg) and LOT-LATE (T+5d, 10kg).
  const prefix = `XFER-${stamp}`;
  const early = new Date(Date.now() + 1 * 86400000).toISOString();
  const late = new Date(Date.now() + 5 * 86400000).toISOString();
  await j(`${INV}/api/stock/receive`, { method: "POST", headers: svc, body: JSON.stringify({
    reference: `recv-${stamp}`, idempotencyKey: `recv-${stamp}`,
    items: [
      { productId: pid, warehouseId: central, quantity: 6, batchNo: `${prefix}-EARLY`, expiryDate: early },
      { productId: pid, warehouseId: central, quantity: 10, batchNo: `${prefix}-LATE`, expiryDate: late },
    ],
  }) });
  check("central loaded 16kg (6 early + 10 late)", Math.abs((await onHand(pid, central)) - 16) < 1e-6, `${await onHand(pid, central)} kg`);

  // Transfer 8kg Central -> Cart. FEFO: consume all 6 of EARLY + 2 of LATE.
  const xfer = await j(`${INV}/api/stock/transfer`, { method: "POST", headers: svc, body: JSON.stringify({
    productId: pid, fromWarehouseId: central, toWarehouseId: cart, quantity: 8, notes: "Morning load-out",
  }) });
  check("transfer 8kg accepted (201)", xfer.status === 201, `status ${xfer.status} ${xfer.body?.error ?? ""}`);

  // Aggregates: central 16-8=8, cart 0+8=8.
  check("central on-hand = 8", Math.abs((await onHand(pid, central)) - 8) < 1e-6, `${await onHand(pid, central)} kg`);
  check("cart on-hand = 8", Math.abs((await onHand(pid, cart)) - 8) < 1e-6, `${await onHand(pid, cart)} kg`);

  // Source lots reduced FEFO: EARLY fully drained (0), LATE 10-2=8.
  const srcLots = await lots(pid, central, prefix);
  const srcEarly = srcLots.find((l) => l.batchNo.endsWith("EARLY"));
  const srcLate = srcLots.find((l) => l.batchNo.endsWith("LATE"));
  // A fully-drained lot is dropped from the expiring report (quantity>0 filter),
  // so "not present" == drained to 0, which is the correct FEFO outcome.
  check("source EARLY lot drained to 0 (FEFO first)", !srcEarly || Math.abs(srcEarly.quantity - 0) < 1e-6, `EARLY=${srcEarly?.quantity ?? "drained"}`);
  check("source LATE lot = 8 (2 consumed)", srcLate && Math.abs(srcLate.quantity - 8) < 1e-6, `LATE=${srcLate?.quantity}`);

  // Destination lots recreated with matching batchNo + expiry: EARLY=6, LATE=2.
  const dstLots = await lots(pid, cart, prefix);
  const dstEarly = dstLots.find((l) => l.batchNo.endsWith("EARLY"));
  const dstLate = dstLots.find((l) => l.batchNo.endsWith("LATE"));
  check("cart EARLY lot = 6 with expiry carried", dstEarly && Math.abs(dstEarly.quantity - 6) < 1e-6 && dstEarly.expiryDate?.slice(0, 10) === early.slice(0, 10), `EARLY=${dstEarly?.quantity} exp=${dstEarly?.expiryDate?.slice(0,10)}`);
  check("cart LATE lot = 2 with expiry carried", dstLate && Math.abs(dstLate.quantity - 2) < 1e-6 && dstLate.expiryDate?.slice(0, 10) === late.slice(0, 10), `LATE=${dstLate?.quantity} exp=${dstLate?.expiryDate?.slice(0,10)}`);

  // Over-transfer must be rejected (only 8kg left in central).
  const over = await j(`${INV}/api/stock/transfer`, { method: "POST", headers: svc, body: JSON.stringify({
    productId: pid, fromWarehouseId: central, toWarehouseId: cart, quantity: 100,
  }) });
  check("over-transfer rejected (409)", over.status === 409, `status ${over.status}`);
  check("central unchanged after rejected over-transfer", Math.abs((await onHand(pid, central)) - 8) < 1e-6, `${await onHand(pid, central)} kg`);

  console.log(`\n=== CART TRANSFER: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

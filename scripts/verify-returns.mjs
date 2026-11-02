// Verify customer-initiated return -> admin approve -> complete (restock + credit note).
const BASE = "http://localhost:3010/admin";
const SALES = "http://127.0.0.1:3001";
const INV = "http://127.0.0.1:3002";
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

async function main() {
  const buyer = await loginData("buyer@simhapurifresh.com", "Buyer@12345");
  const buyerHdr = { "Content-Type": "application/json", Authorization: `Bearer ${buyer.accessToken}`, "x-tenant-id": buyer.tenant.id, "x-user-id": buyer.user.id, "x-user-role": "CUSTOMER" };

  // Place an instant online order (auto-confirms) for 1 kg banana.
  const prods = await j(`${INV}/api/products?sku=FRU-BANANA&limit=1`, { headers: { "x-tenant-id": TID, "x-user-role": "ADMIN", "x-service-key": SS } });
  const pid = prods.body?.data?.[0]?.id;
  const sreq = await j(`${SALES}/api/sales-requests`, { method: "POST", headers: buyerHdr, body: JSON.stringify({ isOnlineOrder: true, paymentMethod: "COD", deliveryAddressText: "1 Return St", items: [{ productId: pid, productName: "Banana (Robusta)", quantity: 3, unitPrice: 60 }] }) });
  const orderId = sreq.body?.order?.id;
  check("instant order placed", !!orderId, `order ${sreq.body?.order?.orderNumber}`);

  // Drive it to DELIVERED via staff so it's returnable.
  const staff = {};
  for (const [k, email, pw] of [["sales","sales@simhapurifresh.com","Sales@123"],["pricing","pricing@simhapurifresh.com","Pricing@123"],["dispatch","dispatch@simhapurifresh.com","Dispatch@123"],["delivery","delivery@simhapurifresh.com","Delivery@123"],["accounts","accounts@simhapurifresh.com","Accounts@123"],["admin","admin@simhapurifresh.com","Admin@123"]]) {
    const d = await loginData(email, pw); staff[k] = { Authorization: `Bearer ${d.accessToken}`, "x-tenant-id": d.tenant.id, "x-user-id": d.user.id, "x-user-role": d.user.role, "Content-Type": "application/json" };
  }
  const act = (hdr, action, bodyObj = {}) => j(`${SALES}/api/orders/${orderId}?action=${action}`, { method: "PATCH", headers: hdr, body: JSON.stringify(bodyObj) });
  let o = (await j(`${SALES}/api/orders/${orderId}`, { headers: staff.sales })).body.data;
  await act(staff.sales, "review", { items: o.items.map(l => ({ id: l.id, productId: l.productId, productName: l.productName, quantity: l.quantity, unitPrice: l.unitPrice })) });
  o = (await j(`${SALES}/api/orders/${orderId}`, { headers: staff.sales })).body.data;
  await act(staff.sales, "verify-stock", { items: o.items.map(l => ({ orderItemId: l.id, availableQty: l.quantity })) });
  await act(staff.pricing, "complete-pricing", { items: o.items.map(l => ({ orderItemId: l.id, unitPrice: l.unitPrice })) });
  await act(staff.dispatch, "warehouse-ready", {});
  await act(staff.dispatch, "dispatch", { fulfillmentMode: "own_fleet", vehicleInfo: "AP-RET-1", assignedDriverId: "driver-ret" });
  const delivered = await act(staff.delivery, "deliver-oms", {});
  check("order delivered", ["DELIVERED","INVOICED","PAID","CLOSED"].includes(delivered.body?.data?.status), delivered.body?.data?.status);

  // CUSTOMER requests a return of 1 kg via the portal BFF.
  const ret = await j(`${BASE}/api/portal/orders/${orderId}/return`, { method: "POST", headers: buyerHdr, body: JSON.stringify({ reason: "Spoiled on arrival", items: [{ productId: pid, quantity: 1 }] }) });
  const returnId = ret.body?.data?.id;
  check("customer return request (201)", ret.status === 201 && !!returnId, `${ret.status} ${ret.body?.error ?? ""} ${ret.body?.data?.returnNumber ?? ""}`);
  check("return is PENDING", ret.body?.data?.status === "PENDING", ret.body?.data?.status);

  // Negative: another customer can't return this order (ownership) — simulate via a bogus user id header is hard; instead check staff-only approve is blocked for customer.
  const custApprove = await j(`${SALES}/api/returns/${returnId}?action=approve`, { method: "PATCH", headers: { ...buyerHdr }, body: JSON.stringify({ warehouseId: "x" }) });
  check("customer cannot approve (403)", custApprove.status === 403, `status ${custApprove.status}`);

  // ADMIN approves then completes (restock + credit note).
  const whRes = await j(`${INV}/api/warehouses?limit=1`, { headers: { "x-tenant-id": TID, "x-user-role": "ADMIN", "x-service-key": SS } });
  const whId = whRes.body?.data?.[0]?.id;
  const approve = await j(`${SALES}/api/returns/${returnId}?action=approve`, { method: "PATCH", headers: staff.admin, body: JSON.stringify({ warehouseId: whId }) });
  check("admin approve (APPROVED)", approve.body?.data?.status === "APPROVED", `${approve.status} ${approve.body?.data?.status ?? approve.body?.error}`);
  const complete = await j(`${SALES}/api/returns/${returnId}?action=complete`, { method: "PATCH", headers: staff.admin, body: JSON.stringify({ warehouseId: whId }) });
  check("admin complete (COMPLETED + credit note)", complete.body?.data?.status === "COMPLETED" && !!complete.body?.data?.creditNoteId, `${complete.status} status=${complete.body?.data?.status} cn=${complete.body?.data?.creditNoteId ?? complete.body?.error}`);

  console.log(`\n=== RETURNS: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

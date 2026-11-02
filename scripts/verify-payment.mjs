// Verify online order payment (dev mode) end to end via the portal BFF.
const BASE = "http://localhost:3010/admin";
const SALES = "http://127.0.0.1:3001";
const TENANT = "simhapuri-fresh";
const SS = "dev-service-secret";

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "\u2713" : "\u2717"} ${label}${detail ? " \u2014 " + detail : ""}`);
  ok ? pass++ : fail++;
};

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const t = await res.text();
  let body = {};
  try { body = t ? JSON.parse(t) : {}; } catch { body = { error: t.slice(0, 200) }; }
  return { status: res.status, body };
}

async function main() {
  // Buyer login
  const login = await j(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email: "buyer@simhapurifresh.com", password: "Buyer@12345", tenantSlug: TENANT }),
  });
  const token = login.body?.data?.accessToken;
  const tenantId = login.body?.data?.tenant?.id;
  const userId = login.body?.data?.user?.id;
  check("buyer login", !!token, `tenant=${tenantId}`);

  const buyerHdr = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-tenant-id": tenantId, "x-user-id": userId, "x-user-role": "CUSTOMER" };

  // Resolve a product
  const prods = await j(`${SALES.replace("3001","3002")}/api/products?sku=FRU-BANANA&limit=1`, { headers: { "x-tenant-id": tenantId, "x-user-role": "ADMIN", "x-service-key": SS } });
  const pid = prods.body?.data?.[0]?.id;

  // Place SREQ as buyer
  const sreq = await j(`${SALES}/api/sales-requests`, {
    method: "POST", headers: buyerHdr,
    body: JSON.stringify({ isOnlineOrder: true, paymentMethod: "UPI", deliveryAddressText: "1 Test St",
      items: [{ productId: pid, productName: "Banana (Robusta)", quantity: 2, unitPrice: 60 }] }),
  });
  const sreqId = sreq.body?.data?.id;
  check("SREQ created", sreq.status === 201 && !!sreqId);

  // Convert to SO as sales staff
  const salesLogin = await j(`${BASE}/api/auth`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email: "sales@simhapurifresh.com", password: "Sales@123", tenantSlug: TENANT }) });
  const st = salesLogin.body.data;
  const conv = await j(`${SALES}/api/sales-requests/${sreqId}/convert`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${st.accessToken}`, "x-tenant-id": st.tenant.id, "x-user-id": st.user.id, "x-user-role": st.user.role } });
  const orderId = conv.body?.data?.salesOrder?.id;
  // Instant-order: the SREQ may already be auto-confirmed, so convert is idempotent (200 or 201).
  check("converted to SO", [200, 201].includes(conv.status) && !!orderId, `order ${conv.body?.data?.salesOrder?.orderNumber}`);

  // Order should be PENDING payment before paying
  const before = await j(`${SALES}/api/orders/${orderId}`, { headers: buyerHdr });
  check("order unpaid before", before.body?.data?.paymentStatus === "PENDING", before.body?.data?.paymentStatus);

  // 1. Create payment via portal BFF (dev mode -> simulated provider order)
  const pay = await j(`${BASE}/api/portal/orders/${orderId}/pay`, {
    method: "POST", headers: buyerHdr, body: JSON.stringify({ method: "UPI" }),
  });
  check("pay create (201)", pay.status === 201, `${pay.status} ${pay.body?.error ?? ""}`);
  const intent = pay.body?.data ?? {};
  check("dev mode provider order returned", intent.devMode === true && !!intent.providerOrderId,
    `provider=${intent.provider} amount=${intent.amount} order=${intent.providerOrderId}`);

  // 2. Verify/settle
  const verify = await j(`${BASE}/api/portal/orders/${orderId}/pay/verify`, {
    method: "POST", headers: buyerHdr, body: JSON.stringify({ providerOrderId: intent.providerOrderId }),
  });
  check("pay verify (200)", verify.status === 200, `${verify.status} ${verify.body?.error ?? ""}`);
  check("settle reports PAID", verify.body?.data?.paymentStatus === "PAID", JSON.stringify(verify.body?.data ?? {}));

  // 3. Order now PAID
  const after = await j(`${SALES}/api/orders/${orderId}`, { headers: buyerHdr });
  check("order paymentStatus PAID", after.body?.data?.paymentStatus === "PAID", after.body?.data?.paymentStatus);

  // 4. Double-pay guard
  const again = await j(`${BASE}/api/portal/orders/${orderId}/pay`, { method: "POST", headers: buyerHdr, body: JSON.stringify({ method: "UPI" }) });
  check("re-pay blocked (409)", again.status === 409, `${again.status} ${again.body?.error ?? ""}`);

  console.log(`\n=== PAYMENT: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

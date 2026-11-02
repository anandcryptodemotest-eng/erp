// Verify delivery live tracking + proof-of-delivery (POD) end to end.
const BASE = "http://localhost:3010/admin";
const SALES = "http://127.0.0.1:3001";
const INV = "http://127.0.0.1:3002";
const DELIVERY = "http://127.0.0.1:3006";
const TENANT = "simhapuri-fresh";
const TID = "cmvt0wjn70008lpzqywwpxen7";
const SS = "dev-service-secret";

let pass = 0, fail = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "\u2713" : "\u2717"} ${label}${detail ? " \u2014 " + detail : ""}`);
  ok ? pass++ : fail++;
};
const svc = { "Content-Type": "application/json", "x-tenant-id": TID, "x-user-role": "ADMIN", "x-user-id": "verify", "x-service-key": SS };

async function j(url, opts = {}) {
  const res = await fetch(url, opts);
  const t = await res.text();
  let body = {}; try { body = t ? JSON.parse(t) : {}; } catch { body = { error: t.slice(0, 200) }; }
  return { status: res.status, body };
}

async function main() {
  // Create a delivery assignment (service-key, own-fleet style) for a dummy order.
  const orderId = "track-test-" + Date.now();
  const create = await j(`${DELIVERY}/api/assignments`, {
    method: "POST", headers: svc,
    body: JSON.stringify({ orderId, orderNumber: "SO-TRACK", executiveId: "driver-track-1", vehicleInfo: "AP-16-TRACK" }),
  });
  const aId = create.body?.data?.id;
  check("assignment created", (create.status === 201 || create.status === 200) && !!aId, `status ${create.status}`);

  // Move ASSIGNED -> ACCEPTED -> PICKED_UP so tracking is allowed.
  await j(`${DELIVERY}/api/assignments/${aId}`, { method: "PATCH", headers: svc, body: JSON.stringify({ status: "ACCEPTED" }) });
  await j(`${DELIVERY}/api/assignments/${aId}`, { method: "PATCH", headers: svc, body: JSON.stringify({ status: "PICKED_UP" }) });

  // Post a few GPS pings (driver app).
  const p1 = await j(`${DELIVERY}/api/assignments/${aId}/tracking`, { method: "POST", headers: svc, body: JSON.stringify({ latitude: 16.5062, longitude: 80.648, accuracy: 12 }) });
  const p2 = await j(`${DELIVERY}/api/assignments/${aId}/tracking`, { method: "POST", headers: svc, body: JSON.stringify({ latitude: 16.512, longitude: 80.655, accuracy: 8 }) });
  check("GPS pings accepted (201)", p1.status === 201 && p2.status === 201, `${p1.status},${p2.status}`);

  // Read back tracking (latest first).
  const track = await j(`${DELIVERY}/api/assignments/${aId}/tracking`, { headers: svc });
  check("tracking lists pings", (track.body?.data?.length ?? 0) >= 2, `${track.body?.data?.length} pings`);
  check("latest ping is the newest", track.body?.meta?.latest?.latitude === 16.512, `lat=${track.body?.meta?.latest?.latitude}`);

  // Mark DELIVERED with proof of delivery.
  const deliver = await j(`${DELIVERY}/api/assignments/${aId}`, {
    method: "PATCH", headers: svc,
    body: JSON.stringify({ status: "DELIVERED", podPhotoUrl: "/media/pod/track.jpg", podRecipientName: "Ravi Kumar", podNotes: "Left at door" }),
  });
  // deliver-oms call to sales will 404 (dummy order) but POD must still persist on the assignment.
  const detail = await j(`${DELIVERY}/api/assignments/${aId}`, { headers: svc });
  const a = detail.body?.data;
  check("POD persisted (photo+recipient)", a?.podPhotoUrl === "/media/pod/track.jpg" && a?.podRecipientName === "Ravi Kumar", `status=${a?.status} pod=${a?.podPhotoUrl}`);

  // Negative: tracking rejected after terminal state.
  const late = await j(`${DELIVERY}/api/assignments/${aId}/tracking`, { method: "POST", headers: svc, body: JSON.stringify({ latitude: 1, longitude: 1 }) });
  check("tracking blocked after DELIVERED (409)", late.status === 409, `status ${late.status}`);

  console.log(`\n=== TRACKING/POD: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

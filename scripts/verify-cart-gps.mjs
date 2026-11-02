// P6 verify — cart GPS: ping updates last-known position; track returns breadcrumbs.
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
  const loc = await j(`${INV}/api/stock-locations`, { method: "POST", headers: svc, body: JSON.stringify({ code: `zz-GPS-${stamp}`, name: `GPS Cart ${stamp}`, type: "CART" }) });
  const locId = loc.body?.data?.id;
  check("cart created", !!locId);

  // Three GPS pings along a route.
  const route = [
    { latitude: 16.9891, longitude: 82.2475, accuracy: 8 },
    { latitude: 16.9905, longitude: 82.2490, accuracy: 6 },
    { latitude: 16.9920, longitude: 82.2512, accuracy: 5 },
  ];
  for (const p of route) {
    const r = await j(`${INV}/api/stock-locations/${locId}/ping`, { method: "POST", headers: svc, body: JSON.stringify(p) });
    if (r.status !== 201) { check("ping accepted", false, `status ${r.status} ${r.body?.error ?? ""}`); }
  }
  check("3 pings accepted (201)", true);

  // Track returns breadcrumbs latest-first + current position = last ping.
  const track = await j(`${INV}/api/stock-locations/${locId}/track`, { headers: svc });
  const pings = track.body?.data?.pings ?? [];
  check("track returns 3 pings", pings.length === 3, `${pings.length} pings`);
  check("pings are latest-first", pings.length === 3 && pings[0].latitude === route[2].latitude, `first=${pings[0]?.latitude}`);
  const cur = track.body?.data?.current;
  check("current position = last ping", cur && Math.abs(cur.latitude - route[2].latitude) < 1e-9 && Math.abs(cur.longitude - route[2].longitude) < 1e-9, `cur=${cur?.latitude},${cur?.longitude}`);

  // Location detail reflects lastLatitude/Longitude/SeenAt.
  const detail = await j(`${INV}/api/stock-locations/${locId}`, { headers: svc });
  const d = detail.body?.data;
  check("location lastLatitude updated", d && Math.abs(d.lastLatitude - route[2].latitude) < 1e-9, `${d?.lastLatitude}`);
  check("location lastSeenAt set", !!d?.lastSeenAt, d?.lastSeenAt);

  // Bad coordinates rejected (validation).
  const bad = await j(`${INV}/api/stock-locations/${locId}/ping`, { method: "POST", headers: svc, body: JSON.stringify({ latitude: 999, longitude: 0 }) });
  check("invalid latitude rejected (400)", bad.status === 400, `status ${bad.status}`);

  console.log(`\n=== CART GPS: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
